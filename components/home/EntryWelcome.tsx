"use client";

/* v1 / 2026-09-17 / EHC-0042
   Reuse the approved entrance film and phrase once per document. The overlay is
   decorative: it never makes the page inert, captures focus or blocks the CTA. */
import { useCallback, useEffect, useRef, useState } from "react";
import { OPEN_HEARING_EVENT } from "../HowItWorks";
import "./entry-welcome.css";

const shownDocuments = new WeakSet<Document>();
const DURATION_MS = 1800;
const FADE_MS = 280;
type Connection = EventTarget & { saveData?: boolean };

type Props = {
  paused: boolean;
  onPlayingChange: (playing: boolean) => void;
};

export default function EntryWelcome({ paused, onPlayingChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialPaused = useRef(paused);
  const visit = useRef({ claimed: false, closed: false, startedAt: 0 });
  const timers = useRef<number[]>([]);
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const dismiss = useCallback(() => {
    visit.current.closed = true;
    clearTimers();
    videoRef.current?.pause();
    setActive(false);
    setLeaving(false);
    onPlayingChange(false);
  }, [clearTimers, onPlayingChange]);

  useEffect(() => {
    const current = visit.current;
    if (current.closed || (!current.claimed && shownDocuments.has(document))) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const hash = window.location.hash;
    shownDocuments.add(document);
    if (initialPaused.current || quiet.matches || connection?.saveData || document.hidden
      || (hash !== "" && hash !== "#home")) {
      current.closed = true;
      return;
    }

    // React StrictMode remounts effects. Only this component may retain its first
    // claim; a new Home instance after diagnosis cannot replay the introduction.
    if (!current.claimed) {
      current.claimed = true;
      current.startedAt = Date.now();
    }
    const remaining = DURATION_MS - (Date.now() - current.startedAt);
    if (remaining <= 0) { dismiss(); return; }
    setActive(true);
    onPlayingChange(true);
    timers.current.push(window.setTimeout(() => setLeaving(true), Math.max(0, remaining - FADE_MS)));
    timers.current.push(window.setTimeout(dismiss, remaining));
    return () => {
      clearTimers();
      onPlayingChange(false);
    };
  }, [clearTimers, dismiss, onPlayingChange]);

  useEffect(() => {
    if (paused && active) dismiss();
  }, [paused, active, dismiss]);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    if (quiet.matches || connection?.saveData || document.hidden || paused) {
      dismiss();
      return;
    }
    let alive = true;
    const onPolicy = () => {
      if (quiet.matches || connection?.saveData || document.hidden) dismiss();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    const onReady = () => { if (alive) setVideoReady(true); };
    const onError = () => { if (alive) setVideoReady(false); };
    document.addEventListener("visibilitychange", onPolicy);
    document.addEventListener("keydown", onKey);
    // Passive observation only: the user's original click/scroll still reaches its target.
    document.addEventListener("pointerdown", dismiss, { passive: true });
    window.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener(OPEN_HEARING_EVENT, dismiss);
    quiet.addEventListener("change", onPolicy);
    connection?.addEventListener("change", onPolicy);
    video.addEventListener("playing", onReady);
    video.addEventListener("error", onError);
    video.muted = true;
    video.defaultMuted = true;
    video.playbackRate = 1.3;
    // There is intentionally no JSX src or preload: blocked settings request no movie.
    video.src = "/v17/entry-film.mp4";
    const started = video.play();
    started?.then(() => {
      if (!alive || document.hidden || quiet.matches || connection?.saveData) video.pause();
    }).catch(onError);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onPolicy);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss);
      window.removeEventListener(OPEN_HEARING_EVENT, dismiss);
      quiet.removeEventListener("change", onPolicy);
      connection?.removeEventListener("change", onPolicy);
      video.removeEventListener("playing", onReady);
      video.removeEventListener("error", onError);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [active, dismiss, paused]);

  if (!active) return null;
  return (
    <aside className={`ehc-entry${leaving ? " ehc-entry--leaving" : ""}`} aria-label="空調更新のご案内">
      <div className="ehc-entry__air" aria-hidden="true">
        <video
          ref={videoRef}
          className={videoReady ? "ehc-entry__film is-playing" : "ehc-entry__film"}
          muted
          playsInline
          preload="none"
          tabIndex={-1}
          disablePictureInPicture
          disableRemotePlayback
        />
      </div>
      <span className="ehc-entry__brand" aria-hidden="true">EHC</span>
      <p className="ehc-entry__phrase"><span>空調更新、</span><span>その前に。</span></p>
      <button type="button" className="ehc-entry__skip" onClick={dismiss}>演出をスキップ</button>
    </aside>
  );
}
