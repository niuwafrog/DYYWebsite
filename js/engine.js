/* =========================================================
   engine.js —— 房间、故事、奶奶、时间
   不需要改这个文件；内容都在 data/content.js 里。
   ========================================================= */
(function () {
  "use strict";

  var C = window.CONTENT;
  if (!C) { console.error("[memoir] data/content.js 没有加载"); return; }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var STORE = "grandma-room.progress.v1";

  /* ---------------------------------------------------------
     state
     --------------------------------------------------------- */
  var state = {
    view: "intro",
    sceneId: "living",
    found: [],        // "sceneId:hotspotId"
    phaseId: null,
    sound: true,
    greeted: false,
    panned: false,
    baseScroll: 0
  };

  var els = {};
  var photosById = new Map();   // id -> photo
  var photoList = [];           // 去重后的全部照片
  var speechTimer = null;
  var hintTimer = null;
  var saidKeys = new Set();
  var lastIdle = -1;
  var lastFocus = null;
  var ambientSuppressed = false;

  var lightbox = { list: [], index: 0 };

  /* ---------------------------------------------------------
     helpers
     --------------------------------------------------------- */
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "text") node.textContent = v;
        else if (k === "class") node.className = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        found: state.found, sceneId: state.sceneId, sound: state.sound
      }));
    } catch (e) { /* 隐私模式下写不进去，忽略 */ }
  }

  function restore() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (Array.isArray(data.found)) state.found = data.found.filter(function (x) { return typeof x === "string"; });
      if (data.sceneId && C.scenes[data.sceneId]) state.sceneId = data.sceneId;
      if (typeof data.sound === "boolean") state.sound = data.sound;
    } catch (e) { /* 坏数据就当没有 */ }
  }

  function keyOf(sceneId, hotspotId) { return sceneId + ":" + hotspotId; }

  /* ---------------------------------------------------------
     照片索引
     --------------------------------------------------------- */
  function buildPhotoRegistry() {
    var seen = new Map();
    Object.keys(C.scenes).forEach(function (sceneId) {
      (C.scenes[sceneId].hotspots || []).forEach(function (h) {
        var photos = h.story && h.story.photos;
        if (!photos) return;
        photos.forEach(function (p, i) {
          var dedupe = p.src + "|" + (p.caption || "");
          if (seen.has(dedupe)) { p._id = seen.get(dedupe); return; }
          var id = sceneId + "-" + h.id + "-" + i;
          seen.set(dedupe, id);
          p._id = id;
          var rec = {
            id: id,
            src: p.src,
            caption: p.caption || "",
            year: p.year || "",
            story: h.story.title,
            scene: C.scenes[sceneId].name
          };
          photosById.set(id, rec);
          photoList.push(rec);
        });
      });
    });
  }

  /* ---------------------------------------------------------
     时间 / 光线
     --------------------------------------------------------- */
  function phaseFor(count) {
    var list = C.phases || [];
    var chosen = list[0] || { id: "day", after: 0, overlay: "day" };
    for (var i = 0; i < list.length; i++) {
      if (count >= (list[i].after || 0)) chosen = list[i];
    }
    return chosen;
  }

  function applyPhase(phase, announce) {
    if (!phase) return;
    var changed = state.phaseId !== phase.id;
    state.phaseId = phase.id;
    document.body.dataset.phase = phase.overlay || phase.id;
    setSceneArt(sceneArtUrl(phase));
    if (changed && announce && phase.granny) {
      window.setTimeout(function () { speak(phase.granny); }, 700);
    }
  }

  function sceneArtUrl(phase) {
    var scene = C.scenes[state.sceneId];
    var p = phase || phaseFor(state.found.length);
    if (p && p.art && p.art[state.sceneId]) return p.art[state.sceneId];
    return scene.art;
  }

  function setSceneArt(url) {
    if (!url || !els.sceneArt) return;
    if (els.sceneArt.getAttribute("src") === url) return;
    var img = new Image();
    img.onload = function () {
      els.sceneArt.src = url;
      els.sceneArt.classList.remove("is-fading");
    };
    els.sceneArt.classList.add("is-fading");
    img.onerror = function () { els.sceneArt.classList.remove("is-fading"); };
    img.src = url;
    window.setTimeout(function () { els.sceneArt.classList.remove("is-fading"); }, 1600);
  }

  /* ---------------------------------------------------------
     封面
     --------------------------------------------------------- */
  function renderIntro() {
    var meta = C.meta || {};
    document.title = meta.title || document.title;
    $("#introTitle").textContent = meta.title || "奶奶的房间";
    $("#introKicker").textContent = meta.kicker || "";
    var lead = $("#introLead");
    lead.textContent = "";
    String(meta.lead || "").split("\n").forEach(function (line, i) {
      if (i) lead.appendChild(document.createElement("br"));
      lead.appendChild(document.createTextNode(line));
    });
    $("#introHint").textContent = meta.hint || "";
    var btn = $("#enterBtn");
    btn.textContent = meta.enterLabel || "推门进去";
    $("#brand").textContent = meta.brand || "";

    var wrap = $("#introPhotos");
    wrap.textContent = "";
    (C.introPhotos || []).forEach(function (p, i) {
      var card = el("div", { class: "intro__photo" }, [
        el("img", { src: p.src, alt: "", loading: "lazy" })
      ]);
      card.style.left = p.x + "%";
      card.style.top = p.y + "%";
      card.style.width = (p.w || 13) + "%";
      card.style.setProperty("--rot", (p.rot || 0) + "deg");
      card.style.animationDelay = (i * 1.7) + "s";
      var img = card.querySelector("img");
      if (img.complete) window.setTimeout(function () { card.classList.add("is-in"); }, 120 + i * 90);
      else img.addEventListener("load", function () { card.classList.add("is-in"); });
      img.addEventListener("error", function () { card.classList.add("is-in"); });
      wrap.appendChild(card);
    });
  }

  /* ---------------------------------------------------------
     尺寸：让场景始终完整地放进可用空间，且和图的比例一致
     --------------------------------------------------------- */
  function fitScene() {
    var art = els.sceneArt, fit = els.stageFit;
    if (!art || !fit) return;
    var nw = art.naturalWidth, nh = art.naturalHeight;
    if (!nw || !nh) return;
    var boxW = fit.clientWidth, boxH = fit.clientHeight;
    if (!boxW || !boxH) return;
    var ar = nw / nh;
    var w, h;

    if (boxW / boxH < 1.02) {
      // 竖屏：房间按高度铺满，左右滑动看（比缩成一条窄缝强）
      h = boxH;
      w = Math.max(boxW, h * ar);
      var cap = boxW * 2.6;   // 别放得太大，不然只看得到一把椅子
      if (w > cap) { w = cap; h = w / ar; }
    } else {
      w = Math.min(boxW, boxH * ar);
      h = w / ar;
    }

    els.scene.style.width = Math.floor(w) + "px";
    els.scene.style.height = Math.floor(h) + "px";

    if (pendingCenter) {
      pendingCenter = false;
      els.stageFit.scrollLeft = Math.max(0, (w - boxW) / 2);
      state.baseScroll = els.stageFit.scrollLeft;
    }
    updatePanHint();
  }

  var pendingCenter = true;

  function updatePanHint() {
    var fit = els.stageFit, hint = els.panHint;
    if (!fit || !hint) return;
    var scrollable = fit.scrollWidth > fit.clientWidth + 8;
    hint.hidden = !(scrollable && !state.panned);
  }

  // 抽屉开合时，房间会往旁边让一让 —— 逐帧重算尺寸，跟住过渡
  function animateFit(ms) {
    var start = window.performance.now();
    var total = ms || 620;
    (function step(now) {
      fitScene();
      if ((now || 0) - start < total) window.requestAnimationFrame(step);
    })(start);
  }

  var fitQueued = false;
  function queueFit() {
    if (fitQueued) return;
    fitQueued = true;
    window.requestAnimationFrame(function () { fitQueued = false; fitScene(); });
  }

  /* ---------------------------------------------------------
     房间渲染
     --------------------------------------------------------- */
  function renderScene() {
    var scene = C.scenes[state.sceneId];
    if (!scene) return;

    els.sceneArt.alt = scene.alt || "";
    els.sceneArt.src = sceneArtUrl(phaseFor(state.found.length));
    pendingCenter = true;
    if (els.sceneArt.complete) queueFit();

    renderTabs();
    renderHotspots();
    hideSpeech();
    updatePhotoCount();
  }

  function renderTabs() {
    var tabs = $("#sceneTabs");
    tabs.textContent = "";
    Object.keys(C.scenes).forEach(function (id) {
      var scene = C.scenes[id];
      tabs.appendChild(el("button", {
        type: "button",
        class: "scenetab" + (id === state.sceneId ? " is-active" : ""),
        "aria-current": id === state.sceneId ? "true" : null,
        text: scene.name || id,
        onclick: function () { switchScene(id); }
      }));
    });
  }

  function renderHotspots() {
    var scene = C.scenes[state.sceneId];
    var wrap = $("#hotspots");
    wrap.textContent = "";
    (scene.hotspots || []).forEach(function (h) {
      if (h.phases && h.phases.indexOf(state.phaseId) === -1) return;

      var found = state.found.indexOf(keyOf(state.sceneId, h.id)) !== -1;
      var label = h.label || "";
      var aria = h.kind === "granny" ? "和奶奶说说话"
        : h.kind === "scene" ? "去" + (C.scenes[h.to] ? C.scenes[h.to].name : "另一个房间")
        : label + "：打开一段记忆";

      var btn = el("button", {
        type: "button",
        class: "hotspot" + (found ? " is-found" : ""),
        "aria-label": aria,
        title: "",
        onclick: function (e) { e.stopPropagation(); activateHotspot(h); }
      }, label && h.kind !== "scene" && h.kind !== "granny"
        ? [el("span", { class: "hotspot__label", text: label })]
        : null);

      btn.style.setProperty("--x", h.x);
      btn.style.setProperty("--y", h.y);
      btn.style.setProperty("--d", h.d || 10);
      wrap.appendChild(btn);
    });
  }

  function activateHotspot(h) {
    hideSpeech();
    if (h.kind === "scene" && h.to) { switchScene(h.to); return; }
    if (h.kind === "granny") { speakGranny(true); return; }
    openStory(h);
  }

  function switchScene(id) {
    if (!C.scenes[id] || id === state.sceneId) return;
    state.sceneId = id;
    save();
    renderScene();
    startAmbient();
  }

  /* ---------------------------------------------------------
     故事抽屉
     --------------------------------------------------------- */
  function openStory(h) {
    var story = h.story;
    if (!story) return;
    var scene = C.scenes[state.sceneId];
    lastFocus = document.activeElement;

    var body = $("#drawerBody");
    body.textContent = "";

    var children = [];
    children.push(el("p", { class: "story__kicker", text: (scene.name || "") + " · 一段记忆" }));
    children.push(el("h2", { class: "story__title", id: "drawerTitle", text: story.title || h.label || "" }));

    if (story.sample) {
      children.push(el("p", { class: "story__sample", text: "示例文字 · 换成你自己的故事" }));
    }

    var prose = el("div", { class: "story__body" });
    (story.body || []).forEach(function (p) {
      prose.appendChild(el("p", { text: p }));
    });
    children.push(prose);

    if (story.audio) children.push(audioBlock(story));

    if (story.transcript) {
      children.push(el("details", { class: "transcript" }, [
        el("summary", { text: "文字稿" }),
        el("p", { text: story.transcript })
      ]));
    }

    var photos = (story.photos || []).filter(function (p) { return p && p.src; });
    if (photos.length) {
      var grid = el("div", { class: "story__photos" });
      photos.forEach(function (p, i) {
        var fig = el("figure", null, [
          el("button", {
            type: "button",
            "aria-label": "放大看：" + (p.caption || "照片"),
            onclick: function () { openLightbox(photos, i); }
          }, [el("img", { src: p.src, alt: p.caption || "", loading: "lazy" })]),
          el("figcaption", { text: [p.year, p.caption].filter(Boolean).join(" · ") })
        ]);
        grid.appendChild(fig);
      });
      children.push(grid);
    }

    children.push(el("div", { class: "story__foot" }, [
      el("button", {
        type: "button",
        text: "合上，再看看别处",
        onclick: closeDrawer
      })
    ]));

    children.forEach(function (c) { body.appendChild(c); });
    body.scrollTop = 0;

    openDrawer();
    markFound(h.id);

    els.drawer.focus({ preventScroll: true });
  }

  function audioBlock(story) {
    var audio = el("audio", { controls: "", preload: "metadata", src: story.audio });
    audio.addEventListener("play", function () {
      if (!els.ambient.paused) { ambientSuppressed = true; els.ambient.pause(); }
    });
    audio.addEventListener("pause", function () {
      if (ambientSuppressed) { ambientSuppressed = false; startAmbient(); }
    });
    return el("div", { class: "audio" }, [
      el("p", { class: "audio__label", text: story.audioLabel || "听一段录音" }),
      audio
    ]);
  }

  function openDrawer() {
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
    if (window.innerWidth <= 760) els.scrim.hidden = false;
    document.body.classList.add("drawer-open");
    animateFit(640);
    window.setTimeout(fitScene, 720);
  }

  function closeDrawer() {
    els.drawer.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    els.scrim.hidden = true;
    document.body.classList.remove("drawer-open");
    animateFit(640);
    window.setTimeout(fitScene, 720);
    // 关掉还在响的声音
    Array.prototype.forEach.call(els.drawer.querySelectorAll("audio"), function (a) {
      a.pause();
      try { a.currentTime = 0; } catch (e) { /* ignore */ }
    });
    if (ambientSuppressed) { ambientSuppressed = false; startAmbient(); }
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  }

  function markFound(hotspotId) {
    var key = keyOf(state.sceneId, hotspotId);
    if (state.found.indexOf(key) === -1) {
      state.found.push(key);
      save();
      lastSeenHotspot = hotspotId;
      renderHotspots();
      updatePhotoCount();
      applyPhase(phaseFor(state.found.length), true);
    } else {
      lastSeenHotspot = hotspotId;
    }
  }

  var lastSeenHotspot = null;

  function updatePhotoCount() {
    var badge = $("#photoCount");
    if (!badge) return;
    if (photoList.length) {
      badge.hidden = false;
      badge.textContent = String(photoList.length);
    } else {
      badge.hidden = true;
    }
  }

  /* ---------------------------------------------------------
     看图
     --------------------------------------------------------- */
  function openLightbox(photos, index) {
    lightbox.list = photos;
    lightbox.index = index || 0;
    els.lightbox.classList.add("is-open");
    els.lightbox.setAttribute("aria-hidden", "false");
    lastFocus = document.activeElement;
    showLightboxImage();
    $("#lightboxClose").focus({ preventScroll: true });
  }

  function showLightboxImage() {
    var p = lightbox.list[lightbox.index];
    if (!p) return;
    els.lightboxImg.src = p.src;
    els.lightboxImg.alt = p.caption || "照片";
    els.lightboxCap.textContent = [p.year, p.caption].filter(Boolean).join(" · ");
    var multi = lightbox.list.length > 1;
    $("#lightboxPrev").style.display = multi ? "" : "none";
    $("#lightboxNext").style.display = multi ? "" : "none";
  }

  function stepLightbox(dir) {
    if (lightbox.list.length < 2) return;
    lightbox.index = (lightbox.index + dir + lightbox.list.length) % lightbox.list.length;
    showLightboxImage();
  }

  function closeLightbox() {
    els.lightbox.classList.remove("is-open");
    els.lightbox.setAttribute("aria-hidden", "true");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------
     奶奶
     --------------------------------------------------------- */
  function grannyHotspot() {
    var scene = C.scenes[state.sceneId];
    return (scene.hotspots || []).filter(function (h) { return h.kind === "granny"; })[0];
  }

  function speak(text, holdMs) {
    if (!text) return;
    var h = grannyHotspot();
    if (h) {
      els.speech.style.setProperty("--x", h.x);
      els.speech.style.setProperty("--y", h.y);
    }
    window.clearTimeout(speechTimer);
    els.speech.textContent = text;
    els.speech.hidden = false;
    speechTimer = window.setTimeout(hideSpeech, holdMs || 8500);
  }

  function hideSpeech() {
    window.clearTimeout(speechTimer);
    els.speech.hidden = true;
  }

  var grannyIndex = 0;

  function speakGranny(manual) {
    var G = C.granny || {};
    var lines = [];

    // 1. 刚看过的那段记忆，奶奶有话说
    if (lastSeenHotspot && G.perMemory && G.perMemory[lastSeenHotspot] && !saidKeys.has(lastSeenHotspot)) {
      saidKeys.add(lastSeenHotspot);
      lines.push(G.perMemory[lastSeenHotspot]);
    }
    // 2. 当前时间段的台词
    if (G.perPhase && G.perPhase[state.phaseId] && !saidKeys.has("phase:" + state.phaseId)) {
      saidKeys.add("phase:" + state.phaseId);
      lines.push(G.perPhase[state.phaseId]);
    }
    // 3. 随机
    if (!lines.length && G.idle && G.idle.length) {
      var i = Math.floor(Math.random() * G.idle.length);
      if (G.idle.length > 1 && i === lastIdle) i = (i + 1) % G.idle.length;
      lastIdle = i;
      lines.push(G.idle[i]);
    }
    if (!lines.length && G.greetings && G.greetings.length) {
      lines.push(G.greetings[grannyIndex++ % G.greetings.length]);
    }
    speak(lines.join(" "));
  }

  /* ---------------------------------------------------------
     环境声
     --------------------------------------------------------- */
  function startAmbient() {
    if (!state.sound) { els.ambient.pause(); return; }
    var scene = C.scenes[state.sceneId];
    var url = scene && scene.ambient;
    if (!url) { els.ambient.pause(); return; }
    if (els.ambient.getAttribute("src") !== url) els.ambient.src = url;
    els.ambient.volume = 0.35;
    var p = els.ambient.play();
    if (p && typeof p.catch === "function") p.catch(function () { /* 浏览器不让自动播放 */ });
  }

  function toggleSound() {
    state.sound = !state.sound;
    save();
    var btn = $("#soundBtn");
    btn.setAttribute("aria-pressed", state.sound ? "true" : "false");
    if (state.sound) startAmbient();
    else {
      els.ambient.pause();
      Array.prototype.forEach.call(document.querySelectorAll("audio"), function (a) {
        if (a !== els.ambient) a.pause();
      });
    }
  }

  /* ---------------------------------------------------------
     视图
     --------------------------------------------------------- */
  function showView(name) {
    state.view = name;
    var map = { intro: "#viewIntro", room: "#viewRoom", desk: "#viewDesk" };
    Object.keys(map).forEach(function (k) {
      var node = $(map[k]);
      if (node) node.classList.toggle("is-active", k === name);
    });
    document.body.dataset.view = name;
    if (name !== "room") hideSpeech();
    if (name === "desk" && window.Desk) window.Desk.render();
  }

  function enterRoom() {
    showView("room");
    if (!state.greeted) {
      state.greeted = true;
      window.setTimeout(function () {
        var G = C.granny || {};
        var g = (G.greetings && G.greetings[0]) || "坐吧。";
        speak(g);
      }, 1600);
    }
    startAmbient();

    // 第一次来：轻轻闪一下可以点的地方，不然没人知道要点
    if (state.found.length === 0) {
      window.setTimeout(function () {
        if (state.found.length > 0) return;
        document.body.classList.add("is-hinting");
        $("#hintBtn").setAttribute("aria-pressed", "true");
        window.setTimeout(function () {
          document.body.classList.remove("is-hinting");
          $("#hintBtn").setAttribute("aria-pressed", "false");
        }, 6000);
      }, 4200);
    }
  }

  /* ---------------------------------------------------------
     菜单 / 关于
     --------------------------------------------------------- */
  function openAbout() {
    lastFocus = document.activeElement;
    var body = $("#drawerBody");
    body.textContent = "";
    body.appendChild(el("p", { class: "story__kicker", text: "about" }));
    body.appendChild(el("h2", { class: "story__title", id: "drawerTitle", text: "关于这个项目" }));
    body.appendChild(el("div", { class: "story__body" }, [
      el("p", { text: "这是一个关于我奶奶的房间的纪念。屋子是按记忆画的，故事是真的。" }),
      el("p", { text: "点房间里的东西，会打开一段记忆；有些记忆里有录音和照片。照片可以拖到「照片桌」上，自己拼成一张。" }),
      el("p", { text: "如果你的浏览器里还留着上次的进度，可以从上次停下的地方继续。想重新走一遍，点菜单里的「从头再来一次」。" })
    ]));
    body.appendChild(el("div", { class: "story__foot" }, [
      el("button", { type: "button", text: "合上", onclick: closeDrawer })
    ]));
    openDrawer();
    els.drawer.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------
     事件绑定
     --------------------------------------------------------- */
  function bindEvents() {
    $("#enterBtn").addEventListener("click", enterRoom);

    $("#hintBtn").addEventListener("click", function () {
      var on = !document.body.classList.contains("is-hinting");
      document.body.classList.toggle("is-hinting", on);
      this.setAttribute("aria-pressed", on ? "true" : "false");
      window.clearTimeout(hintTimer);
      if (on) {
        hintTimer = window.setTimeout(function () {
          document.body.classList.remove("is-hinting");
          $("#hintBtn").setAttribute("aria-pressed", "false");
        }, 12000);
      }
    });

    $("#soundBtn").setAttribute("aria-pressed", state.sound ? "true" : "false");
    $("#soundBtn").addEventListener("click", toggleSound);

    $("#deskBtn").addEventListener("click", function () { showView("desk"); });
    $("#deskBack").addEventListener("click", function () { showView("room"); });

    $("#drawerClose").addEventListener("click", closeDrawer);
    els.scrim.addEventListener("click", closeDrawer);

    $("#lightboxClose").addEventListener("click", closeLightbox);
    $("#lightboxPrev").addEventListener("click", function () { stepLightbox(-1); });
    $("#lightboxNext").addEventListener("click", function () { stepLightbox(1); });
    els.lightbox.addEventListener("click", function (e) {
      if (e.target === els.lightbox) closeLightbox();
    });

    var menuBtn = $("#menuBtn");
    var menu = $("#menu");
    menuBtn.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== menuBtn) {
        menu.hidden = true;
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
    menu.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-menu");
      if (!action) return;
      menu.hidden = true;
      if (action === "restart") {
        if (window.confirm("要从头再走一遍吗？照片桌上的摆放也会清空。")) {
          try {
            localStorage.removeItem(STORE);
            localStorage.removeItem("grandma-room.desk.v1");
          } catch (err) { /* ignore */ }
          window.location.reload();
        }
      } else if (action === "about") {
        openAbout();
      }
    });

    document.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "Escape") {
        if (els.lightbox.classList.contains("is-open")) { closeLightbox(); return; }
        if (els.drawer.classList.contains("is-open")) { closeDrawer(); return; }
        if (!menu.hidden) { menu.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
        return;
      }
      if (els.lightbox.classList.contains("is-open")) {
        if (k === "ArrowLeft") stepLightbox(-1);
        if (k === "ArrowRight") stepLightbox(1);
      }
      if (k === "Tab" && els.drawer.classList.contains("is-open")) trapFocus(e);
    });

    // 手机上滑关掉抽屉
    var startY = null;
    els.drawer.addEventListener("touchstart", function (e) { startY = e.touches[0].clientY; }, { passive: true });
    els.drawer.addEventListener("touchend", function (e) {
      if (startY === null) return;
      var dy = e.changedTouches[0].clientY - startY;
      if (dy > 120 && els.drawerBody.scrollTop <= 0) closeDrawer();
      startY = null;
    }, { passive: true });
  }

  function trapFocus(e) {
    var focusables = els.drawer.querySelectorAll("button, [href], audio, details, summary");
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (!els.drawer.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------------------------------------------------
     启动
     --------------------------------------------------------- */
  function boot() {
    els = {
      scene: $("#scene"),
      stageFit: $("#stageFit"),
      panHint: $("#panHint"),
      sceneArt: $("#sceneArt"),
      speech: $("#speech"),
      drawer: $("#drawer"),
      drawerBody: $("#drawerBody"),
      scrim: $("#drawerScrim"),
      lightbox: $("#lightbox"),
      lightboxImg: $("#lightboxImg"),
      lightboxCap: $("#lightboxCap"),
      ambient: $("#ambient")
    };

    els.sceneArt.addEventListener("load", function () { queueFit(); });
    els.stageFit.addEventListener("scroll", function () {
      var moved = Math.abs(els.stageFit.scrollLeft - (state.baseScroll || 0));
      if (moved > 24 && !state.panned) {
        state.panned = true;
        updatePanHint();
      }
    }, { passive: true });
    window.addEventListener("resize", queueFit);
    window.addEventListener("orientationchange", queueFit);

    restore();
    buildPhotoRegistry();
    renderIntro();
    bindEvents();

    state.phaseId = phaseFor(state.found.length).id;
    document.body.dataset.phase = phaseFor(state.found.length).overlay || state.phaseId;

    renderScene();
    showView("intro");

    $("#deskNote").textContent = "照片会留在这台浏览器里。想带走，就导出一张图。";

    // 图都加载完再淡入封面（避免先看到空框）
    window.requestAnimationFrame(function () { document.body.classList.add("is-ready"); });

    // 可以直接链接到房间 / 照片桌： index.html#room  index.html#desk
    var hash = (window.location.hash || "").replace("#", "");
    if (hash === "room" || hash === "desk") {
      enterRoom();
      if (hash === "desk") showView("desk");
    }
  }

  // 给 collage.js 用
  window.Memoir = {
    getPhotos: function () { return photoList.slice(); },
    openLightbox: openLightbox,
    showView: showView,
    isFound: function (key) { return state.found.indexOf(key) !== -1; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
