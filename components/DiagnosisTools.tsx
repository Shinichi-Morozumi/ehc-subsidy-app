"use client";

/* v1 / 2026-10-29 / EHC-0102 ブラッシュアップ5：トップを軽くする
   7問の診断（GuidedDiagnosis を含む SubsidyMatcher と、5段の DiagnosisFlow）をまとめた部品。
   app/page.tsx から next/dynamic で、押されたときだけ読み込む（トップの最初の読み込みから外す）。
   子の useEffect（7問の画面がイベントを待ち始める）は親より先に動くので、ここで onReady を呼べば、
   呼び出し側は「最初に押された開く合図」をもう一度送るだけで、7問の画面を開ける。 */

import { useEffect } from "react";
import { SubsidyMatcher } from "@/components/SubsidyMatcher";
import { DiagnosisFlow } from "@/components/DiagnosisFlow";
import { ProjectProvider } from "@/components/ProjectContext";

export default function DiagnosisTools({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return (
    <ProjectProvider>
      <DiagnosisFlow />
      <SubsidyMatcher workspaceMode />
    </ProjectProvider>
  );
}
