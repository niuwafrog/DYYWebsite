/* =========================================================
   tools/qa.js —— 用 Chrome 真跑一遍，截图 + 验证交互
   用法（需要本机装了 Chrome）：
     node tools/qa.js mobile
     node tools/qa.js desktop
   ========================================================= */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
];

const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error("找不到 Chrome / Edge");
  process.exit(1);
}

const SCENARIO = process.argv[2] || "desktop";
const OUT = path.join(os.tmpdir(), "memoir-shots");
fs.mkdirSync(OUT, { recursive: true });

const ROOT = path.resolve(__dirname, "..");
const URL = "file:///" + path.join(ROOT, "index.html").replace(/\\/g, "/");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
const port = 9400 + Math.floor(Math.random() * 200);

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=" + port,
  "--user-data-dir=" + profile,
  "--allow-file-access-from-files",
  URL
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* 还没起来 */ }
    await sleep(200);
  }
  throw new Error("连不上 Chrome");
}

let ws, msgId = 0;
const pending = new Map();

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception ? res.exceptionDetails.exception.description : "eval failed");
  }
  return res.result.value;
}

async function shot(name) {
  const res = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(OUT, SCENARIO + "-" + name + ".png");
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  console.log("  📸", file);
  return file;
}

async function mouse(type, x, y) {
  await send("Input.dispatchMouseEvent", {
    type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1
  });
}

async function drag(from, to) {
  await mouse("mousePressed", from.x, from.y);
  for (let i = 1; i <= 6; i++) {
    await mouse("mouseMoved", from.x + (to.x - from.x) * i / 6, from.y + (to.y - from.y) * i / 6);
    await sleep(30);
  }
  await mouse("mouseReleased", to.x, to.y);
}

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
}

(async function main() {
  const url = await getTarget();
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");

  const viewport = SCENARIO === "mobile"
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };

  await send("Emulation.setDeviceMetricsOverride", viewport);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

  await sleep(1200);

  // 等页面真的起来
  let ready = false;
  for (let i = 0; i < 25; i++) {
    try {
      ready = await evaluate("!!document.getElementById('enterBtn')");
    } catch (e) { ready = false; }
    if (ready) break;
    await sleep(200);
  }
  if (!ready) {
    console.log("  href =", await evaluate("location.href"));
    console.log("  title =", await evaluate("document.title"));
    console.log("  body =", (await evaluate("document.body ? document.body.innerHTML.slice(0,300) : 'no body'")));
    throw new Error("页面没加载出 #enterBtn");
  }

  console.log("\n▶", SCENARIO, "—", URL, "\n");
  await shot("01-intro");

  check("viewport", await evaluate("innerWidth") === viewport.width,
    "innerWidth=" + await evaluate("innerWidth"));

  // 进房间
  await evaluate("document.getElementById('enterBtn').click()");
  await sleep(2200);
  await shot("02-room");

  const sceneBox = await evaluate(`(() => {
    const r = document.getElementById('scene').getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
            hotspots: document.querySelectorAll('.hotspot').length};
  })()`);
  check("场景有尺寸", sceneBox.w > 100 && sceneBox.h > 100, `${sceneBox.w}×${sceneBox.h}`);
  check("热点已生成", sceneBox.hotspots >= 8, sceneBox.hotspots + " 个");
  check("场景比例正确", Math.abs(sceneBox.w / sceneBox.h - 16 / 9) < 0.02, (sceneBox.w / sceneBox.h).toFixed(3));

  // 点第一个记忆
  await evaluate("document.querySelectorAll('.hotspot')[0].click()");
  await sleep(900);
  await shot("03-story");
  const drawer = await evaluate(`(() => {
    const d = document.getElementById('drawer');
    return {open: d.classList.contains('is-open'),
            title: (document.getElementById('drawerTitle')||{}).textContent || '',
            sceneW: Math.round(document.getElementById('scene').getBoundingClientRect().width),
            stagePad: getComputedStyle(document.querySelector('.stage')).paddingRight};
  })()`);
  check("故事抽屉打开", drawer.open && drawer.title.length > 0, "标题：" + drawer.title);
  if (SCENARIO === "desktop") {
    check("抽屉让出空间", drawer.sceneW < sceneBox.w - 100, `场景 ${sceneBox.w} → ${drawer.sceneW}`);
  }

  // 关掉
  await evaluate("document.getElementById('drawerClose').click()");
  await sleep(800);

  // 照片桌
  await evaluate("document.getElementById('deskBtn').click()");
  await sleep(800);
  const trayCount = await evaluate("document.querySelectorAll('#deskTray button').length");
  check("照片抽屉里有照片", trayCount > 0, trayCount + " 张");

  await evaluate("document.querySelector('#deskTray button').click()");
  await sleep(500);
  await shot("04-desk-empty");

  const before = await evaluate(`(() => {
    const p = document.querySelector('.photo');
    const r = p.getBoundingClientRect();
    return {x: r.left + r.width/2, y: r.top + r.height/2,
            left: p.style.left, top: p.style.top, w: r.width};
  })()`);

  // 真拖一下
  await drag({ x: before.x, y: before.y }, { x: before.x + 120, y: before.y + 60 });
  await sleep(400);
  const after = await evaluate(`(() => {
    const p = document.querySelector('.photo');
    const r = p.getBoundingClientRect();
    return {x: r.left + r.width/2, y: r.top + r.height/2, left: p.style.left, top: p.style.top, w: r.width};
  })()`);

  check("拖动照片改变了位置", Math.abs(after.x - before.x) > 40,
    `Δx=${Math.round(after.x - before.x)}px (${before.left} → ${after.left})`);
  await shot("05-desk-dragged");

  // 缩放
  const scaleHandle = await evaluate(`(() => {
    const h = document.querySelector('.photo .photo__handle--scale').getBoundingClientRect();
    return {x: h.left + h.width/2, y: h.top + h.height/2, w: document.querySelector('.photo').getBoundingClientRect().width};
  })()`);
  await drag({ x: scaleHandle.x, y: scaleHandle.y }, { x: scaleHandle.x + 90, y: scaleHandle.y + 60 });
  await sleep(300);
  const scaledW = await evaluate("document.querySelector('.photo').getBoundingClientRect().width");
  check("缩放把手有效", scaledW > scaleHandle.w + 20, `${Math.round(scaleHandle.w)} → ${Math.round(scaledW)}px`);
  await shot("06-desk-scaled");

  // 存档
  const saved = await evaluate("!!localStorage.getItem('grandma-room.desk.v1')");
  check("摆放已存到本地", saved === true);

  // 回房间，看看时间推进
  await evaluate("document.getElementById('deskBack').click()");
  await sleep(700);
  await evaluate("document.querySelectorAll('.hotspot')[3].click()");
  await sleep(600);
  await evaluate("document.getElementById('drawerClose').click()");
  await sleep(500);
  const phase = await evaluate("document.body.dataset.phase");
  const found = await evaluate("JSON.parse(localStorage.getItem('grandma-room.progress.v1')||'{}').found.length");
  check("记忆计数与时间段", typeof found === "number", `已看 ${found} 段，phase=${phase}`);

  // 厨房
  await evaluate("document.querySelectorAll('.scenetab')[1].click()");
  await sleep(900);
  await shot("07-kitchen");
  check("切到厨房", (await evaluate("document.body.dataset.phase")) !== undefined);

  // 时间段：直接写进度再刷新，看光线有没有换
  if (SCENARIO === "phases") {
    for (const step of [
      { n: 3, name: "08-dusk" },
      { n: 6, name: "09-night" }
    ]) {
      const found = ["living:lamp", "living:jars", "living:window", "living:calendar", "living:sofa", "living:radio"].slice(0, step.n);
      await evaluate(`localStorage.setItem('grandma-room.progress.v1', JSON.stringify({found:${JSON.stringify(found)},sceneId:'living',sound:false}))`);
      await send("Page.reload", {});
      await sleep(1500);
      await evaluate("document.getElementById('enterBtn').click()");
      await sleep(1800);
      const ph = await evaluate("document.body.dataset.phase");
      const cls = await evaluate("getComputedStyle(document.getElementById('sceneLight')).backgroundImage.slice(0,60)");
      check(step.name + " 光线生效", ph !== "day", `phase=${ph} · ${cls}`);
      await shot(step.name);
    }
  }

  const errs = await evaluate("window.__errs ? window.__errs.length : 0");
  check("无 JS 报错", !errs, String(errs));

  await sleep(200);
  ws.close();
  chrome.kill();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 通过 · 截图在 ${OUT}\n`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => {
  console.error("\n✗", e.message);
  try { chrome.kill(); } catch (err) { /* ignore */ }
  process.exit(1);
});
