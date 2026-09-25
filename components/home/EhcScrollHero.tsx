"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { mountScrollFilm } from "./mountScrollFilm";
import HeroAmbientScene from "./HeroAmbientScene";
import "./ehc-scroll-film.css";

type Props = {
  /** Pass the existing heading, explanation and working diagnosis CTA unchanged. */
  copy: ReactNode;
  paused?: boolean;
  labelledBy?: string;
  desktopSrc?: string;
  mobileSrc?: string;
  posterSrc?: string;
  /** Height of the existing fixed header, if any. */
  stickyTop?: number;
  /** 次の節への案内。自動では送らないので、押して進む道を残す。 */
  nextHref?: string;
  nextLabel?: string;
  onNext?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function EhcScrollHero({
  copy,
  paused = false,
  labelledBy,
  desktopSrc = "/v17/ehc-hero-v3-desktop.mp4",
  mobileSrc = "/v17/ehc-hero-v3-mobile.mp4",
  posterSrc = "/v17/ehc-hero-v3-poster.webp",
  stickyTop = 0,
  nextHref,
  nextLabel = "次へ進む",
  onNext,
}: Props) {
  const paperKeyId = `ehc-paper-key-${useId().replace(/:/g, "")}`;
  const [ambientImageSrc, setAmbientImageSrc] = useState<string | null>(null);
  const poster = useRef<HTMLImageElement>(null);
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const replay = useRef<HTMLButtonElement>(null);
  const controller = useRef<ReturnType<typeof mountScrollFilm> | null>(null);
  const pausedRef = useRef(paused);
  const stickyTopRef = useRef(stickyTop);
  pausedRef.current = paused;
  stickyTopRef.current = stickyTop;

  useEffect(() => {
    const image = poster.current;
    if (image?.complete && image.naturalWidth > 0) setAmbientImageSrc(posterSrc);
  }, [posterSrc]);

  useEffect(() => {
    if (!root.current || !stage.current || !sentinel.current || !video.current || !toggle.current) return;
    const dispose = mountScrollFilm({
      root: root.current,
      stage: stage.current,
      sentinel: sentinel.current,
      video: video.current,
      toggle: toggle.current,
      replay: replay.current,
      desktopSrc,
      mobileSrc,
      stickyTop: stickyTopRef.current,
      paused: pausedRef.current,
      fps: 24,
    });
    controller.current = dispose;
    return () => {
      controller.current = null;
      dispose();
    };
  }, [desktopSrc, mobileSrc]);

  useEffect(() => {
    controller.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    controller.current?.setStickyTop(stickyTop);
  }, [stickyTop]);

  return (
    <section
      ref={root}
      className="ehc-film"
      data-mode="static"
      data-video-ready="false"
      data-completed="false"
      data-wind="off"
      data-ambient-ready="false"
      data-ambient-image-ready={ambientImageSrc === posterSrc ? "true" : "false"}
      aria-labelledby={labelledBy}
    >
      {/* EHC-0042: Key the baked-in pale paper to alpha, rather than multiply it
          into a darker rectangle. sRGB matches the measured media pixels.
          RGB is untouched; only alpha falls from 1 to 0 over the light range.
          This also works for the SSR poster, without JavaScript/video loading. */}
      <svg width="0" height="0" className="ehc-film__filter-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id={paperKeyId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -7 -7 -7 0 18.9" result="ink" />
            <feComposite in="SourceGraphic" in2="ink" operator="in" />
          </filter>
        </defs>
      </svg>
      <div ref={stage} className="ehc-film__stage">
        <div className="ehc-film__copy">{copy}</div>
        {/* Normal-flow start of the visual, after copy on small screens. */}
        <div ref={sentinel} className="ehc-film__sentinel" aria-hidden="true" />
        <div className="ehc-film__visual">
          <figure className="ehc-film__figure">
            <div className="ehc-film__viewport" style={{ filter: `url(#${paperKeyId})` }}>
              {/* A real SSR image remains visible without JS or video support. */}
              <img
                ref={poster}
                className="ehc-film__poster"
                onLoad={() => setAmbientImageSrc(posterSrc)}
                onError={() => setAmbientImageSrc(null)}
                src={posterSrc}
                width={1440}
                height={960}
                alt="店舗と事務所の空調更新のイメージ"
                fetchPriority="high"
                loading="eager"
                decoding="async"
              />
              <video
                ref={video}
                className="ehc-film__video"
                muted
                playsInline
                preload="none"
                tabIndex={-1}
                aria-hidden="true"
                disablePictureInPicture
                disableRemotePlayback
              />
              <HeroAmbientScene />
            </div>
            <figcaption className="ehc-film__caption">空調更新のイメージ</figcaption>
          </figure>
          <div className="ehc-film__controls">
            <span className="ehc-film__hint" aria-hidden="true">スクロールで、更新の流れを見る</span>
            {/* This link remains usable with motion disabled. */}
            {nextHref ? (
              <a className="ehc-film__next" href={nextHref} onClick={onNext}>
                {nextLabel}
              </a>
            ) : null}
            {/* 2026-09-17 EHC-0040 §5: 再演出は別の小さいリンク。
                停止／再開ボタンの文言をここへ差し替えると、風を止める札が
                画面から消えてしまう。操作の意味は入れ替えない。 */}
            <button ref={replay} className="ehc-film__replay" type="button" hidden>
              演出をもう一度見る
            </button>
            <button ref={toggle} className="ehc-film__toggle" type="button" hidden>
              動きを止める
            </button>
          </div>
        </div>
      </div>
      {/* Reserve travel before loading; pause and completion never collapse it. */}
      <div className="ehc-film__runway" aria-hidden="true" />
    </section>
  );
}
