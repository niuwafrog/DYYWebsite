/* =========================================================
   collage.js —— 照片桌：拖动、旋转、缩放、导出
   内容来自 data/content.js 里每段记忆的 photos。
   ========================================================= */
(function () {
  "use strict";

  var KEY = "grandma-room.desk.v1";
  var STORE = "grandma-room.progress.v1";

  var items = [];       // { uid, src, caption, year, x, y, w, rot, z }
  var selectedUid = null;
  var zTop = 1;
  var uidSeed = 1;
  var board, tray, note;
  var drag = null;

  function $(s) { return document.querySelector(s); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- 存档 ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.filter(function (it) {
        return it && it.src && typeof it.x === "number" && typeof it.y === "number";
      }).map(function (it) {
        it.uid = it.uid || ("u" + (uidSeed++));
        it.z = it.z || 1;
        zTop = Math.max(zTop, it.z);
        return it;
      });
    } catch (e) { return []; }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.map(function (it) {
        return { uid: it.uid, src: it.src, caption: it.caption, year: it.year, x: it.x, y: it.y, w: it.w, rot: it.rot, z: it.z };
      })));
    } catch (e) { flash("浏览器不让存，这次的摆放可能会丢。"); }
  }

  function flash(msg) {
    if (!note) return;
    note.textContent = msg;
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(function () {
      note.textContent = "照片会留在这台浏览器里。想带走，就导出一张图。";
    }, 4000);
  }

  /* ---------------- 照片抽屉 ---------------- */
  function renderTray() {
    if (!tray) return;
    tray.textContent = "";
    var photos = window.Memoir ? window.Memoir.getPhotos() : [];
    if (!photos.length) {
      tray.appendChild(document.createElement("p"));
      return;
    }
    photos.forEach(function (p, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "把这张照片放到桌上：" + (p.caption || "照片"));
      var img = document.createElement("img");
      img.src = p.src;
      img.alt = "";
      img.loading = "lazy";
      btn.appendChild(img);
      btn.addEventListener("click", function () { addPhoto(p, i); });
      tray.appendChild(btn);
    });
  }

  function addPhoto(p, i) {
    var cascade = (i * 6) % 30;
    items.push({
      uid: "u" + (uidSeed++),
      src: p.src,
      caption: p.caption || "",
      year: p.year || "",
      x: clamp(30 + cascade, 10, 90),
      y: clamp(34 + cascade, 12, 88),
      w: 24,
      rot: [-6, 4, -2, 7, 0][i % 5],
      z: ++zTop
    });
    selectedUid = items[items.length - 1].uid;
    render();
    save();
  }

  /* ---------------- 画到桌上 ---------------- */
  function render() {
    if (!board) return;
    board.textContent = "";
    board.classList.toggle("has-items", items.length > 0);

    items.slice().sort(function (a, b) { return a.z - b.z; }).forEach(function (it) {
      board.appendChild(photoEl(it));
    });
    applySelection();
  }

  function photoEl(it) {
    var wrap = document.createElement("div");
    wrap.className = "photo";
    wrap.dataset.uid = it.uid;
    wrap.style.left = it.x + "%";
    wrap.style.top = it.y + "%";
    wrap.style.width = it.w + "%";
    wrap.style.transform = "translate(-50%,-50%) rotate(" + it.rot + "deg)";
    if (it.z) wrap.style.zIndex = String(it.z);

    var card = document.createElement("div");
    card.className = "photo__card";
    var img = document.createElement("img");
    img.src = it.src;
    img.alt = it.caption || "照片";
    img.draggable = false;
    card.appendChild(img);
    if (it.caption) {
      var cap = document.createElement("span");
      cap.textContent = it.caption;
      card.appendChild(cap);
    }
    wrap.appendChild(card);

    wrap.appendChild(handle("remove", function () { remove(it.uid); }));
    wrap.appendChild(handle("rotate", function () {}));
    wrap.appendChild(handle("scale", function () {}));

    wrap.addEventListener("pointerdown", function (e) { startDrag(e, it, "move"); });
    wrap.addEventListener("dblclick", function (e) {
      e.preventDefault();
      openBig(it);
    });
    wrap.addEventListener("pointerdown", function () { select(it.uid); });

    return wrap;
  }

  function handle(kind, onClick) {
    var h = document.createElement("button");
    h.type = "button";
    h.className = "photo__handle photo__handle--" + kind;
    h.setAttribute("aria-label", kind === "remove" ? "从桌上拿走这张照片" : kind === "scale" ? "缩放" : "旋转");
    h.textContent = kind === "remove" ? "×" : "";
    h.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      if (kind === "remove") return;
      var it = itemByUid(h.closest(".photo").dataset.uid);
      if (!it) return;
      startDrag(e, it, kind);
    });
    if (onClick) h.addEventListener("click", function (e) { e.stopPropagation(); onClick(); });
    return h;
  }

  function itemByUid(uid) {
    return items.filter(function (it) { return it.uid === uid; })[0];
  }

  function select(uid) {
    selectedUid = uid;
    var it = itemByUid(uid);
    if (it) { it.z = ++zTop; }
    applySelection();
    save();
  }

  function applySelection() {
    Array.prototype.forEach.call(board.querySelectorAll(".photo"), function (node) {
      node.classList.toggle("is-selected", node.dataset.uid === selectedUid);
    });
  }

  function remove(uid) {
    items = items.filter(function (it) { return it.uid !== uid; });
    if (selectedUid === uid) selectedUid = null;
    render();
    save();
  }

  function openBig(it) {
    var list = items.map(function (x) { return { src: x.src, caption: x.caption, year: x.year }; });
    var index = Math.max(0, list.findIndex(function (x) { return x.src === it.src; }));
    if (window.Memoir) window.Memoir.openLightbox(list, index);
  }

  /* ---------------- 拖动 / 缩放 / 旋转 ---------------- */
  function startDrag(e, it, mode) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    select(it.uid);

    var rect = board.getBoundingClientRect();
    var center = {
      x: rect.left + (it.x / 100) * rect.width,
      y: rect.top + (it.y / 100) * rect.height
    };
    drag = {
      mode: mode,
      it: it,
      rect: rect,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: it.x, y: it.y, w: it.w, rot: it.rot },
      startAngle: Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180 / Math.PI
    };
    (e.currentTarget || board).setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add("is-desk-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onMove(e) {
    if (!drag) return;
    var it = drag.it;
    var rect = drag.rect;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;

    if (drag.mode === "move") {
      it.x = clamp(drag.orig.x + (dx / rect.width) * 100, 4, 96);
      it.y = clamp(drag.orig.y + (dy / rect.height) * 100, 6, 94);
    } else if (drag.mode === "scale") {
      it.w = clamp(drag.orig.w + (dx / rect.width) * 100, 8, 72);
    } else if (drag.mode === "rotate") {
      var cx = rect.left + (it.x / 100) * rect.width;
      var cy = rect.top + (it.y / 100) * rect.height;
      var angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      var delta = angle - drag.startAngle;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      it.rot = Math.round(drag.orig.rot + delta);
    }

    var node = board.querySelector('.photo[data-uid="' + it.uid + '"]');
    if (node) {
      node.style.left = it.x + "%";
      node.style.top = it.y + "%";
      node.style.width = it.w + "%";
      node.style.transform = "translate(-50%,-50%) rotate(" + it.rot + "deg)";
    }
  }

  function onUp() {
    if (!drag) return;
    drag = null;
    document.body.classList.remove("is-desk-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    save();
  }

  /* ---------------- 导出 ---------------- */
  function exportPng() {
    if (!items.length) { flash("桌上还没有照片。"); return; }
    var rect = board.getBoundingClientRect();
    var scale = Math.min(2, 2400 / rect.width);
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    var ctx = canvas.getContext("2d");

    // 桌面底色
    var grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#c9b291");
    grad.addColorStop(1, "#b79a75");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var ordered = items.slice().sort(function (a, b) { return a.z - b.z; });
    var pending = ordered.map(function (it) {
      return loadImage(it.src).then(function (img) { return { it: it, img: img }; })
        .catch(function () { return { it: it, img: null }; });
    });

    Promise.all(pending).then(function (loaded) {
      loaded.forEach(function (pair) {
        var it = pair.it;
        var img = pair.img;
        if (!img) return;
        var w = (it.w / 100) * canvas.width;
        var h = w * (img.naturalHeight / img.naturalWidth);
        var cx = (it.x / 100) * canvas.width;
        var cy = (it.y / 100) * canvas.height;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((it.rot || 0) * Math.PI / 180);
        var pad = Math.max(4, w * 0.035);
        var capH = it.caption ? Math.max(14, w * 0.075) : 0;
        ctx.shadowColor = "rgba(40,26,14,.4)";
        ctx.shadowBlur = w * 0.06;
        ctx.shadowOffsetY = w * 0.02;
        ctx.fillStyle = "#fdfaf4";
        ctx.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2 + capH);
        ctx.shadowColor = "transparent";
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        if (it.caption) {
          ctx.fillStyle = "#6b5d52";
          ctx.font = Math.max(9, w * 0.032) + "px " + getComputedStyle(document.body).fontFamily;
          ctx.textAlign = "center";
          ctx.fillText(it.caption, 0, h / 2 + capH * 0.72, w);
        }
        ctx.restore();
      });

      try {
        var url = canvas.toDataURL("image/png");
        var a = document.createElement("a");
        a.href = url;
        a.download = "照片桌-" + new Date().toISOString().slice(0, 10) + ".png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        flash("导出好了，看看下载文件夹。");
      } catch (e) {
        flash("这个浏览器不让导出（本地直接打开时常见）。用 http://localhost 打开就能导出。");
      }
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    board = $("#deskBoard");
    tray = $("#deskTray");
    note = $("#deskNote");
    if (!board) return;

    items = load();
    renderTray();
    render();

    $("#deskClear").addEventListener("click", function () {
      if (!items.length) return;
      if (!window.confirm("把桌上的照片全部收起来？")) return;
      items = [];
      selectedUid = null;
      render();
      save();
    });
    $("#deskExport").addEventListener("click", exportPng);

    board.addEventListener("pointerdown", function (e) {
      if (e.target === board) { selectedUid = null; applySelection(); }
    });

    document.addEventListener("keydown", function (e) {
      if (document.body.dataset.view !== "desk") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedUid) {
        e.preventDefault();
        remove(selectedUid);
      }
      if (e.key === "Escape" && selectedUid) { selectedUid = null; applySelection(); }
    });
  }

  window.Desk = { render: function () { renderTray(); render(); } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
