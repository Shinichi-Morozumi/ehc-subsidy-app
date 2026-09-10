"use client";

/* v1 / 2026-09-08  EHC-0027 / PJ-20260907-01
   デザイン原案 v17（v17_2026-09-07_EHCアプリ_EHC-0026_カード積層・無料診断CTA.html）の
   ホーム画面を、既存 Next.js アプリの部品として移植したもの。原案HTMLを丸ごと貼っていない。

   ・見た目は app/home-v17.css（原案<style>を .ehc17 にスコープ化したもの）が担う。
   ・動きは components/home/homeMotion.ts のフックが担う。いずれも装飾のみで、
     診断ロジック・補助金の数値・API には一切関与しない。
   ・CTA は全て startDiagnosis() 1本に集約し、既存の OPEN_HEARING_EVENT を発火する。
     これにより既存の GuidedDiagnosis（7問の匿名診断）がそのまま開く。
     SubsidyMatcher / GuidedDiagnosis / lib 配下は無改修。
   ・「無料」は最初の匿名候補診断のみを指す。PDF・相談・工事が無料とは表示しない。
   ・診断レポートの見本に出てくる制度名・金額は全て架空例であり、実計算には使わない。 */

import { useCallback, useEffect, useRef, useState } from "react";
import { OPEN_HEARING_EVENT } from "../HowItWorks";
import {
  useCardStack,
  useHeroMedia,
  useRevealOnScroll,
  useSectionMotion,
} from "./homeMotion";

const INTRO_LEAVE_MS = 1750;
const INTRO_CLOSE_MS = 2850;

/* 原案の boot スクリプト相当。ハッシュ無し・reduced-motion でない場合のみ冒頭演出を出す。 */
function wantsOpening(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  if (h && h !== "#home") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HomeV17() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const timers = useRef<number[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [openingStage, setOpeningStage] = useState(false);
  const [openingReveal, setOpeningReveal] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [dockShow, setDockShow] = useState(false);
  const [activeChapter, setActiveChapter] = useState("benefit-program");
  const [replayKey, setReplayKey] = useState(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const closeOpening = useCallback(() => {
    clearTimers();
    setIntroPlaying(false);
    setIntroLeaving(false);
    setOpeningStage(false);
    setOpeningReveal(false);
    const art = rootRef.current?.querySelector(".scene-art");
    art?.classList.add("ready");
  }, [clearTimers]);

  const playOpening = useCallback(() => {
    clearTimers();
    setOpeningStage(true);
    setIntroPlaying(true);
    setIntroLeaving(false);
    timers.current.push(
      window.setTimeout(() => {
        setIntroLeaving(true);
        setOpeningReveal(true);
      }, INTRO_LEAVE_MS),
    );
    timers.current.push(
      window.setTimeout(() => {
        const insideIntro = !!(
          document.activeElement &&
          introRef.current?.contains(document.activeElement)
        );
        closeOpening();
        if (insideIntro) startRef.current?.focus();
      }, INTRO_CLOSE_MS),
    );
  }, [clearTimers, closeOpening]);

  /* 初回のみ冒頭演出。5秒の保険で必ず閉じる（原案の fallback と同じ）。 */
  useEffect(() => {
    if (!wantsOpening()) {
      rootRef.current?.querySelector(".scene-art")?.classList.add("ready");
      return;
    }
    playOpening();
    const fb = window.setTimeout(closeOpening, 5000);
    return () => {
      window.clearTimeout(fb);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 演出中は背後を操作させない（原案の inert 相当）。 */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>(
        ":scope > .header, :scope > main, :scope > .site-menu, :scope > .mobile-dock",
      ),
    );
    targets.forEach((el) => {
      if (introPlaying) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
    if (introPlaying) skipRef.current?.focus();
    return () => targets.forEach((el) => el.removeAttribute("inert"));
  }, [introPlaying]);

  /* 診断へ。既存アプリの入口イベントを発火するだけで、判定処理には触れない。 */
  const startDiagnosis = useCallback(() => {
    closeOpening();
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT));
  }, [closeOpening]);

  const toggleMotion = useCallback(() => {
    setMotionPaused((v) => !v);
    closeOpening();
  }, [closeOpening]);

  const replayOpening = useCallback(() => {
    setMenuOpen(false);
    setReplayKey((n) => n + 1);
    playOpening();
  }, [playOpening]);

  /* Escape で演出／メニューを閉じる。 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (introPlaying) {
        closeOpening();
        startRef.current?.focus();
        return;
      }
      if (menuOpen) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [introPlaying, menuOpen, closeOpening]);

  /* ページ内リンクのスクロール。動きを止めている時は瞬間移動にする。 */
  const jump = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      setMenuOpen(false);
      const quiet =
        motionPaused ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current
        ?.querySelector(`#${id}`)
        ?.scrollIntoView({ behavior: quiet ? "auto" : "smooth", block: "start" });
    },
    [motionPaused],
  );

  /* ヘッダーの地色・モバイルドック・章ナビの現在地。rAF で間引く。 */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const root = rootRef.current;
      if (!root) return;
      setHeaderSolid(window.scrollY > 30);
      const heroRect = heroRef.current?.getBoundingClientRect();
      setDockShow(!!heroRect && heroRect.bottom < 50 && !introPlaying);
      const cards = Array.from(
        root.querySelectorAll<HTMLElement>(".discovery-card"),
      );
      let current = cards[0]?.id ?? "";
      const half = window.innerHeight * 0.5;
      cards.forEach((c) => {
        if (c.getBoundingClientRect().top < half) current = c.id;
      });
      if (current) setActiveChapter(current);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [introPlaying]);

  /* ホームの間だけ紙色の地にする。ツール側のダークテーマには触れない。 */
  useEffect(() => {
    document.body.classList.add("ehc17-home");
    return () => document.body.classList.remove("ehc17-home");
  }, []);

  useSectionMotion(rootRef, {
    paused: motionPaused,
    opening: introPlaying,
    replayKey,
  });
  useCardStack(rootRef, { paused: motionPaused });
  useRevealOnScroll(rootRef, { paused: motionPaused });
  useHeroMedia(rootRef, { paused: motionPaused, introPlaying });

  const rootClass = [
    "ehc17",
    motionPaused ? "motion-paused" : "",
    openingStage ? "ehc-opening-stage" : "",
    openingReveal ? "ehc-opening-reveal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={rootClass} data-screen="home">
      <a href="#main-content" className="skip-main">
        本文へ
      </a>

      {/* 冒頭演出。装飾のみ。 */}
      <div
        ref={introRef}
        className={`intro${introPlaying ? " playing" : ""}${introLeaving ? " leaving" : ""}`}
        aria-hidden={!introPlaying}
        role="dialog"
        aria-label="空調更新、その前に。導入演出"
      >
        <span className="intro-label" aria-hidden="true">
          EHC
        </span>
        <div className="intro-air" aria-hidden="true">
          <video
            id="entry-film"
            muted
            playsInline
            preload="none"
            tabIndex={-1}
            aria-hidden="true"
            disablePictureInPicture
            data-src="/v17/entry-film.mp4"
          />
        </div>
        <p className="intro-phrase">
          <span>空調更新、</span>
          <span>その前に。</span>
        </p>
        <button
          ref={skipRef}
          type="button"
          className="intro-skip"
          id="skip-opening"
          onClick={startDiagnosis}
        >
          演出をスキップして診断へ ↗
        </button>
      </div>

      <header
        ref={headerRef}
        className={`header${headerSolid ? " solid" : ""}`}
      >
        <a
          className="brand"
          href="#home"
          aria-label="EHC ホームへ"
          onClick={(e) => jump(e, "home")}
        >
          <b>EHC</b>
          <span>
            空調更新と
            <br />
            補助金の候補診断
          </span>
        </a>
        <nav className="main-nav" aria-label="メインナビゲーション">
          <a href="#about-diagnosis" onClick={(e) => jump(e, "about-diagnosis")}>
            EHCの診断
          </a>
          <a href="#what-you-get" onClick={(e) => jump(e, "what-you-get")}>
            わかること
          </a>
          <a
            href="#diagnosis-report-preview"
            onClick={(e) => jump(e, "diagnosis-report-preview")}
          >
            診断書の見本
          </a>
        </nav>
        <div className="header-actions">
          <button type="button" className="header-start" onClick={startDiagnosis}>
            無料診断 ↗
          </button>
          <button
            type="button"
            className="menu-toggle"
            aria-label="メニュー"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i />
            <i />
          </button>
        </div>
      </header>

      <nav
        className="site-menu"
        id="site-menu"
        aria-label="ページメニュー"
        hidden={!menuOpen}
      >
        <a href="#about-diagnosis" onClick={(e) => jump(e, "about-diagnosis")}>
          EHCの診断について ↗
        </a>
        <a href="#what-you-get" onClick={(e) => jump(e, "what-you-get")}>
          診断でわかること ↗
        </a>
        <a
          href="#diagnosis-report-preview"
          onClick={(e) => jump(e, "diagnosis-report-preview")}
        >
          診断書の見本 ↗
        </a>
        <a href="#support" onClick={(e) => jump(e, "support")}>
          空調更新のサポート ↗
        </a>
        <button type="button" onClick={replayOpening}>
          冒頭の演出をもう一度 ↻
        </button>
        <button
          type="button"
          onClick={toggleMotion}
          aria-pressed={motionPaused}
        >
          {motionPaused ? "動きを再開する" : "動きを止める"}
        </button>
      </nav>

      <main className="wrap" id="main-content">
        <section className="screen active" id="home">
          {/* 1. ヒーロー */}
          <section
            ref={heroRef}
            className="scene-hero"
            aria-labelledby="hero-title"
          >
            <div className="scene-art" aria-hidden="true">
              <img
                src="/v17/hero-scene.webp"
                srcSet="/v17/hero-scene-960.webp 960w, /v17/hero-scene.webp 1536w"
                sizes="100vw"
                width={1536}
                height={1024}
                fetchPriority="high"
                alt=""
              />
              <img
                className="scene-motion-poster"
                src="/v17/hero-poster.jpg"
                width={960}
                height={640}
                fetchPriority="high"
                alt=""
              />
              <video
                id="hero-film"
                className="scene-video"
                loop
                muted
                playsInline
                preload="none"
                tabIndex={-1}
                aria-hidden="true"
                disablePictureInPicture
                data-src="/v17/hero-film.mp4"
              />
            </div>
            <div className="hero-title-block">
              <p className="eyebrow">
                <span className="status-dot" /> 空調更新 × 補助金・助成金
              </p>
              <h1 id="hero-title">
                <span>空調を発注する前に、</span>
                <span>
                  <span className="accent-word">補助金</span>の確認を。
                </span>
              </h1>
              <p className="hero-description">
                使える可能性と、間に合う時期を。
                <br />
                まずは7問、あなたの条件で確認。
              </p>
            </div>
            <div className="hero-conversion">
              <button
                ref={startRef}
                type="button"
                className="primary"
                id="start"
                onClick={startDiagnosis}
              >
                無料で今すぐ診断{" "}
                <span className="button-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
              <p>7問・名前やメールアドレスは不要。</p>
              <a
                className="hero-report-link"
                href="#diagnosis-report-preview"
                onClick={(e) => jump(e, "diagnosis-report-preview")}
              >
                候補・期限・費用がまとまる、診断レポート{" "}
                <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="scene-caption">
              <span className="status-dot" /> OFFICE / SHOP / FACILITY{" "}
              <small>空調更新を、もっと身近に。</small>
            </p>
            <a
              href="#how-it-works"
              className="scroll-cue"
              aria-label="診断の流れを見る"
              onClick={(e) => jump(e, "how-it-works")}
            >
              <span>SCROLL</span>
              <i aria-hidden="true">↓</i>
            </a>
          </section>

          {/* 2. 3ステップ */}
          <section
            className="flow-section section-pad"
            id="how-it-works"
            aria-labelledby="flow-title"
          >
            <div className="flow-heading">
              <span className="section-label">かんたん、3ステップ</span>
              <h2 id="flow-title">まずは、今わかることから。</h2>
            </div>
            <ol className="flow-list">
              <li>
                <span className="flow-number">01</span>
                <div>
                  <h3>今わかる条件を答える</h3>
                  <p>予定・所在地・事業規模から。</p>
                </div>
                <span aria-hidden="true">↗</span>
              </li>
              <li>
                <span className="flow-number">02</span>
                <div>
                  <h3>候補と費用を比べる</h3>
                  <p>設備情報を足してシミュレーション。</p>
                </div>
                <span aria-hidden="true">↗</span>
              </li>
              <li>
                <span className="flow-number">03</span>
                <div>
                  <h3>PDFで保存・相談する</h3>
                  <p>同意後に、次の行動へ。</p>
                </div>
                <span aria-hidden="true">↗</span>
              </li>
            </ol>
          </section>

          {/* 3. 診断レポートの見本（制度名・金額は全て架空例） */}
          <section
            className="report-chapter"
            id="diagnosis-report-preview"
            aria-labelledby="report-title"
          >
            <div className="report-chapter-heading">
              <p className="chapter-eyebrow">
                <svg
                  className="ehc-icon"
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 32 32"
                >
                  <path d="M8 3h12l6 6v20H8zM20 3v7h6M12 15h10M12 19h10M12 23h6" />
                  <path d="M5 7H3v23h18" />
                </svg>{" "}
                診断の結果を、持ち帰れる。
              </p>
              <h2 id="report-title">
                <span>補助金も、費用も。</span>
                <em>
                  まとめて見せて、
                  <br />
                  相談できる。
                </em>
              </h2>
              <p className="chapter-lead">
                制度の候補・受付期限・費用の概算を、
                <br />
                ひとつの診断レポートにまとめます。
              </p>
              <p className="report-ease">
                社内への説明や、工事の相談に。
                <br />
                資料をまとめ直す手間を減らせます。
              </p>
            </div>

            <figure className="report-chapter-preview">
              <p className="report-preview-caption">
                こんなレポートが手元に残ります
              </p>
              <div className="report-stage">
                <article
                  className="sample-report"
                  aria-label="診断レポートの見本。制度も金額も架空の例です"
                >
                  <div className="sample-report-brand">
                    <b>EHC</b>
                    <span>架空ケースの見本</span>
                  </div>
                  <header>
                    <p>サンプル事業所様</p>
                    <h3>空調更新 診断レポート</h3>
                  </header>
                  <div className="sample-report-section">
                    <h4>01 制度の候補</h4>
                    <div className="sample-candidate">
                      <b>制度候補 A・B</b>
                      <span>条件の確認が必要</span>
                    </div>
                    <p>対象機器・契約状況を確認しましょう。</p>
                  </div>
                  <div className="sample-report-section">
                    <h4>02 期限と、次にやること</h4>
                    <dl>
                      <dt>受付期限</dt>
                      <dd>公式情報の確認待ち</dd>
                      <dt>準備するもの</dt>
                      <dd>機器の型番・契約状況</dd>
                    </dl>
                  </div>
                  <div className="sample-report-section">
                    <h4>
                      03 費用の比較 <small>金額は架空例</small>
                    </h4>
                    <div className="sample-money">
                      <div>
                        <span>補助金なし</span>
                        <strong>
                          500<small>万円</small>
                        </strong>
                      </div>
                      <div>
                        <span>採択された場合</span>
                        <strong>
                          400<small>万円</small>
                        </strong>
                      </div>
                    </div>
                    <p className="sample-money-note">
                      想定補助額100万円の架空例。制度候補A・Bの額や合算を示すものではありません。
                    </p>
                  </div>
                  <footer>入力条件・公式情報・算定根拠も記録</footer>
                </article>
              </div>
              <figcaption>
                架空ケースのデザイン見本です。実際の制度・金額・出力PDFではありません。
              </figcaption>
            </figure>

            <div className="report-chapter-actions">
              {/* 2026-09-08 NEOレビュー差し戻し（A18）での修正:
                  狭幅対応の過程で原案の <div.usecase-label>＋アイコン＋<p> を
                  <b>＋<span>＋<br> に潰していた。home-v17.css の
                  .report-usecases .usecase-label / .ehc-icon / p は残っていたため、
                  セレクタが当たらず見出し色（#e1f0a4）・本文色（#e3ecde）・
                  余白（margin-bottom:7px）・アイコン22pxが全て失われていた。
                  原案（EHC-0026 v17）の構造をそのまま復元する。 */}
              <ul className="report-usecases" aria-label="診断レポートの使い方">
                <li>
                  <div className="usecase-label">
                    <svg
                      className="ehc-icon"
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 32 32"
                    >
                      <circle cx="11" cy="10" r="4" />
                      <circle cx="23" cy="12" r="3" />
                      <path d="M3 27v-5a8 8 0 0 1 16 0v5M21 19a7 7 0 0 1 8 7" />
                    </svg>{" "}
                    社内に説明する
                  </div>
                  <p>
                    候補と費用をまとめて、
                    <br />
                    上司や経理へ共有。
                  </p>
                </li>
                <li>
                  <div className="usecase-label">
                    <svg
                      className="ehc-icon"
                      aria-hidden="true"
                      focusable="false"
                      viewBox="0 0 32 32"
                    >
                      <path d="m20 4-5 5 3 5 5 1 5-5a9 9 0 0 1-12 11L9 28a4 4 0 0 1-5-5l7-7A9 9 0 0 1 20 4Z" />
                      <path d="m6 25 1-1" />
                    </svg>{" "}
                    {/* 2026-09-08 NEOレビュー差し戻しでの修正:
                        「業者に相談する」だと相談先が不特定の第三者に読め、
                        診断書末尾の「他社への提示禁止」と矛盾していた。相談先をEHCに限定する。 */}
                    EHCに相談する
                  </div>
                  <p>
                    設備条件と確認事項を、
                    <br />
                    一緒に伝えられます。
                  </p>
                </li>
              </ul>
              <button type="button" className="primary" onClick={startDiagnosis}>
                無料で今すぐ診断 ↗
              </button>
              <button
                type="button"
                className="report-how"
                onClick={startDiagnosis}
              >
                PDFの保存・相談の流れを見る ↗
              </button>
              <p className="report-consent-note">
                最初の7問で制度の候補を確認します。
                <br />
                費用の試算には設備情報、PDF保存には必要情報・同意が必要です。
              </p>
            </div>
          </section>

          {/* 4. 進める順番 */}
          <section
            className="decision-chapter"
            id="about-diagnosis"
            aria-labelledby="decision-title"
          >
            <div className="decision-copy">
              <p className="chapter-eyebrow">更新を決める前に、知っておきたいこと</p>
              <h2 id="decision-title">
                補助金は、
                <br />
                <em>進める順番も大切。</em>
              </h2>
              <p className="chapter-lead">
                発注したあとでは、
                <br />
                対象外になる制度もあります。
              </p>
              <p className="decision-body">
                設備を選ぶ前に、制度の候補と条件を確認。
                <br />
                使える可能性を知ってから、更新を考えましょう。
              </p>
            </div>
            <figure className="decision-visual">
              <figcaption>
                <span>たとえば</span> SIIの省エネ補助金では
              </figcaption>
              <ol className="order-path">
                <li>
                  <svg
                    className="ehc-icon"
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 32 32"
                  >
                    <path d="M14 4a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM21 21l7 7" />
                  </svg>
                  <b>制度を確認</b>
                </li>
                <li>
                  <svg
                    className="ehc-icon"
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 32 32"
                  >
                    <path d="M8 3h12l6 6v20H8zM20 3v7h6M12 16h8M12 21h8" />
                  </svg>
                  <b>申請</b>
                </li>
                <li>
                  <svg
                    className="ehc-icon"
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 32 32"
                  >
                    <path d="M5 16l7 7L27 8" />
                  </svg>
                  <b>交付決定</b>
                </li>
                <li>
                  <svg
                    className="ehc-icon"
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 32 32"
                  >
                    <path d="M4 8h24v18H4zM4 14h24M10 20h6" />
                  </svg>
                  <b>契約・発注</b>
                </li>
              </ol>
              <div className="decision-tip">
                <b>空調の更新も、まず確認から。</b>
                <span>制度名や細かい機器仕様が、まだ分からなくても大丈夫。</span>
              </div>
              <p className="decision-source">
                手順・対象条件は制度ごとに異なります。
                <a
                  href="https://syouenehojyokin.sii.or.jp/overview.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SIIの公式案内 ↗
                </a>
              </p>
            </figure>
            <a
              className="decision-next"
              href="#what-you-get"
              onClick={(e) => jump(e, "what-you-get")}
            >
              診断すると、何が分かる？ ↓
            </a>
          </section>

          {/* 5. 診断でわかること（3枚の積層カード） */}
          <section
            className="discover-section"
            id="what-you-get"
            aria-labelledby="discover-title"
          >
            <div className="discover-inner">
              <div className="discover-intro">
                <p className="section-label">診断でわかること</p>
                <h2 id="discover-title">
                  診断で、
                  <br />
                  ここまで見える。
                </h2>
                <p>
                  あなたの条件に合う候補。間に合う時期。
                  <br />
                  設備情報を加えると、費用まで。
                </p>
                <div className="chapter-nav" aria-label="3つの確認事項">
                  <a
                    href="#benefit-program"
                    className={activeChapter === "benefit-program" ? "is-current" : ""}
                    aria-label="制度の候補へ"
                    onClick={(e) => jump(e, "benefit-program")}
                  >
                    01
                  </a>
                  <a
                    href="#benefit-deadline"
                    className={activeChapter === "benefit-deadline" ? "is-current" : ""}
                    aria-label="期限と準備へ"
                    onClick={(e) => jump(e, "benefit-deadline")}
                  >
                    02
                  </a>
                  <a
                    href="#benefit-cost"
                    className={activeChapter === "benefit-cost" ? "is-current" : ""}
                    aria-label="費用の比較へ"
                    onClick={(e) => jump(e, "benefit-cost")}
                  >
                    03
                  </a>
                </div>
                <button
                  type="button"
                  className="text-link light-link"
                  onClick={startDiagnosis}
                >
                  無料診断へ ↗
                </button>
              </div>

              <div className="discovery-stack">
                <article className="discovery-card" id="benefit-program">
                  <div className="card-heading">
                    <p>
                      <svg
                        className="ehc-icon"
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 32 32"
                      >
                        <path d="M14 4a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM21 21l7 7" />
                      </svg>{" "}
                      制度の候補
                    </p>
                    <span>01</span>
                  </div>
                  <div className="card-visual candidate-visual">
                    <div>
                      <span className="state-dot" />
                      申請できる可能性
                      <i>↗</i>
                    </div>
                    <div>
                      <span className="state-dot amber" />
                      条件の確認が必要
                      <i>＋</i>
                    </div>
                    <div>
                      <span className="state-dot gray" />
                      対象外・受付終了
                      <i>－</i>
                    </div>
                  </div>
                  <h3>うちに合う候補が、見える。</h3>
                  <p>
                    所在地・事業者区分・更新内容から、
                    <br />
                    可能性のある制度と、足りない条件を整理。
                  </p>
                  <small>
                    資格の確定・採択・受給を保証するものではありません。
                  </small>
                </article>

                <article className="discovery-card" id="benefit-deadline">
                  <div className="card-heading">
                    <p>
                      <svg
                        className="ehc-icon"
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 32 32"
                      >
                        <path d="M16 5a11 11 0 1 0 0 22 11 11 0 0 0 0-22zM16 10v6l4 3" />
                      </svg>{" "}
                      期限と準備
                    </p>
                    <span>02</span>
                  </div>
                  <div className="card-visual timeline-visual">
                    <div className="timeline-track">
                      <div>
                        <b>いま</b>
                        <span>条件を確認</span>
                      </div>
                      <div>
                        <b>準備</b>
                        <span>見積・書類</span>
                      </div>
                      <div>
                        <b>申請</b>
                        <span>受付期限</span>
                      </div>
                    </div>
                    <p>
                      <span className="status-dot" /> 期限が未定なら「未定」と表示
                    </p>
                  </div>
                  <h3>いつ動くか、見えてくる。</h3>
                  <p>
                    受付状況と、準備にかかる時間の目安を確認。
                    <br />
                    契約・発注の前に、次の一手がわかります。
                  </p>
                  <small>
                    公式の受付情報と準備期間の目安は、区別して表示します。
                  </small>
                </article>

                <article className="discovery-card" id="benefit-cost">
                  <div className="card-heading">
                    <p>
                      <svg
                        className="ehc-icon"
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 32 32"
                      >
                        <path d="M4 24h6V13H4zM13 24h6V6h-6zM22 24h6v-8h-6z" />
                      </svg>{" "}
                      費用の比較
                    </p>
                    <span>03</span>
                  </div>
                  <div className="card-visual cost-visual">
                    <div className="cost-row">
                      <span>補助金なし</span>
                      <div className="cost-bar full">更新費用</div>
                    </div>
                    <div className="cost-row">
                      <span>採択された場合</span>
                      <div className="cost-bar split">
                        <b>実質負担</b>
                        <i>想定補助</i>
                      </div>
                    </div>
                    <p>比較方法のイメージ・補助割合を示すものではありません</p>
                  </div>
                  <h3>負担の違いを、制度ごとに。</h3>
                  <p>
                    設備条件を足して、同じ条件で比較。
                    <br />
                    候補が複数なら、制度ごとに試算します。
                  </p>
                  <small>
                    未確認の補助額は反映しません。補助額の合算もしません。
                  </small>
                </article>
              </div>
            </div>
          </section>

          {/* 6. サポート・施工実績 */}
          <section className="support-section section-pad" id="support">
            <div className="support-copy reveal">
              <span className="section-label">空調更新をサポート</span>
              <h2>
                制度の確認から、
                <br />
                空調工事の相談まで。
              </h2>
              <p>
                確認した結果をもとに、
                <br />
                設備・工事の進め方も、EHCに相談できます。
              </p>
              <button type="button" className="text-link" onClick={startDiagnosis}>
                設備入力のイメージを見る ↗
              </button>
            </div>
            <div className="partner-record reveal">
              <span className="section-label">施工パートナー・PN社の実績</span>
              <article>
                <span>OFFICE</span>
                <h3>ニデック株式会社</h3>
                <p>本社空調改修工事</p>
              </article>
              <article>
                <span>BANK</span>
                <h3>三井住友銀行 六本木支店</h3>
                <p>空調・給排気改修工事</p>
              </article>
              <small>
                PN社の施工実績です。出典：PN社資料「ZERO START」2025年9月版。各案件の補助金利用・削減効果を示すものではありません。
              </small>
            </div>
          </section>

          {/* 7. クロージング */}
          <section className="closing-section" id="lets-start">
            <div className="closing-breeze" aria-hidden="true">
              <svg viewBox="0 0 1200 600" preserveAspectRatio="none">
                <defs>
                  <linearGradient
                    id="ehc-closing-air"
                    x1="0"
                    y1="1"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0" stopColor="#599d62" stopOpacity="0" />
                    <stop offset=".40" stopColor="#76b26c" stopOpacity=".50" />
                    <stop offset=".64" stopColor="#fffef0" stopOpacity=".90" />
                    <stop offset="1" stopColor="#76b26c" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient
                    id="ehc-closing-air-soft"
                    x1="0"
                    y1="1"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0" stopColor="#61a665" stopOpacity="0" />
                    <stop offset=".5" stopColor="#8ebf71" stopOpacity=".30" />
                    <stop offset=".8" stopColor="#f7ffdc" stopOpacity=".48" />
                    <stop offset="1" stopColor="#8ebf71" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="breeze-wide"
                  pathLength={1700}
                  d="M-160 480 C130 560 210 180 470 210 S830 550 1070 180 S1380 30 1480 70"
                />
                <path
                  className="breeze-main"
                  pathLength={1700}
                  d="M-150 480 C140 555 215 178 475 209 S835 555 1075 179 S1380 30 1480 70"
                />
                <path
                  className="breeze-fine"
                  pathLength={1700}
                  d="M-160 505 C135 582 218 220 480 248 S845 570 1087 212 S1370 60 1480 90"
                />
              </svg>
            </div>
            <div className="closing-inner">
              <p className="section-label">まだ見積もり前でも、大丈夫。</p>
              <h2>
                <span className="closing-line">更新を決める前に、</span>
                <span className="closing-line">確認だけでも。</span>
              </h2>
              <button type="button" className="primary" onClick={startDiagnosis}>
                無料で今すぐ診断 ↗
              </button>
              <p>7問から、匿名で確認。分からない項目は後から。</p>
            </div>
            <div className="closing-word" aria-hidden="true">
              EHC
            </div>
          </section>
        </section>
      </main>

      <div
        ref={dockRef}
        className={`mobile-dock${dockShow ? " show" : ""}`}
        aria-hidden={!dockShow}
      >
        <span>空調更新に使える制度を確認</span>
        <button type="button" onClick={startDiagnosis} tabIndex={dockShow ? 0 : -1}>
          無料診断 ↗
        </button>
      </div>
    </div>
  );
}
