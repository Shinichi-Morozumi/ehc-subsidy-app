"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { MatchInput } from "@/lib/types";
import { MatchResult } from "@/lib/match";

/* 案件情報を画面横断で共有するストア。
   - draft  : 補助金マッチングの入力中の値（「即答」を押す前でも流れる）。
              見積シミュレーターが設備群を引き継ぐために使う。
   - input/result : 「即答」で確定した案件情報と判定結果。ロードマップ・提案PDF用。
   - estimateManYen : 見積シミュレーターが出した総額(万円・税抜)。
              案件情報の「今回更新分の設備投資概算」に取り込めるよう上流へ返すための値。
   これにより「案件情報 → 見積シミュレーター → 案件情報」が双方向に連動する。 */
interface Ctx {
  draft: MatchInput | null;
  input: MatchInput | null;
  result: MatchResult | null;
  estimateManYen: number | null;
  setDraft: (input: MatchInput) => void;
  setProject: (input: MatchInput, result: MatchResult | null) => void;
  setEstimateManYen: (manYen: number | null) => void;
}
const ProjectCtx = createContext<Ctx | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ draft: MatchInput | null; input: MatchInput | null; result: MatchResult | null }>({
    draft: null,
    input: null,
    result: null,
  });
  const [estimateManYen, setEstimateManYenState] = useState<number | null>(null);
  const setDraft = useCallback((draft: MatchInput) => setState((p) => ({ ...p, draft })), []);
  const setProject = useCallback(
    (input: MatchInput, result: MatchResult | null) => setState((p) => ({ ...p, draft: input, input, result })),
    []
  );
  const setEstimateManYen = useCallback((v: number | null) => setEstimateManYenState(v), []);
  return (
    <ProjectCtx.Provider value={{ ...state, estimateManYen, setDraft, setProject, setEstimateManYen }}>
      {children}
    </ProjectCtx.Provider>
  );
}

export function useProject(): Ctx {
  const c = useContext(ProjectCtx);
  if (!c) throw new Error("useProject must be used within ProjectProvider");
  return c;
}
