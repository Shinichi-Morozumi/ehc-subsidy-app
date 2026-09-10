"use client";

/**
 * v1 / 2026-09-08  EHC-0027
 * v17設計原案に付属していた 3本の素のJS
 *   v16_…_EHC-0025_section-motion.js（スクロール登場演出）
 *   v17_…_EHC-0026_card-stack.js（3枚カードの重なり）
 *   v17設計HTML内の hero/entry 動画制御
 * を、Reactのフックとして移植したもの。
 *
 * いずれも「装飾」であり、診断ロジック・数値・APIには一切関与しない。
 * 失敗しても内容が隠れないよう、全て try / 早期return で握りつぶす。
 * document.body ではなく、スコープ用ルート要素（.ehc17）を基準にする。
 */

import { useEffect, type RefObject } from "react";

type Kind = "rise" | "card" | "paper";
type Spec = { kind?: Kind; delay?: number; step?: number; duration?: number };
type Record_ = { kind: Kind; delay: number; duration: number; seen: boolean; inview: boolean };

const BASE_SPECS: Array<[string, Spec]> = [
  [".flow-heading", { duration: 850 }],
  [".flow-list>li", { delay: 60, step: 110 }],
  [".report-chapter-heading>.chapter-eyebrow", { duration: 700 }],
  ["#report-title>span", { delay: 70, duration: 900 }],
  ["#report-title>em", { delay: 180, duration: 1050 }],
  [".report-chapter-heading>.chapter-lead", { delay: 240 }],
  [".report-ease", { delay: 300 }],
  [".report-preview-caption", { delay: 100 }],
  [".report-stage", { kind: "paper", delay: 190, duration: 1250 }],
  [".report-usecases>li", { kind: "card", delay: 60, step: 110, duration: 900 }],
  [".decision-copy>.chapter-eyebrow", { duration: 700 }],
  [".decision-copy>h2", { delay: 80, duration: 950 }],
  [".decision-copy>.chapter-lead,.decision-copy>.decision-body", { delay: 170, step: 80 }],
  [".decision-visual>figcaption", { delay: 90 }],
  [".order-path>li", { kind: "card", delay: 140, step: 100 }],
  [".decision-tip", { delay: 240 }],
  [
    ".discover-intro>.section-label,.discover-intro>h2,.discover-intro>p:not(.section-label)",
    { delay: 50, step: 100, duration: 900 },
  ],
];

const FRAMES: Record<Kind, Keyframe[]> = {
  paper: [
    { opacity: 0.18, transform: "translate3d(0,38px,0) rotate(2.4deg) scale(.965)" },
    { opacity: 1, transform: "translate3d(0,0,0) rotate(0) scale(1)" },
  ],
  card: [
    { opacity: 0.22, transform: "translate3d(0,24px,0) scale(.98)" },
    { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
  ],
  rise: [
    { opacity: 0.12, transform: "translate3d(0,23px,0)" },
    { opacity: 1, transform: "translate3d(0,0,0)" },
  ],
};

function saveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return !!nav.connection?.saveData;
}

/** ネットワーク設定の変化を購読する（未対応環境では何もしない） */
function watchConnection(handler: () => void): () => void {
  const nav = navigator as Navigator & {
    connection?: { addEventListener?: (t: string, h: () => void) => void; removeEventListener?: (t: string, h: () => void) => void };
  };
  nav.connection?.addEventListener?.("change", handler);
  return () => nav.connection?.removeEventListener?.("change", handler);
}

/* ------------------------------------------------------------------ */
/* 1. セクション登場演出                                                */
/* ------------------------------------------------------------------ */

export function useSectionMotion(
  rootRef: RefObject<HTMLElement | null>,
  opts: { paused: boolean; opening: boolean; replayKey: number }
) {
  const { paused, opening, replayKey } = opts;

  useEffect(() => {
    const home = rootRef.current;
    if (!home) return;
    if (!("IntersectionObserver" in window) || !Element.prototype.animate) return;

    const quiet = matchMedia("(prefers-reduced-motion: reduce)");
    const records = new Map<Element, Record_>();
    const running = new Map<Element, Animation>();
    let enabled = false;
    let queued = false;

    const permitted = () =>
      !quiet.matches && !saveData() && !document.hidden && !paused && !opening;

    const register = (selector: string, spec: Spec) => {
      const { kind = "rise", delay = 0, step = 0, duration = 800 } = spec;
      home.querySelectorAll(selector).forEach((el, i) => {
        if (records.has(el)) return;
        records.set(el, { kind, delay: delay + i * step, duration, seen: false, inview: false });
        (el as HTMLElement).dataset.ehcMotion = kind;
      });
    };

    BASE_SPECS.forEach(([sel, spec]) => register(sel, spec));
    home.querySelectorAll<HTMLElement>(".discovery-card").forEach((card) => {
      const id = card.id;
      if (!id) return;
      register(`#${id}>.card-heading`, { duration: 850 });
      register(`#${id}>.card-visual`, { kind: "card", delay: 120, duration: 1050 });
      register(`#${id}>h3`, { delay: 180, duration: 900 });
      register(`#${id}>p`, { delay: 230 });
    });

    const settle = (el: Element) => {
      const animation = running.get(el);
      if (animation) {
        running.delete(el);
        animation.cancel();
      }
    };

    const reveal = (el: Element, record: Record_) => {
      if (!enabled || record.seen || !record.inview) return;
      record.seen = true;
      (el as HTMLElement).dataset.ehcMotionPlayed = "1";
      try {
        const animation = el.animate(FRAMES[record.kind], {
          duration: record.duration,
          delay: record.delay,
          easing: "cubic-bezier(.18,.74,.22,1)",
          fill: "both",
        });
        running.set(el, animation);
        animation.onfinish = () => {
          if (running.get(el) === animation) {
            running.delete(el);
            animation.cancel();
          }
        };
      } catch {
        /* 装飾の失敗が本文を隠すことはない */
      }
    };

    const sync = () => {
      queued = false;
      enabled = permitted();
      home.classList.toggle("ehc-scroll-motion-allowed", enabled);
      if (!enabled) {
        for (const el of Array.from(running.keys())) settle(el);
        return;
      }
      records.forEach((record, el) => reveal(el, record));
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(sync);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const record = records.get(entry.target);
          if (!record) continue;
          record.inview = entry.isIntersecting;
          if (record.kind === "paper") entry.target.classList.toggle("ehc-motion-inview", record.inview);
          if (record.inview) reveal(entry.target, record);
          else settle(entry.target);
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -12px 0px" }
    );
    records.forEach((_r, el) => observer.observe(el));

    const onFocusIn = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      for (const el of Array.from(running.keys())) if (el.contains(target)) settle(el);
    };

    document.addEventListener("visibilitychange", schedule);
    quiet.addEventListener("change", schedule);
    const offConnection = watchConnection(schedule);
    home.addEventListener("focusin", onFocusIn);

    sync();

    return () => {
      observer.disconnect();
      for (const el of Array.from(running.keys())) settle(el);
      document.removeEventListener("visibilitychange", schedule);
      quiet.removeEventListener("change", schedule);
      offConnection();
      home.removeEventListener("focusin", onFocusIn);
      records.forEach((_r, el) => {
        const html = el as HTMLElement;
        delete html.dataset.ehcMotionPlayed;
        el.classList.remove("ehc-motion-inview");
      });
      home.classList.remove("ehc-scroll-motion-allowed");
    };
  }, [rootRef, paused, opening, replayKey]);
}

/* ------------------------------------------------------------------ */
/* 2. 3枚カードの重なり（sticky）                                        */
/* ------------------------------------------------------------------ */

export function useCardStack(rootRef: RefObject<HTMLElement | null>, opts: { paused: boolean }) {
  const { paused } = opts;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stack = root.querySelector<HTMLElement>(".discovery-stack");
    if (!stack) return;

    const cards = Array.from(stack.querySelectorAll<HTMLElement>(".discovery-card"));
    const header = root.querySelector<HTMLElement>(".header");
    const dock = root.querySelector<HTMLElement>(".mobile-dock");
    const quiet = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const measure = () => {
      frame = 0;
      const mobile = innerWidth <= 700;
      const top = (header?.offsetHeight || 72) + (mobile ? 16 : 24);
      const step = mobile ? 14 : 20;
      const bottom = mobile ? (dock?.offsetHeight || 64) + 30 : 28;
      const available = window.visualViewport?.height || innerHeight;
      const largest = Math.max(0, ...cards.map((card) => card.offsetHeight));
      const fits = largest > 0 && top + step * (cards.length - 1) + largest + bottom <= available;
      const allowed =
        fits && !quiet.matches && !saveData() && !paused && CSS.supports("position", "sticky");
      stack.style.setProperty("--ehc-stack-top", `${top}px`);
      stack.style.setProperty("--ehc-stack-step", `${step}px`);
      stack.style.setProperty(
        "--ehc-stack-gap",
        `${Math.round(Math.min(180, Math.max(105, available * 0.18)))}px`
      );
      stack.classList.toggle("stack-enabled", allowed);
      stack.dataset.stackMode = allowed ? "overlap" : !fits ? "reading-space" : "static";
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    let resizeObserver: ResizeObserver | undefined;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(schedule);
      [...cards, header, dock].forEach((el) => el && resizeObserver!.observe(el));
    }
    addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", schedule);
    quiet.addEventListener("change", schedule);
    const offConnection = watchConnection(schedule);
    document.fonts?.ready.then(schedule).catch(() => undefined);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      quiet.removeEventListener("change", schedule);
      offConnection();
      stack.classList.remove("stack-enabled");
      delete stack.dataset.stackMode;
    };
  }, [rootRef, paused]);
}

/* ------------------------------------------------------------------ */
/* 3. .reveal / 最終セクションの入場                                     */
/* ------------------------------------------------------------------ */

export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>, opts: { paused: boolean }) {
  const { paused } = opts;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    root.classList.add("motion-enabled");

    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0.09, rootMargin: "0px 0px -20px 0px" }
    );
    root.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

    let closingObserver: IntersectionObserver | undefined;
    const closing = root.querySelector<HTMLElement>("#lets-start");
    const quiet = matchMedia("(prefers-reduced-motion: reduce)");
    if (closing && !quiet.matches && !paused) {
      closing.classList.add("closing-motion-ready");
      closingObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              closing.classList.add("closing-motion-seen");
              closingObserver?.disconnect();
            }
          }
        },
        { threshold: 0.24 }
      );
      closingObserver.observe(closing);
    }

    return () => {
      revealObserver.disconnect();
      closingObserver?.disconnect();
    };
  }, [rootRef, paused]);
}

/* ------------------------------------------------------------------ */
/* 4. 入口の風 / 空調シーンの動画                                        */
/* ------------------------------------------------------------------ */

export function useHeroMedia(
  rootRef: RefObject<HTMLElement | null>,
  opts: { paused: boolean; introPlaying: boolean }
) {
  const { paused, introPlaying } = opts;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const entrance = root.querySelector<HTMLVideoElement>("#entry-film");
    const scene = root.querySelector<HTMLVideoElement>("#hero-film");
    const artwork = root.querySelector<HTMLElement>(".scene-art");
    const poster = root.querySelector<HTMLImageElement>(".scene-motion-poster");
    if (!artwork) return;

    const quiet = matchMedia("(prefers-reduced-motion: reduce)");
    const state = { heroBlocked: false, heroVisible: false, queued: false, cancelled: false };
    const pending = new WeakMap<HTMLVideoElement, { cancel: (() => void) | null }>();

    const allowed = () => !quiet.matches && !paused && !saveData();
    const wanted = (video: HTMLVideoElement | null) =>
      !!video &&
      allowed() &&
      !document.hidden &&
      (video === entrance
        ? introPlaying
        : !introPlaying &&
          state.heroVisible &&
          !state.heroBlocked &&
          artwork.classList.contains("has-motion-poster"));

    const stop = (video: HTMLVideoElement | null) => {
      if (!video) return;
      const operation = pending.get(video);
      pending.delete(video);
      operation?.cancel?.();
      video.pause();
      video.classList.remove("is-playing");
      if (video === scene) artwork.classList.remove("has-live-video");
    };

    const metadata = (video: HTMLVideoElement, operation: { cancel: (() => void) | null }) => {
      if (video.readyState >= 1) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        const finish = (ok: boolean) => {
          clearTimeout(timer);
          video.removeEventListener("loadedmetadata", ready);
          video.removeEventListener("error", failed);
          operation.cancel = null;
          resolve(ok);
        };
        const ready = () => finish(true);
        const failed = () => finish(false);
        const timer = setTimeout(failed, 1200);
        operation.cancel = failed;
        video.addEventListener("loadedmetadata", ready, { once: true });
        video.addEventListener("error", failed, { once: true });
      });
    };

    const start = async (video: HTMLVideoElement | null) => {
      if (!video || !wanted(video) || pending.has(video) || !video.paused) return;
      const operation: { cancel: (() => void) | null } = { cancel: null };
      pending.set(video, operation);
      const current = () => pending.get(video) === operation && !state.cancelled;
      video.muted = true;
      try {
        if (!video.getAttribute("src") && video.dataset.src) {
          video.preload = "metadata";
          video.src = video.dataset.src;
          video.load();
        }
        const ready = await metadata(video, operation);
        if (!current()) return;
        if (!ready) throw new Error("Decorative media unavailable");
        if (!wanted(video)) {
          stop(video);
          return;
        }
        if (video === entrance) {
          video.currentTime = 0;
          video.playbackRate = 1.3;
        }
        await video.play();
        if (!current()) return;
        if (!wanted(video)) {
          stop(video);
          return;
        }
        video.classList.add("is-playing");
        if (video === scene) artwork.classList.add("has-live-video");
      } catch {
        if (current()) {
          stop(video);
          if (video === scene) state.heroBlocked = true;
        }
      } finally {
        if (current()) pending.delete(video);
      }
    };

    const sync = () => {
      state.queued = false;
      if (state.cancelled) return;
      for (const video of [entrance, scene]) {
        if (wanted(video)) void start(video);
        else stop(video);
      }
    };
    const schedule = () => {
      if (state.queued) return;
      state.queued = true;
      queueMicrotask(sync);
    };

    const onFail = (video: HTMLVideoElement | null) => () => {
      if (video === scene) state.heroBlocked = true;
      stop(video);
    };
    const handlers: Array<[HTMLVideoElement, string, () => void]> = [];
    for (const video of [entrance, scene]) {
      if (!video) continue;
      const fail = onFail(video);
      video.addEventListener("error", fail);
      video.addEventListener("ended", fail);
      handlers.push([video, "error", fail], [video, "ended", fail]);
    }

    const posterReady = () => {
      if (poster && poster.naturalWidth > 0) {
        artwork.classList.add("has-motion-poster");
        schedule();
      }
    };
    poster?.addEventListener("load", posterReady);
    posterReady();

    document.addEventListener("visibilitychange", schedule);
    quiet.addEventListener("change", schedule);
    const offConnection = watchConnection(schedule);

    let heroObserver: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      heroObserver = new IntersectionObserver(
        (entries) => {
          state.heroVisible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.15;
          schedule();
        },
        { threshold: [0, 0.15] }
      );
      heroObserver.observe(artwork);
    } else {
      state.heroVisible = true;
    }

    // 3:2 の実画像サイズにマスクを合わせる
    const layoutMedia = () => {
      const width = artwork.clientWidth;
      const height = artwork.clientHeight;
      if (!width || !height) return;
      const mediaWidth = Math.min(width, height * 1.5);
      artwork.style.setProperty("--media-width", `${mediaWidth}px`);
      artwork.style.setProperty("--media-height", `${mediaWidth / 1.5}px`);
    };
    let mediaObserver: ResizeObserver | undefined;
    if ("ResizeObserver" in window) {
      mediaObserver = new ResizeObserver(layoutMedia);
      mediaObserver.observe(artwork);
    } else {
      addEventListener("resize", layoutMedia);
    }
    layoutMedia();
    sync();

    return () => {
      state.cancelled = true;
      heroObserver?.disconnect();
      mediaObserver?.disconnect();
      removeEventListener("resize", layoutMedia);
      poster?.removeEventListener("load", posterReady);
      document.removeEventListener("visibilitychange", schedule);
      quiet.removeEventListener("change", schedule);
      offConnection();
      handlers.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
      stop(entrance);
      stop(scene);
    };
  }, [rootRef, paused, introPlaying]);
}
