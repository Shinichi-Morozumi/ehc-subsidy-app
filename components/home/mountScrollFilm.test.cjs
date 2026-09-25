/* v1 / 2026-09-17. Controller regression tests, not browser/video-decoder evidence.
   Run: node --test components/home/mountScrollFilm.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "mountScrollFilm.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox, { filename: "mountScrollFilm.ts" });
const { mountScrollFilm } = sandbox.exports;

function fixture({ width = 390, height = 844, reduced = false, saveData = false, hidden = false } = {}) {
  const env = { width, height, reduced, saveData, hidden, scroll: 0, offscreen: false, copy: 470 };
  const queue = new Map();
  let nextId = 0;
  class Element extends EventTarget {
    constructor(bounds = () => ({ top: 72, bottom: 500, left: 0, right: width, width, height: 428 })) {
      super();
      this.dataset = {};
      this.properties = {};
      this.style = { setProperty: (key, value) => { this.properties[key] = value; } };
      this.hidden = false;
      this.attributes = {};
      this.bounds = bounds;
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    getBoundingClientRect() { return this.bounds(); }
  }
  class Video extends Element {
    constructor() {
      super(() => {
        const videoTop = env.offscreen ? -800 : Math.max(72, 72 + (env.width <= 1023 ? env.copy : 40) - env.scroll);
        return { top: videoTop, bottom: videoTop + 200, left: 20, right: env.width - 20, width: env.width - 40, height: 200 };
      });
      this.paused = true;
      this.seeking = false;
      this.readyState = 0;
      this.duration = 15;
      this.time = 0;
      this.playCalls = 0;
      this.loadCalls = 0;
      this.src = "";
      this.ended = false;
    }
    get currentTime() { return this.time; }
    set currentTime(value) { this.time = value; this.seeking = true; this.ended = false; }
    pause() { this.paused = true; }
    play() {
      this.playCalls++;
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    }
    load() { this.loadCalls++; }
    removeAttribute(key) { if (key === "src") this.src = ""; }
  }
  const view = new EventTarget();
  Object.defineProperties(view, {
    innerWidth: { get: () => env.width },
    innerHeight: { get: () => env.height },
  });
  const connection = new EventTarget();
  Object.defineProperty(connection, "saveData", { get: () => env.saveData });
  view.navigator = { connection };
  const medias = new Map();
  view.matchMedia = query => {
    if (!medias.has(query)) {
      const media = new EventTarget();
      Object.defineProperty(media, "matches", { get: () => {
        if (query.includes("prefers-reduced")) return env.reduced;
        if (query.includes("min-width")) return env.width >= 280 && env.height >= 420;
        if (query.includes("1023")) return env.width <= 1023 || env.height <= 650;
        return env.width <= 767;
      } });
      media.addListener = callback => media.addEventListener("change", callback);
      media.removeListener = callback => media.removeEventListener("change", callback);
      medias.set(query, media);
    }
    return medias.get(query);
  };
  view.requestAnimationFrame = callback => { queue.set(++nextId, callback); return nextId; };
  view.cancelAnimationFrame = id => queue.delete(id);
  // Timeouts are intentionally inert: these tests exercise explicit media/visibility events.
  view.setTimeout = () => ++nextId;
  view.clearTimeout = () => {};
  const document = new EventTarget();
  document.defaultView = view;
  Object.defineProperty(document, "hidden", { get: () => env.hidden });
  const root = new Element(() => ({ top: 72 - env.scroll, bottom: 72 + env.copy + 350 + run() - env.scroll, height: env.copy + 350 + run() }));
  root.ownerDocument = document;
  const stage = new Element(() => ({ height: env.height + 200 })); // Deliberately cannot fit.
  const sentinel = new Element(() => ({ top: 72 + env.copy - env.scroll, height: 0 }));
  const toggle = new Element();
  const replay = new Element();
  let video;
  let dispose;
  function mount() {
    video = new Video();
    dispose = mountScrollFilm({ root, stage, sentinel, video, toggle, replay, desktopSrc: "desktop.mp4", mobileSrc: "mobile.mp4", stickyTop: 72 });
  }
  function run() { return Number.parseFloat(root.properties["--ehc-film-run"]) || 0; }
  function frames({ finishSeek = true } = {}) {
    for (let iteration = 0; iteration < 40; iteration++) {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback();
      if (finishSeek && video.seeking) {
        video.seeking = false;
        video.dispatchEvent(new Event("seeked"));
      }
      if (!queue.size && (!finishSeek || !video.seeking)) return;
    }
    assert.fail("animation frame loop failed to settle");
  }
  function ready() { video.readyState = 2; video.dispatchEvent(new Event("loadeddata")); frames(); }
  function progress(value) {
    env.scroll = (env.width <= 1023 || env.height <= 650 ? env.copy : 0) + run() * value;
    view.dispatchEvent(new Event("scroll"));
    frames();
  }
  function visibility(value) {
    env.hidden = value;
    document.dispatchEvent(new Event("visibilitychange"));
    frames();
  }
  function resize(w, h) { env.width = w; env.height = h; view.dispatchEvent(new Event("resize")); frames(); }
  mount();
  frames();
  return { env, root, toggle, replay, view, document, connection, medias, run, ready, frames, progress, visibility, resize,
    get video() { return video; },
    pauseSite(value) { dispose.setPaused(value); frames(); },
    setStickyTop(value) { dispose.setStickyTop(value); frames(); },
    remount() { dispose(); mount(); frames(); },
    dispose() { dispose(); },
  };
}

test("normal mobile scrolling seeks without auto-playing even when full stage is too tall", () => {
  for (const [width, height] of [[320, 568], [390, 844], [420, 900], [1280, 720]]) {
    const h = fixture({ width, height });
    h.ready();
    h.progress(0.5);
    assert.equal(h.root.dataset.mode, "scroll");
    assert.ok(h.video.currentTime > 7 && h.video.currentTime < 8);
    assert.equal(h.video.playCalls, 0);
    assert.equal(h.video.paused, true);
    h.dispose();
  }
});

test("pause freezes the image and preserves runway; resume keeps scroll control", () => {
  const h = fixture();
  h.ready();
  h.progress(0.3);
  const travel = h.run();
  const time = h.video.currentTime;
  h.toggle.dispatchEvent(new Event("click"));
  h.progress(0.8);
  assert.equal(h.run(), travel);
  assert.equal(h.video.currentTime, time);
  assert.equal(h.root.dataset.mode, "scroll");
  assert.equal(h.toggle.textContent, "動きを再開する");
  h.toggle.dispatchEvent(new Event("click"));
  h.frames();
  assert.ok(h.video.currentTime > 11);
  assert.equal(h.video.playCalls, 0);
  h.dispose();
});

test("completion latches across reverse scrolling, resize and remount, retaining pause", () => {
  const h = fixture();
  h.ready();
  h.progress(1);
  assert.equal(h.root.dataset.ambientReady, "true");
  const end = h.video.currentTime;
  const travel = h.run();
  assert.equal(h.root.dataset.completed, "true");
  assert.equal(h.root.dataset.wind, "on");
  h.progress(0.2);
  h.resize(420, 900);
  assert.equal(h.video.currentTime, end);
  assert.equal(h.run(), travel);
  h.toggle.dispatchEvent(new Event("click"));
  h.remount();
  assert.equal(h.root.dataset.videoReady, "false");
  h.ready();
  assert.equal(h.video.currentTime, end);
  assert.equal(h.root.dataset.completed, "true");
  assert.equal(h.root.dataset.paused, "true");
  assert.equal(h.root.dataset.wind, "off");
  assert.equal(h.run(), travel);
  assert.equal(h.video.playCalls, 0);
  h.dispose();
});

test("wind stops immediately when hidden or offscreen and resumes only when allowed", () => {
  const h = fixture();
  h.ready();
  h.progress(1);
  h.visibility(true);
  assert.equal(h.root.dataset.ambientReady, "true", "pausing must not swap the completed artwork");
  assert.equal(h.root.dataset.wind, "off");
  h.visibility(false);
  assert.equal(h.root.dataset.wind, "on");
  h.env.offscreen = true;
  h.view.dispatchEvent(new Event("scroll"));
  h.frames();
  assert.equal(h.root.dataset.wind, "off");
  h.env.offscreen = false;
  h.view.dispatchEvent(new Event("scroll"));
  h.frames();
  assert.equal(h.root.dataset.wind, "on");
  h.toggle.dispatchEvent(new Event("click"));
  h.visibility(true);
  h.visibility(false);
  assert.equal(h.root.dataset.wind, "off");
  h.dispose();
});

test("only explicit replay plays the movie and replay pause retains geometry", () => {
  const h = fixture();
  h.ready();
  h.progress(1);
  const travel = h.run();
  h.replay.dispatchEvent(new Event("click"));
  h.frames();
  assert.equal(h.video.currentTime, 0);
  assert.equal(h.video.playCalls, 1);
  assert.equal(h.root.dataset.completed, "false");
  assert.equal(h.root.dataset.ambientReady, "false", "replay must hide the ambient layer");
  h.toggle.dispatchEvent(new Event("click"));
  h.frames();
  assert.equal(h.video.paused, true);
  assert.equal(h.run(), travel);
  assert.equal(h.root.dataset.replaying, "true");
  h.video.dispatchEvent(new Event("ended"));
  h.frames();
  assert.equal(h.root.dataset.completed, "true");
  h.dispose();
});

test("site pause preserves the already decoded final frame and hero pause choice", () => {
  const h = fixture();
  h.ready();
  h.progress(1);
  const end = h.video.currentTime;
  const src = h.video.src;
  const loads = h.video.loadCalls;
  h.setStickyTop(88);
  assert.equal(h.video.currentTime, end);
  assert.equal(h.video.loadCalls, loads);
  assert.equal(h.root.properties["--ehc-film-top"], "88px");
  h.pauseSite(true);
  assert.equal(h.video.currentTime, end);
  assert.equal(h.video.src, src);
  assert.equal(h.root.dataset.videoReady, "true");
  assert.equal(h.root.dataset.wind, "off");
  h.pauseSite(false);
  assert.equal(h.root.dataset.wind, "on");
  h.toggle.dispatchEvent(new Event("click"));
  h.pauseSite(true);
  h.pauseSite(false);
  assert.equal(h.root.dataset.paused, "true");
  assert.equal(h.root.dataset.wind, "off");
  h.dispose();
});

test("changing motion policy releases the media and restores the completed scene after re-enabling", () => {
  const h = fixture();
  h.ready();
  h.progress(1);
  const end = h.video.currentTime;
  h.env.saveData = true;
  h.connection.dispatchEvent(new Event("change"));
  h.frames();
  assert.equal(h.video.src, "");
  assert.equal(h.root.dataset.videoReady, "false");
  assert.equal(h.root.dataset.wind, "off");
  assert.equal(h.root.dataset.ambientReady, "false");
  assert.equal(h.root.dataset.completed, "true");
  h.env.saveData = false;
  h.connection.dispatchEvent(new Event("change"));
  h.frames();
  h.ready();
  assert.equal(h.video.currentTime, end);
  assert.equal(h.root.dataset.wind, "on");
  assert.equal(h.video.playCalls, 0);
  h.dispose();
});

test("reduced motion, Save-Data and initial hidden state do not request the movie", () => {
  for (const setup of [{ reduced: true }, { saveData: true }, { hidden: true }]) {
    const h = fixture(setup);
    assert.equal(h.video.src, "");
    assert.equal(h.video.loadCalls, 0);
    assert.equal(h.root.dataset.videoReady, "false");
    assert.equal(h.root.dataset.wind, "off");
    if (!setup.hidden) assert.equal(h.run(), 0);
    h.dispose();
  }
});

test("media failure keeps the existing travel and exposes the static poster", () => {
  const h = fixture();
  h.ready();
  h.progress(0.5);
  const travel = h.run();
  h.video.dispatchEvent(new Event("error"));
  h.frames();
  assert.equal(h.run(), travel);
  assert.equal(h.root.dataset.videoReady, "false");
  assert.equal(h.root.dataset.wind, "off");
  assert.equal(h.toggle.hidden, true);
  h.dispose();
});
