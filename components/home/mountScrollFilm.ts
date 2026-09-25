/* v2 / 2026-09-17 — One scroll-linked transformation per document visit.
   A normal-flow sentinel owns progress; control labels never select the mode.
   Only explicit replay calls play(). The completed scene keeps light wind. */

export interface ScrollFilmOptions {
  root: HTMLElement;
  stage: HTMLElement;
  sentinel: HTMLElement;
  video: HTMLVideoElement;
  toggle: HTMLButtonElement;
  replay?: HTMLElement | null;
  desktopSrc: string;
  mobileSrc: string;
  stickyTop?: number;
  fps?: number;
  /** Site-wide pause preserves the hero's own pause and its scroll distance. */
  paused?: boolean;
}

type DataConnection = EventTarget & { saveData?: boolean };
type FilmVisit = {
  completed: boolean;
  userPaused: boolean;
  progress: number;
  replaying: boolean;
  run: number;
};

// Home unmounts during diagnosis. This memory lasts only for the current document.
const visits = new WeakMap<Document, Map<string, FilmVisit>>();

export interface MountedScrollFilm {
  (): void;
  setPaused(paused: boolean): void;
  setStickyTop(top: number): void;
}

export function mountScrollFilm(options: ScrollFilmOptions): MountedScrollFilm {
  const { root, stage, sentinel, video, toggle, desktopSrc, mobileSrc } = options;
  const replay = options.replay ?? null;
  const document = root.ownerDocument;
  const ownerView = document.defaultView;
  if (!ownerView) return Object.assign(() => {}, { setPaused: () => {}, setStickyTop: () => {} });
  const view = ownerView;
  let top = Math.max(0, Number.isFinite(options.stickyTop) ? options.stickyTop! : 0);
  const fps = options.fps && options.fps > 0 && Number.isFinite(options.fps) ? options.fps : 24;
  const reduced = view.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollSpace = view.matchMedia("(min-width: 280px) and (min-height: 420px)");
  const visualOnly = view.matchMedia("(max-width: 1023px), (max-height: 650px)");
  const connection = (view.navigator as Navigator & { connection?: DataConnection }).connection;
  const mobile = view.matchMedia("(max-width: 767px)").matches;
  const source = mobile ? mobileSrc : desktopSrc;
  const visitKey = desktopSrc + "\n" + mobileSrc;
  let documentVisits = visits.get(document);
  if (!documentVisits) {
    documentVisits = new Map();
    visits.set(document, documentVisits);
  }
  let visit = documentVisits.get(visitKey);
  if (!visit) {
    visit = {
      completed: false,
      userPaused: false,
      progress: 0,
      replaying: false,
      // Freeze travel: mobile browser chrome, resize and labels cannot change it.
      run: mobile
        ? Math.min(720, Math.max(420, view.innerHeight * 0.8))
        : Math.min(1200, Math.max(720, view.innerHeight * 1.25)),
    };
    documentVisits.set(visitKey, visit);
  }
  const state = visit;
  let disposed = false;
  let attached = false;
  let ready = false;
  let frameReady = false;
  let failed = false;
  let playPending = false;
  let seeking = false;
  let shown = false;
  let near = false;
  let wanted = 0;
  let raf = 0;
  let loadTimer = 0;
  let seekTimer = 0;
  let restoreFrame = true;
  let sitePaused = options.paused === true;

  const blocked = () => reduced.matches || connection?.saveData === true;
  const paused = () => state.userPaused || sitePaused;
  const endTime = () => Math.max(0, video.duration - 1 / fps);
  const clearSeekTimer = () => { view.clearTimeout(seekTimer); seekTimer = 0; };
  const schedule = () => {
    if (!disposed && !raf) raf = view.requestAnimationFrame(update);
  };

  root.style.setProperty("--ehc-film-top", top + "px");
  root.dataset.videoReady = "false";
  root.dataset.wind = "off";
  root.dataset.ambientReady = "false";
  toggle.hidden = true;
  if (replay) replay.hidden = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = false;
  video.pause();

  function layout() {
    // Small-screen CSS pins the visual only. Content height cannot flip the mode.
    const scrolling = !blocked() && scrollSpace.matches;
    root.dataset.mode = scrolling ? "scroll" : "static";
    root.style.setProperty("--ehc-film-run", scrolling ? state.run + "px" : "0px");
    return scrolling;
  }

  function paintState(visible: boolean) {
    const permitted = ready && !failed && !blocked();
    root.dataset.videoReady = permitted && frameReady ? "true" : "false";
    root.dataset.completed = state.completed ? "true" : "false";
    root.dataset.paused = paused() ? "true" : "false";
    root.dataset.replaying = state.replaying ? "true" : "false";
    const ambientReady = permitted && frameReady && state.completed && !seeking
      && Math.abs(video.currentTime - endTime()) < 1 / fps && !state.replaying;
    root.dataset.ambientReady = ambientReady ? "true" : "false";
    root.dataset.wind = ambientReady && !paused() && visible && !document.hidden ? "on" : "off";
    toggle.hidden = !permitted;
    toggle.textContent = paused() ? "動きを再開する" : "動きを止める";
    toggle.setAttribute("aria-pressed", paused() ? "true" : "false");
    if (replay) replay.hidden = !(permitted && state.completed);
  }

  function fail() {
    if (disposed || failed) return;
    failed = true;
    ready = false;
    frameReady = false;
    view.clearTimeout(loadTimer);
    clearSeekTimer();
    video.pause();
    if (attached) { video.removeAttribute("src"); video.load(); }
    // A download failure must not remove travel and move the reader's page.
    paintState(false);
  }

  function attachSource() {
    if (attached || failed || blocked() || sitePaused || document.hidden || !near) return;
    if (!scrollSpace.matches && !state.completed) return;
    if (!source.trim()) { fail(); return; }
    attached = true;
    video.preload = "auto";
    video.src = source;
    loadTimer = view.setTimeout(() => { if (!ready) fail(); }, 20000);
    video.load();
  }

  function armSeekTimer() {
    clearSeekTimer();
    if (document.hidden || !seeking) return;
    seekTimer = view.setTimeout(() => {
      seekTimer = 0;
      if (document.hidden) return;
      if (!video.seeking && video.readyState >= 2) onSeeked();
      else fail();
    }, 8000);
  }

  function flushSeek() {
    if (!ready || failed || blocked() || seeking || video.seeking || document.hidden) return;
    if (Math.abs(video.currentTime - wanted) < 0.5 / fps) {
      frameReady = true;
      restoreFrame = false;
      return;
    }
    seeking = true;
    try {
      video.currentTime = wanted;
      armSeekTimer();
    } catch {
      seeking = false;
      fail();
    }
  }

  function syncPlayback(visible: boolean) {
    const canPlay = state.replaying && ready && frameReady && !failed && !blocked()
      && !paused() && visible && !document.hidden;
    if (!canPlay) {
      if (!video.paused) video.pause();
      return;
    }
    if (!video.paused || video.ended || playPending || seeking || video.seeking) return;
    playPending = true;
    const started = video.play();
    if (started && typeof started.then === "function") {
      started.then(
        () => {
          playPending = false;
          if (disposed || document.hidden || paused() || blocked() || !shown) video.pause();
        },
        () => {
          playPending = false;
          if (disposed) return;
          state.userPaused = true;
          schedule();
        },
      );
    } else playPending = false;
  }

  function exposure() {
    const rect = video.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) return 0;
    const visibleHeight = Math.max(0, Math.min(rect.bottom, view.innerHeight) - Math.max(rect.top, top));
    const visibleWidth = Math.max(0, Math.min(rect.right, view.innerWidth) - Math.max(rect.left, 0));
    return (visibleHeight * visibleWidth) / (rect.height * rect.width);
  }

  function update() {
    raf = 0;
    if (disposed) return;
    const scrolling = layout();
    if (blocked() && attached) {
      // A preference changed after loading: release the resource as well as its animation.
      view.clearTimeout(loadTimer);
      clearSeekTimer();
      video.pause();
      attached = false;
      ready = false;
      frameReady = false;
      seeking = false;
      restoreFrame = true;
      video.removeAttribute("src");
      video.load();
    }
    if (document.hidden) {
      video.pause();
      paintState(false);
      return;
    }
    const bounds = root.getBoundingClientRect();
    const seen = exposure();
    if (!shown && seen >= 0.45) shown = true;
    else if (shown && seen < 0.25) shown = false;
    near = near || (bounds.top < view.innerHeight + 240 && bounds.bottom > -240);
    attachSource();

    if (ready && !failed && !blocked()) {
      if (restoreFrame) {
        wanted = (state.completed ? 1 : state.progress) * endTime();
        flushSeek();
        // Restoring frame zero does not fire seeked; continue measuring scroll next frame.
        if (!restoreFrame && !paused()) schedule();
      } else if (!state.replaying && !paused() && scrolling) {
        const start = visualOnly.matches ? sentinel.getBoundingClientRect().top : bounds.top;
        const progress = Math.min(1, Math.max(0, (top - start) / state.run));
        if (!state.completed && progress >= 0.995) state.completed = true;
        state.progress = state.completed ? 1 : progress;
        wanted = state.progress * endTime();
        // Completion can latch offscreen; decoding waits until the visual is visible.
        if (shown) flushSeek();
      }
    }
    paintState(shown);
    syncPlayback(shown);
  }

  function onReady() {
    if (disposed || !attached || failed || video.readyState < 2
      || !Number.isFinite(video.duration) || video.duration <= 0) return;
    ready = true;
    view.clearTimeout(loadTimer);
    schedule();
  }

  function onSeeked() {
    seeking = false;
    clearSeekTimer();
    if (Math.abs(video.currentTime - wanted) < 1 / fps) {
      frameReady = true;
      restoreFrame = false;
    }
    schedule();
  }

  function onTimeUpdate() {
    if (state.replaying && ready) state.progress = Math.min(1, video.currentTime / endTime());
  }

  function onEnded() {
    state.replaying = false;
    state.completed = true;
    state.progress = 1;
    schedule();
  }

  function onToggle() {
    if (blocked() || failed || !ready || sitePaused) return;
    state.userPaused = !state.userPaused;
    if (state.userPaused) video.pause();
    paintState(shown);
    schedule();
  }

  function onReplay() {
    if (blocked() || failed || !ready || !state.completed || sitePaused) return;
    video.pause();
    state.completed = false;
    state.replaying = true;
    state.userPaused = false;
    state.progress = 0;
    frameReady = false;
    restoreFrame = true;
    wanted = 0;
    paintState(shown);
    schedule();
  }

  function onVisibility() {
    clearSeekTimer();
    view.clearTimeout(loadTimer);
    if (document.hidden) {
      video.pause();
      paintState(false);
      return;
    }
    if (seeking && !video.seeking) seeking = false;
    if (video.seeking) { seeking = true; armSeekTimer(); }
    if (attached && !ready && !failed) loadTimer = view.setTimeout(() => { if (!ready) fail(); }, 20000);
    schedule();
  }

  function onError() { if (attached) fail(); }
  function keepPaused() {
    if (!state.replaying || paused() || document.hidden || blocked() || !shown) video.pause();
  }

  video.addEventListener("loadedmetadata", onReady);
  video.addEventListener("loadeddata", onReady);
  video.addEventListener("canplay", onReady);
  video.addEventListener("seeked", onSeeked);
  video.addEventListener("timeupdate", onTimeUpdate);
  video.addEventListener("ended", onEnded);
  video.addEventListener("error", onError);
  video.addEventListener("play", keepPaused);
  toggle.addEventListener("click", onToggle);
  replay?.addEventListener("click", onReplay);
  document.addEventListener("visibilitychange", onVisibility);
  view.addEventListener("scroll", schedule, { passive: true });
  view.addEventListener("resize", schedule, { passive: true });
  view.visualViewport?.addEventListener("resize", schedule, { passive: true });
  if (reduced.addEventListener) reduced.addEventListener("change", schedule);
  else reduced.addListener(schedule);
  connection?.addEventListener("change", schedule);

  const sizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
  sizeObserver?.observe(stage);
  layout();
  paintState(false);
  schedule();

  return Object.assign(() => {
    disposed = true;
    view.cancelAnimationFrame(raf);
    view.clearTimeout(loadTimer);
    clearSeekTimer();
    sizeObserver?.disconnect();
    view.removeEventListener("scroll", schedule);
    view.removeEventListener("resize", schedule);
    view.visualViewport?.removeEventListener("resize", schedule);
    if (reduced.removeEventListener) reduced.removeEventListener("change", schedule);
    else reduced.removeListener(schedule);
    connection?.removeEventListener("change", schedule);
    video.removeEventListener("loadedmetadata", onReady);
    video.removeEventListener("loadeddata", onReady);
    video.removeEventListener("canplay", onReady);
    video.removeEventListener("seeked", onSeeked);
    video.removeEventListener("timeupdate", onTimeUpdate);
    video.removeEventListener("ended", onEnded);
    video.removeEventListener("error", onError);
    video.removeEventListener("play", keepPaused);
    toggle.removeEventListener("click", onToggle);
    replay?.removeEventListener("click", onReplay);
    document.removeEventListener("visibilitychange", onVisibility);
    video.pause();
    if (attached) { video.removeAttribute("src"); video.load(); }
    root.dataset.videoReady = "false";
    root.dataset.wind = "off";
    root.dataset.ambientReady = "false";
    toggle.hidden = true;
    if (replay) replay.hidden = true;
    // Diagnosis navigation and the site pause do not reset geometry or visit memory.
  }, {
    setPaused(value: boolean) {
      if (disposed) return;
      sitePaused = value;
      if (value) video.pause();
      paintState(shown);
      schedule();
    },
    setStickyTop(value: number) {
      if (disposed) return;
      top = Math.max(0, Number.isFinite(value) ? value : 0);
      root.style.setProperty("--ehc-film-top", top + "px");
      schedule();
    },
  });
}
