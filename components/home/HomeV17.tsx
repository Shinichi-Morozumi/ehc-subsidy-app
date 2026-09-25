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
import EhcScrollHero from "./EhcScrollHero";
import EntryWelcome from "./EntryWelcome";
import { OPEN_HEARING_EVENT } from "../HowItWorks";
import { SiteFooter } from "../SiteFooter";
import {
  useCardStack,
  useRevealOnScroll,
  useSectionMotion,
} from "./homeMotion";

export function HomeV17() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<HTMLButtonElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const [dockShow, setDockShow] = useState(false);
  const [activeChapter, setActiveChapter] = useState("benefit-program");

  const [headerHeight, setHeaderHeight] = useState(88);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(header);
    window.addEventListener("resize", measure, { passive: true });
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  /* 診断へ。既存アプリの入口イベントを発火するだけで、判定処理には触れない。 */
  const startDiagnosis = useCallback(() => {
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT));
  }, []);

  const toggleMotion = useCallback(() => {
    setMotionPaused((v) => !v);
  }, []);

  /* Escape は引き続きメニューを閉じる。映像は入力を遮らない。 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

  /* ボタンからページ内の節へ移る（a 要素でない所から呼ぶ用）。 */
  const scrollToId = useCallback(
    (id: string) => {
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
      setDockShow(!!heroRect && heroRect.bottom < 50);
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
  }, []);

  /* ホームの間だけ紙色の地にする。ツール側のダークテーマには触れない。 */
  useEffect(() => {
    document.body.classList.add("ehc17-home");
    return () => document.body.classList.remove("ehc17-home");
  }, []);

  useSectionMotion(rootRef, {
    paused: motionPaused,
    opening: introPlaying,
    replayKey: 0,
  });
  useCardStack(rootRef, { paused: motionPaused });
  useRevealOnScroll(rootRef, { paused: motionPaused });

  const rootClass = [
    "ehc17",
    motionPaused ? "motion-paused" : "",
    /* 2026-09-25 UXレビュー No.15: 画面下の固定バーが出ている間の目印。
       本文の下端にバーの高さ分の余白を足し、ヘッダーの同じボタンを隠す（home-v17.css の末尾）。 */
    dockShow ? "dock-on" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={rootRef} className={rootClass} data-screen="home">
      <EntryWelcome paused={motionPaused} onPlayingChange={setIntroPlaying} />
      <a href="#main-content" className="skip-main">
        本文へ
      </a>

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
          {/* 2026-09-25 UXレビュー No.16: 「↗」は一般に「別サイトが開く」の印。
              同じページで診断が始まるボタンには「→」を使い、外部リンクだけ「↗」にする。 */}
          <button type="button" className="header-start" onClick={startDiagnosis}>
            無料診断 →
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
          EHCの診断について
        </a>
        <a href="#what-you-get" onClick={(e) => jump(e, "what-you-get")}>
          診断でわかること
        </a>
        <a
          href="#diagnosis-report-preview"
          onClick={(e) => jump(e, "diagnosis-report-preview")}
        >
          診断書の見本
        </a>
        <a href="#support" onClick={(e) => jump(e, "support")}>
          空調更新のサポート
        </a>
        <a href="#dropin" onClick={(e) => jump(e, "dropin")}>
          ドロップインと実測の例
        </a>
        <a href="#site-footer" onClick={(e) => jump(e, "site-footer")}>
          運営会社・お問い合わせ
        </a>
        <a href="#home" onClick={(e) => jump(e, "home")}>
          空調更新の映像へ ↑
        </a>
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
          {/* 採用済み15秒映像。CTAは映像のロード・進行から独立。 */}
          <div ref={heroRef} style={{ paddingTop: headerHeight }}>
            <EhcScrollHero
              labelledBy="hero-title"
              stickyTop={headerHeight}
              paused={motionPaused}
              nextHref="#how-it-works"
              nextLabel="このまま次へ ↓"
              onNext={(e) => jump(e, "how-it-works")}
              copy={<>
            <div className="ehc-film__intro">
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
            <div className="ehc-film__cta">
              <button
                ref={startRef}
                type="button"
                className="primary"
                id="start"
                onClick={startDiagnosis}
              >
                無料で今すぐ診断{" "}
                <span className="button-arrow" aria-hidden="true">
                  →
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
              </>}
            />
          </div>

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
              </li>
              <li>
                <span className="flow-number">02</span>
                <div>
                  <h3>候補と費用を比べる</h3>
                  <p>設備情報を足してシミュレーション。</p>
                </div>
              </li>
              <li>
                <span className="flow-number">03</span>
                <div>
                  <h3>PDFで保存・相談する</h3>
                  <p>同意後に、次の行動へ。</p>
                </div>
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
                無料で今すぐ診断 →
              </button>
              {/* 2026-09-25: 「流れを見る」と書いてあるのに診断が始まっていた。書いてあるとおり、
                  3ステップの説明（#how-it-works）へ移る。 */}
              <button
                type="button"
                className="report-how"
                onClick={() => scrollToId("how-it-works")}
              >
                PDFの保存・相談までの流れを見る ↑
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
                  <span className="sr-only">（新しいタブで開きます）</span>
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
                  無料診断へ →
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
                    {/* 2026-09-25 UXレビュー No.18: 「↗ ＋ −」は操作（開く・追加）に見えるため外し、
                        診断結果（第3段階）と同じ呼び名で状態を示す。 */}
                    <div>
                      <span className="state-dot" />
                      使える見込みが高い
                    </div>
                    <div>
                      <span className="state-dot amber" />
                      条件次第
                    </div>
                    <div>
                      <span className="state-dot gray" />
                      今回は対象外
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
              {/* 2026-09-25: 「設備入力のイメージを見る」と書いてあるのに7問の診断が始まっていた。書いてあることに合わせる。 */}
              <button type="button" className="text-link" onClick={startDiagnosis}>
                7問の診断から始める →
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

          {/* 6.5 ドロップイン（冷媒の入れ替え）と実測の例（2026-09-25 UXレビュー No.23・24）
              大塚倉庫様は社名の掲載可、もう1件は施設名・所在地を伏せる（ご指示どおり）。
              数値は必ず「何を・どの条件で測ったか」と対にして出す（景品表示法の優良誤認を避ける）。
                大塚倉庫様：ENIMAS 省エネ効果レポート（2026-06-25）。−33% は速報値で、
                            比べ方で +6.2%〜−41.2% まで動く（検証済み・Obsidian の確定版ノート）。
                某所      ：施工完了報告書（2025-11-06）。7台合計の運転電流 29.04A → 14.55A（−49.9%）。
                            施工当日のスポット測定で、消費電力量・電気代の削減率ではない。 */}
          <section className="dropin-section section-pad" id="dropin" aria-labelledby="dropin-title">
            <div className="dropin-copy">
              <span className="section-label">買い替えの前に、もう一つの選択肢</span>
              <h2 id="dropin-title">
                空調機はそのままに、
                <br />
                冷媒を入れ替える。
              </h2>
              <p>
                ドロップインは、いまの業務用空調機を活かしたまま、冷媒だけを炭化水素系の冷媒へ入れ替える方法です。機器本体は交換しません。
                向いているかどうかは、設備の状態を見て判断します。
              </p>
            </div>
            <div className="dropin-cases">
              <article className="dropin-case">
                <span className="dropin-case-tag">物流倉庫</span>
                <h3>大塚倉庫株式会社 CROSS DOCK HARUMI（東京都中央区）</h3>
                <p className="dropin-case-what">業務用空調の冷媒を入れ替え</p>
                <p className="dropin-case-num">
                  <strong>−33%</strong>
                  <span>空調の消費電力量（速報値）</span>
                </p>
                <p className="dropin-case-note">
                  2026年5月14日〜6月15日（約30日）の実測。入れ替え前の実測から外気温1℃ごとの使用量をそろえて比べた推計です。
                  比べ方によって +6.2%〜−41.2% の幅があり、確定値ではありません。
                </p>
              </article>
              <article className="dropin-case">
                <span className="dropin-case-tag">施設</span>
                <h3>某所の施設（業務用パッケージエアコン 7台）</h3>
                <p className="dropin-case-what">冷媒を入れ替え（2025年11月）</p>
                <p className="dropin-case-num">
                  <strong>−49.9%</strong>
                  <span>運転電流（7台合計 29.04A → 14.55A）</span>
                </p>
                <p className="dropin-case-note">
                  施工当日に、同じ条件（外気温19℃）で施工の前と後に測った運転電流の比較です。
                  消費電力量や電気代の削減率ではなく、年間の効果を示すものでもありません。
                </p>
              </article>
            </div>
            <p className="dropin-foot">
              効果は、設備の状態・使い方・気温によって変わります。上の数値は、それぞれの条件のもとでの実測です。
            </p>
            <button type="button" className="text-link" onClick={startDiagnosis}>
              まずは7問の診断から →
            </button>
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
                無料で今すぐ診断 →
              </button>
              <p>7問から、匿名で確認。分からない項目は後から。</p>
            </div>
            <div className="closing-word" aria-hidden="true">
              EHC
            </div>
          </section>
        </section>
      </main>

      {/* 2026-09-25 UXレビュー No.22: 運営会社の所在地・電話・メール（値は lib/company.ts） */}
      <footer className="site-footer" id="site-footer">
        <SiteFooter variant="home" />
      </footer>

      <div
        ref={dockRef}
        className={`mobile-dock${dockShow ? " show" : ""}`}
        aria-hidden={!dockShow}
      >
        <span>空調更新に使える制度を確認</span>
        <button type="button" onClick={startDiagnosis} tabIndex={dockShow ? 0 : -1}>
          無料診断 →
        </button>
      </div>
    </div>
  );
}
