"use client";

/* v1 / 2026-09-08  EHC-0027 / PJ-20260907-01
   トップは v17 デザインのホーム（HomeV17）。CTA を押すと既存の OPEN_HEARING_EVENT が飛び、
   同じイベントを待っている GuidedDiagnosis（7問の匿名診断）が開くと同時に、
   ここで診断ツール側を表示へ切り替える。

   ツール側（HowItWorks / SubsidyMatcher）は最初から DOM にマウントしたまま
   display:none で隠す。中の GuidedDiagnosis がイベントを受け取れる状態を保つため、
   visibility ではなく display を使い、アンマウントもしない。
   判定ロジック・補助金データ・API には一切手を入れていない。 */

import { useEffect, useState } from "react";
import { OPEN_HEARING_EVENT } from "@/components/HowItWorks";
import { SubsidyMatcher } from "@/components/SubsidyMatcher";
import { DiagnosisFlow } from "@/components/DiagnosisFlow";
import { ProjectProvider } from "@/components/ProjectContext";
import { HomeV17 } from "@/components/home/HomeV17";
import { SiteFooter } from "@/components/SiteFooter";
import { legacyAccessFromSearch } from "@/lib/legacyAccess";
import { DRAFT_RESTORE_EVENT } from "@/lib/diagnosisDraft";
import { ArrowLeft, ClipboardList, ShieldCheck } from "lucide-react";
import "./diagnosis-ui.css";

export default function Page() {
  const [started, setStarted] = useState(false);
  const [staffMode, setStaffMode] = useState(false);

  /* 2026-09-25 UXレビュー No.3:
     担当者用の入口（?staff=1）と旧シミュレーターの共有リンク（?d=）は、
     ホームを飛ばして診断画面をそのまま開く。旧シミュレーターはこの2つの入口でしか出さない。 */
  useEffect(() => {
    const access = legacyAccessFromSearch(window.location.search);
    if (access.showLegacy) setStarted(true);
    setStaffMode(access.staff);
  }, []);

  useEffect(() => {
    const onOpen = () => setStarted(true);
    window.addEventListener(OPEN_HEARING_EVENT, onOpen);
    /* 2026-09-26 改善4: 「続きから再開」を押したら、診断の画面を開く（中身は各部品が戻す） */
    window.addEventListener(DRAFT_RESTORE_EVENT, onOpen);
    return () => {
      window.removeEventListener(OPEN_HEARING_EVENT, onOpen);
      window.removeEventListener(DRAFT_RESTORE_EVENT, onOpen);
    };
  }, []);

  /* 2026-09-26: 会社概要などから「/?start=1」で来たら、7問をすぐ開く（再読み込みで開き直さないよう、URLからは消す）。
     7問の画面（GuidedDiagnosis）は最初から置いてあるので、描画の次の回に知らせれば受け取れる。 */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") !== "1") return;
    params.delete("start");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    const timer = window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT)), 50);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (started) window.scrollTo({ top: 0, behavior: "auto" });
  }, [started]);

  return (
    <>
      {!started && <HomeV17 />}

      {/* 2026-09-25 UXレビュー No.29: 診断画面を main で囲み、読み上げソフトで本文へ直接移動できるようにする。
          ホーム（HomeV17）も main を持つ。隠れている側には hidden を付け、
          「hidden の付いていない main は1つだけ」という HTML の決まりを守る。
          要素の種類は切り替えない（切り替えると中身が作り直され、入力が消える）。 */}
      <main
        id="diagnosis-main"
        hidden={!started}
        className="ehc-workspace max-w-5xl mx-auto print-container"
        style={{ display: started ? undefined : "none" }}
      >
        {/* 2026-09-10 EHC-0032 LIGHT-01
            ツールの入口をメインページ（HomeV17）の紙面に合わせる。
            ダーク時代はここに blur-3xl の光の玉を2つ置いて奥行きを作っていたが、
            白地の上で同じことをすると光ではなく「にじみ・汚れ」に見えるので消す。
            奥行きは HomeV17 と同じ「淡いセージの面＋1pxの罫線」だけで出す。
            見出しの色は真っ黒ではなく ink(#143b2d)。HomeV17 の本文色と同じ。 */}
        <header className="ehc-workspace-header no-print">
          <button type="button" onClick={() => { setStarted(false); window.scrollTo({ top: 0, behavior: "auto" }); }} className="ehc-home-link" aria-label="入力を残してホームへ戻る">
            <ArrowLeft size={18} aria-hidden="true" /><span className="ehc-wordmark">EHC</span><span>ホーム</span>
          </button>
          <span className="ehc-workspace-tag">{staffMode ? "担当者モード" : "空調更新の診断"}</span>
        </header>
        <div className="ehc-workspace-intro no-print">
          <div>
            <h1>空調更新の診断</h1>
          </div>
          <button type="button" className="ehc-review-answers" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT))}>
            <ClipboardList size={18} aria-hidden="true" /> 基本条件を確認・変更
          </button>
        </div>

        {/* 2026-09-14 EHC-0039:
            5段の診断（候補を見る → 設備を入力 → 結果と根拠 → 概算費用と工事 →
            診断書を受け取って相談）を、既存の診断と同じ ProjectProvider の中に置く。
            SubsidyMatcher が ProjectContext へ流している回答（draft / input / result）を
            DiagnosisFlow が読むので、入口は今までどおり
            HomeV17 → OPEN_HEARING_EVENT → GuidedDiagnosis のままでよい。
            SubsidyMatcher 自体には手を入れていない（既存の導線を壊さないため）。 */}
        <ProjectProvider>
          <DiagnosisFlow />
          <SubsidyMatcher workspaceMode />
        </ProjectProvider>

        <footer className="ehc-workspace-footer no-print">
          <p><ShieldCheck size={18} aria-hidden="true" />公式情報の確認範囲を表示。採択・受給を保証するものではありません。</p>
          {/* 2026-09-26 UXレビュー No.26 の残り: 各段に何度も出ていた注意書きを、ここ1か所にまとめる。
              各段には短い一言と、ここへの案内だけを置く。 */}
          <details id="usage-notes" className="ehc-usage-notes">
            <summary>ご利用上の注意</summary>
            <ul>
              <li>制度の候補・判定・補助額は、ご入力の内容と公式情報（確認日を表示）にもとづく目安です。申請できること、採択・受給、補助額を保証するものではありません。</li>
              <li>公募の内容・補助率・上限・締切は、予告なく変わることや、予算に達して早く終わることがあります。申請の前に、必ず各制度の公式の案内をご確認ください。</li>
              <li>概算の費用は、ご入力の設備からの目安です。現地の確認のあと、正式なお見積りに置き換えます。</li>
              <li>省エネの効果（電気代の削減）は、設備の状態・使い方・気温で変わります。削減を保証するものではありません。</li>
              <li>複数の制度を同じ費用に重ねて使えるかは、各制度の公募要領で決まります。この診断では補助額を合算しません。</li>
            </ul>
          </details>
          <SiteFooter variant="workspace" />
        </footer>
      </main>
    </>
  );
}
