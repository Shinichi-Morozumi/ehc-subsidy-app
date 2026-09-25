/* ───────────────────────────────────────────────────────────
   実機性能どうしの比較（既設／更新候補）
   EHC-0039 v2 §4 作業3 / 台帳 #31 / 2026-09-16 v1

   ■ このファイルだけがやること

   lib/equipmentPerformance.ts が持っている「型番ごとの一次資料の値」を
   2つ受け取り、同じ稼働前提で比べられるかどうかを判定して、
   比べられるときだけ削減率を返す。

   ここに書かないもの:
   　・係数（経年劣化・冷媒世代差など）→ lib/coefficients.ts
   　・単価・排出係数・金額 → lib/pricing.ts
   　・制度の適格性 → lib/eligibility.ts
   　・3案の組み立てと合算 → lib/match.ts
   同じ式を2か所に書かない。ここは「比べてよいか」と「相対差」だけを持つ。

   ■ 削減率の考え方

   APF は「期間の空調能力(kWh) ÷ 期間の消費電力量(kWh)」である。
   同じ建物・同じ稼働（＝同じ期間空調能力）を前提にすると、
   　　消費電力量 = 期間空調能力 ÷ APF
   なので、既設 from を更新候補 to に替えたときの消費電力量の比は
   　　to の消費電力量 ÷ from の消費電力量 = APF_from ÷ APF_to
   となり、削減率は

   　　reductionRate = 1 − APF_from / APF_to

   これは「同じ稼働前提での相対差」であって、実際の建物の削減量ではない。
   その断りは lib/equipmentPerformance.ts の JIS_CONDITION_NOTE を使って
   画面・帳票に必ず添える。

   ■ 拒否する（埋めない）

   次のどれかに当たるときは削減率を作らない。理由と、何を揃えれば
   算定できるようになるか（needed）を返し、呼び出し側は係数概算に落ちる。

   　1. 効率の指標が違う（apf2015 と apf2006 など）
   　　 実データで起きる。SSRC112BJ は APF(2006) 6.4、SSRC112D は APF(2015) 7.4。
   　　 1 − 6.4/7.4 = 13.5% と出るが、この2つは別の基準の数字なので
   　　 この 13.5% は何も意味していない。
   　2. 冷房定格能力が一致しない
   　　 能力が変われば熱負荷に対する余裕が変わり、同じ稼働前提でなくなる。
   　3. 能力・効率のどちらかが一次資料で読めていない（null）
   　4. 効率が 0 以下・非有限（割り算が成り立たない）

   「0%」を返して比較したことにはしない。0% は「比べたが差が無い」の意味で、
   「比べられていない」とは別の事実である。
   ─────────────────────────────────────────────────────────── */

import {
  EFFICIENCY_INDEX_LABEL,
  JIS_CONDITION_NOTE,
  JIS_CONDITION_SOURCE,
  canCompareIndex,
  findBestModelFor,
  findModelSpecFromInputs,
} from "./equipmentPerformance";
import type {
  EfficiencyIndex,
  ModelGrade,
  ModelSpec,
  SpecSource,
} from "./equipmentPerformance";

/* ------------------------------------------------------------------ *
 * 結果の型
 * ------------------------------------------------------------------ */

/** 比べられなかった理由。画面はこの値から文言を作る（各画面で判定を書かない） */
export type NotComparableReason =
  | "from_model_unknown" // 既設の型番が一次資料に無い（または未入力）
  | "to_model_unknown" // 更新候補が一次資料から選べない
  | "index_mismatch" // 効率の指標が違う
  | "capacity_missing" // 冷房定格能力が一次資料で読めていない
  | "capacity_mismatch" // 冷房定格能力が一致しない
  | "efficiency_unusable"; // 効率が欠落・0以下・非有限

export const NOT_COMPARABLE_REASON_LABEL: Record<NotComparableReason, string> = {
  from_model_unknown: "既設機の型番が資料で特定できていません",
  to_model_unknown: "同条件の更新候補を資料から選べていません",
  index_mismatch: "既設と更新候補で効率の算出基準（APFの世代）が違います",
  capacity_missing: "定格能力が資料で確認できていません",
  capacity_mismatch: "既設と更新候補の定格能力が一致しません",
  efficiency_unusable: "効率の値が資料で確認できていません",
};

/** 何を揃えれば実機比較に切り替わるか。催促ではなく、こちら側の残作業として書く。 */
export const NOT_COMPARABLE_NEEDED: Record<NotComparableReason, string> = {
  from_model_unknown:
    "既設機の銘板（室外機の型番）を写真でいただくか、現地調査で確認します。型番が分かり、その型番の標準仕様ページを取得できた時点で実機比較に切り替わります。",
  to_model_unknown:
    "同じ室内機形状・同じ組合せ・同じ定格能力の更新候補を、メーカーの最新カタログから追加登録します。",
  index_mismatch:
    "既設側の APF を、更新候補と同じ JIS B8616：2015 基準の資料（または両者の定格消費電力）で取り直します。基準の違う値どうしを割り算することはしません。",
  capacity_missing:
    "当該型番の定格能力が載っている標準仕様ページを取得して登録します。",
  capacity_mismatch:
    "既設と同じ定格能力の更新候補を登録します。能力が違う機種に置き換える提案は、熱負荷の前提が変わるため別途現地調査で組みます。",
  efficiency_unusable:
    "当該型番の効率値が載っている標準仕様ページを取得して登録します。",
};

export interface MeasuredComparison {
  status: "measured";
  from: ModelSpec;
  to: ModelSpec;
  /** 比較に使った指標（両者で同一であることは検査済み） */
  index: EfficiencyIndex;
  indexLabel: string;
  fromEfficiency: number;
  toEfficiency: number;
  /** 1 − APF_from / APF_to。負になりうる（更新候補の方が効率が低い場合） */
  reductionRate: number;
  /** reductionRate > 0 か。0以下でも結果は返す（数字を作り替えない） */
  improves: boolean;
  /** 出典。画面・帳票にそのまま出す */
  sources: SpecSource[];
  /** 測定条件の断り書き */
  conditionNote: string;
}

export interface NotComparable {
  status: "not_comparable";
  reason: NotComparableReason;
  label: string;
  needed: string;
  /** 分かっている側だけ入る。画面が「既設は特定済み」等を出せるように残す */
  from: ModelSpec | null;
  to: ModelSpec | null;
}

export type PerformanceComparison = MeasuredComparison | NotComparable;

export function isMeasured(c: PerformanceComparison): c is MeasuredComparison {
  return c.status === "measured";
}

function notComparable(
  reason: NotComparableReason,
  from: ModelSpec | null,
  to: ModelSpec | null
): NotComparable {
  return {
    status: "not_comparable",
    reason,
    label: NOT_COMPARABLE_REASON_LABEL[reason],
    needed: NOT_COMPARABLE_NEEDED[reason],
    from,
    to,
  };
}

function usableEfficiency(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/* ------------------------------------------------------------------ *
 * 2型番の比較
 * ------------------------------------------------------------------ */

/**
 * 既設 from を更新候補 to に替えたときの、同じ稼働前提での消費電力の相対差。
 *
 * 順序に意味がある。from が既設、to が更新候補。
 */
export function comparePerformance(
  from: ModelSpec,
  to: ModelSpec
): PerformanceComparison {
  if (!canCompareIndex(from.efficiencyIndex, to.efficiencyIndex)) {
    return notComparable("index_mismatch", from, to);
  }
  if (!usableEfficiency(from.efficiency) || !usableEfficiency(to.efficiency)) {
    return notComparable("efficiency_unusable", from, to);
  }
  if (from.coolingKw == null || to.coolingKw == null) {
    return notComparable("capacity_missing", from, to);
  }
  /* 能力の一致は「同じ値」で見る。近い値に丸めない。
     カタログの能力は 0.1kW 刻みで書かれているので、浮動小数の誤差だけを許す。 */
  if (Math.abs(from.coolingKw - to.coolingKw) > 1e-9) {
    return notComparable("capacity_mismatch", from, to);
  }

  const reductionRate = 1 - from.efficiency / to.efficiency;

  /* 出典は重複を除いて並べる。同じページから2機種を取ったときに
     同じ行を2度出さないため。 */
  const sources: SpecSource[] = [];
  const seen = new Set<string>();
  [from.source, to.source, JIS_CONDITION_SOURCE].forEach((s) => {
    const key = `${s.catalog}#${s.page}`;
    if (seen.has(key)) return;
    seen.add(key);
    sources.push(s);
  });

  return {
    status: "measured",
    from,
    to,
    index: from.efficiencyIndex,
    indexLabel: EFFICIENCY_INDEX_LABEL[from.efficiencyIndex],
    fromEfficiency: from.efficiency,
    toEfficiency: to.efficiency,
    reductionRate,
    improves: reductionRate > 0,
    sources,
    conditionNote: JIS_CONDITION_NOTE,
  };
}

/* ------------------------------------------------------------------ *
 * 設備群の型番から比較する
 * ------------------------------------------------------------------ */

export interface ModelInputs {
  set?: string | null;
  indoor?: string | null;
  outdoor?: string | null;
}

/**
 * 既設の型番入力から、指定した位置づけ（標準機／高効率機）の更新候補を選び、比較する。
 *
 * 更新候補は「既設と同じ室内機形状・同じ組合せ・同じ冷房定格能力・同じ電源」の中から、
 * 一次資料に載っている機種だけを対象に、効率が最も高いものを選ぶ
 * （lib/equipmentPerformance.ts の findBestModelFor）。
 * 該当が無ければ候補を作らず、to_model_unknown を返す。
 *
 * 既設の型番が資料に無い場合も推定しない。from_model_unknown を返し、
 * 呼び出し側は係数概算に落ちる。
 */
export function compareFromModelInputs(
  models: ModelInputs,
  grade: ModelGrade
): PerformanceComparison {
  const from = findModelSpecFromInputs(models);
  if (from == null) return notComparable("from_model_unknown", null, null);
  if (from.coolingKw == null) return notComparable("capacity_missing", from, null);

  const to = findBestModelFor({
    shape: from.shape,
    combination: from.combination,
    coolingKw: from.coolingKw,
    grade,
    phase: from.phase,
  });
  if (to == null) return notComparable("to_model_unknown", from, null);

  return comparePerformance(from, to);
}
