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
import { ArrowLeft, ClipboardList, ShieldCheck } from "lucide-react";
import "./diagnosis-ui.css";

export default function Page() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const onOpen = () => setStarted(true);
    window.addEventListener(OPEN_HEARING_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HEARING_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (started) window.scrollTo({ top: 0, behavior: "auto" });
  }, [started]);

  return (
    <>
      {!started && <HomeV17 />}

      <div
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
          <span className="ehc-workspace-tag">空調更新の診断</span>
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
          <p>© 2026 株式会社EHCソリューションズ</p>
        </footer>
      </div>
    </>
  );
}
