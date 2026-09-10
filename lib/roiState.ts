/* ───────────────────────────────────────────────────────────
   ROI表示の状態を1か所で決める（EHC-0031 F01 / F02 / F03）

   これまでの不具合:
   ・設備投資額の入力を空にすると Number("") が 0 になり、
     「実質負担額 ¥0」「投資回収 0年」と、あたかも無償で更新できる
     ような画面が出ていた。費用が不明なことと費用が0円であることは違う。
   ・補助金額も同様に、①要件が未確認 ②算定した結果0円 ③正の金額
     の3つが、すべて数値 0 に潰れていた。0円だからといって
     「補助対象外」とは限らない。
   ・画面とPDFが別々に判定・再計算していたため、同じ案件で
     違う数字が出ることがあった（F03）。

   そこで判定と計算をこのモジュールに集約し、画面・PDF・提案書・
   制度比較はすべて同じ RoiSnapshot を読む。PDF側で再判定しない。
   ─────────────────────────────────────────────────────────── */

/** 設備投資額の状態。unknown=見積前（空欄・0・負・非有限） */
export type InvestState = "unknown" | "known";

/**
 * 補助金額の状態。
 * ・unconfirmed = 要件・受付状況が未確認。金額はまだ出せない（0円ではない）
 * ・zero        = 算定した結果0円（自己負担で進める／対象外が確定）
 * ・positive    = 正の金額が算定できた
 */
export type SubsidyState = "unconfirmed" | "zero" | "positive";

export const INVEST_UNKNOWN_LABEL = "未算定（見積前）";
export const RECOVERY_UNKNOWN_LABEL = "未算定";

export const SUBSIDY_STATE_LABEL: Record<SubsidyState, string> = {
  unconfirmed: "未確認（要件確認前）",
  zero: "算定結果 0円",
  positive: "算定済み",
};

/** 未確認と0円を混同させない説明文。金額欄の代わりに出す */
export const SUBSIDY_STATE_NOTE: Record<SubsidyState, string> = {
  unconfirmed:
    "補助金額は未確認です。要件のチェックと受付状況の確認が済むまで金額を算定しません（0円という判定ではありません）。",
  zero:
    "補助金は0円で試算しています（自己負担）。金額が0円であることは、この設備が補助対象外であることを意味しません。",
  positive: "確認済みの要件にもとづく算定額です。交付決定までは概算です。",
};

/** 設備投資額（万円）が算定済みか。空欄→0 を「0円」と読まない */
export function resolveInvestState(investManYen: number | null | undefined): InvestState {
  if (investManYen == null) return "unknown";
  if (!Number.isFinite(investManYen)) return "unknown";
  if (investManYen <= 0) return "unknown";
  return "known";
}

/**
 * 補助金額の状態。
 * confirmed=要件・受付状況の確認が完了しているか。
 * 金額の正負ではなく、この確認の有無で unconfirmed と zero を分ける。
 * 正額判定は `> 0`。`>= 1` にすると 0.5万円（5,000円）の補助が0円扱いになる。
 */
export function resolveSubsidyState(args: {
  confirmed: boolean;
  amountManYen: number | null | undefined;
}): SubsidyState {
  const { confirmed, amountManYen } = args;
  if (!confirmed) return "unconfirmed";
  if (amountManYen == null || !Number.isFinite(amountManYen)) return "unconfirmed";
  return amountManYen > 0 ? "positive" : "zero";
}

export interface RoiSnapshot {
  investState: InvestState;
  /** 万円。unknown のときは null（0を入れない） */
  investManYen: number | null;
  subsidyState: SubsidyState;
  /** 万円。unconfirmed のときは null */
  subsidyManYen: number | null;
  /** 円/年 */
  saveYenPerYear: number;
  /** 万円。invest が unknown なら null */
  netInvestManYen: number | null;
  /** 年。算定できないときは null */
  recoveryYears: number | null;
  /** recoveryYears が null のときの理由。画面・PDFで必ず表示する */
  recoveryUnavailableReason: string | null;
  /** 補助金なしの場合の回収年数（比較表示用） */
  recoveryYearsNoSubsidy: number | null;
}

export function buildRoiSnapshot(args: {
  investManYen: number | null | undefined;
  /** 要件・受付状況の確認が完了しているか */
  subsidyConfirmed: boolean;
  subsidyManYen: number | null | undefined;
  saveYenPerYear: number;
}): RoiSnapshot {
  const investState = resolveInvestState(args.investManYen);
  const investManYen = investState === "known" ? Number(args.investManYen) : null;

  const subsidyState = resolveSubsidyState({
    confirmed: args.subsidyConfirmed,
    amountManYen: args.subsidyManYen,
  });
  const subsidyManYen =
    subsidyState === "unconfirmed" ? null : Math.max(0, Number(args.subsidyManYen) || 0);

  const save = Number.isFinite(args.saveYenPerYear) ? args.saveYenPerYear : 0;

  const netInvestManYen =
    investManYen == null ? null : Math.max(0, investManYen - (subsidyManYen ?? 0));

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const yearsFrom = (netManYen: number | null): number | null => {
    if (netManYen == null) return null;
    if (save <= 0) return null;
    const y = round1(netManYen / (save / 10000));
    return Number.isFinite(y) ? y : null;
  };

  const recoveryYears = yearsFrom(netInvestManYen);
  const recoveryYearsNoSubsidy = yearsFrom(investManYen);

  const recoveryUnavailableReason =
    recoveryYears !== null
      ? null
      : investState === "unknown"
      ? "設備投資額が未算定（見積前）のため、投資回収年数は算定できません。"
      : save <= 0
      ? "年間の電気代削減額が0円以下（削減が確認できない、または増加）のため、投資回収年数は算定できません。"
      : "算定に必要な条件が揃っていません。";

  return {
    investState,
    investManYen,
    subsidyState,
    subsidyManYen,
    saveYenPerYear: save,
    netInvestManYen,
    recoveryYears,
    recoveryUnavailableReason,
    recoveryYearsNoSubsidy,
  };
}

/* ── 表示ヘルパ。0年・0円・NaN・Infinity を画面に出さないための唯一の出口 ── */

export const yenOrUnknown = (manYen: number | null): string =>
  manYen == null ? INVEST_UNKNOWN_LABEL : `¥${Math.round(manYen * 10000).toLocaleString("ja-JP")}`;

export const yearsOrUnknown = (years: number | null): string =>
  years == null ? RECOVERY_UNKNOWN_LABEL : `${years}年`;

/* ── ROIグラフの系列定義。凡例はこの配列から作る（画面とPDFで文言・色を二重管理しない） ── */

export interface RoiSeriesDef {
  /** data の key。ラベルをそのまま key に使っている既存の実装に合わせる */
  key: string;
  color: string;
  strokeWidth: number;
  dotRadius: number;
  /** 凡例で使う短い色名 */
  colorName: string;
  best?: boolean;
}

const SERIES_DO_NOTHING: RoiSeriesDef = {
  key: "何もしない（旧機器維持）",
  color: "#dc2626",
  strokeWidth: 2.5,
  dotRadius: 3,
  colorName: "赤線",
};
const SERIES_UPDATE_NO_SUBSIDY: RoiSeriesDef = {
  key: "更新（補助金なし）",
  color: "#f59e0b",
  strokeWidth: 2.5,
  dotRadius: 3,
  colorName: "橙線",
};
const SERIES_UPDATE_WITH_SUBSIDY: RoiSeriesDef = {
  key: "更新（補助金あり）",
  color: "#059669",
  strokeWidth: 3,
  dotRadius: 4,
  colorName: "緑線",
  best: true,
};

/**
 * 補助金の状態に応じた系列。
 * 未確認・算定0円のときは緑線を描かない。
 * （従来は常に3本描いていたため、緑線が橙線と完全に重なり、
 *   凡例だけが「補助金あり」を約束している状態になっていた）
 */
export function roiSeriesFor(subsidyState: SubsidyState): RoiSeriesDef[] {
  return subsidyState === "positive"
    ? [SERIES_DO_NOTHING, SERIES_UPDATE_NO_SUBSIDY, SERIES_UPDATE_WITH_SUBSIDY]
    : [SERIES_DO_NOTHING, SERIES_UPDATE_NO_SUBSIDY];
}
