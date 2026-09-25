/* ───────────────────────────────────────────────────────────
   削減率の根拠を、画面とPDFで同じ文言にするための組み立て
   EHC-0039 v2 §4 作業3 / 台帳 #31 / 2026-09-16 v1

   画面（ResultStage / SubsidyMatcher）とPDF（ReportPrintSheet）で
   別々に文言を組むと、同じ案件の同じ群に2つの説明が出る。
   match.ts と ProgramMatchBoard.tsx で実際に起きたことなので繰り返さない。

   ここは「何と書くか」だけを持つ。判定はしない。
   どちらの根拠を採ったかは lib/match.ts が決め済みで（GroupResult.reductionBasis）、
   比較できたかどうかは lib/performanceCompare.ts が決め済みである。
   ─────────────────────────────────────────────────────────── */

import type { GroupResult } from "./match";
import { REDUCTION_BASIS_LABEL } from "./match";
import {
  EQUIP_COMBINATION_LABEL,
  EQUIP_SHAPE_LABEL,
  MODEL_GRADE_LABEL,
} from "./equipmentPerformance";
import type { SpecSource } from "./equipmentPerformance";

export interface ReductionBasisView {
  groupId: string;
  /** 設備群の表示名（GroupResult.label をそのまま使う） */
  groupLabel: string;
  basis: GroupResult["reductionBasis"];
  /** 「メーカー公表値（型番別）による比較」など */
  basisLabel: string;
  /** 採用した削減率（%表示用に丸めた整数ではなく、率のまま） */
  reductionRate: number;
  /** 根拠の断り書き（measured / coefficient で別） */
  note: string;
  /** measured のときだけ入る。既設→更新候補の対応と効率値 */
  measured: {
    fromModelNo: string;
    fromSeries: string;
    fromEfficiency: number;
    toModelNo: string;
    toSeries: string;
    toGradeLabel: string;
    toEfficiency: number;
    indexLabel: string;
    shapeLabel: string;
    combinationLabel: string;
    coolingKw: number | null;
    /** 型番どおりの比較で出た率。採用率と違う場合がある（負を0にしたとき） */
    rawReductionRate: number;
    sources: SpecSource[];
    conditionNote: string;
  } | null;
  /** 実機比較ができなかった理由。null＝比較できた、または型番を聞いていない */
  notComparable: { label: string; needed: string } | null;
  /** 型番の入力自体が無い群か（「照合を試みていない」と「試みたが載っていない」は別） */
  modelNotEntered: boolean;
}

export function buildReductionBasisView(g: GroupResult): ReductionBasisView {
  const c = g.measuredComparison;
  const base = {
    groupId: g.id,
    groupLabel: g.label,
    basis: g.reductionBasis,
    basisLabel: REDUCTION_BASIS_LABEL[g.reductionBasis],
    reductionRate: g.effectiveReductionRate,
    note: g.reductionBasisNote,
  };

  if (c == null) {
    return {
      ...base,
      measured: null,
      notComparable: null,
      modelNotEntered: true,
    };
  }

  if (c.status === "measured") {
    return {
      ...base,
      measured: {
        fromModelNo: c.from.modelNo,
        fromSeries: c.from.series,
        fromEfficiency: c.fromEfficiency,
        toModelNo: c.to.modelNo,
        toSeries: c.to.series,
        toGradeLabel: MODEL_GRADE_LABEL[c.to.grade],
        toEfficiency: c.toEfficiency,
        indexLabel: c.indexLabel,
        shapeLabel: EQUIP_SHAPE_LABEL[c.from.shape],
        combinationLabel: EQUIP_COMBINATION_LABEL[c.from.combination],
        coolingKw: c.from.coolingKw,
        rawReductionRate: c.reductionRate,
        sources: c.sources,
        conditionNote: c.conditionNote,
      },
      notComparable: null,
      modelNotEntered: false,
    };
  }

  return {
    ...base,
    measured: null,
    notComparable: { label: c.label, needed: c.needed },
    modelNotEntered: false,
  };
}

export function buildReductionBasisViews(groups: GroupResult[]): ReductionBasisView[] {
  return groups.map(buildReductionBasisView);
}

/** 1件でも実機比較で出した群があるか。画面の見出しを変えるのに使う */
export function hasMeasuredGroup(groups: GroupResult[]): boolean {
  return groups.some((g) => g.reductionBasis === "measured");
}

/** 全群が係数概算か。「公表値で比べた」と名乗ってよいかの判定に使う */
export function allCoefficientGroups(groups: GroupResult[]): boolean {
  return groups.every((g) => g.reductionBasis === "coefficient");
}

/** 出典の一覧（重複除去）。PDFの末尾に出典をまとめて出すのに使う */
export function collectSpecSources(groups: GroupResult[]): SpecSource[] {
  const out: SpecSource[] = [];
  const seen = new Set<string>();
  groups.forEach((g) => {
    const c = g.measuredComparison;
    if (c == null || c.status !== "measured") return;
    c.sources.forEach((s) => {
      const key = `${s.catalog}#${s.page}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    });
  });
  return out;
}
