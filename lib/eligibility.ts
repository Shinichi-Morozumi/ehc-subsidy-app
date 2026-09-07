import { Subsidy, MatchInput, EquipGroup } from "./types";

/* 2026-08-24 監査で新設。
   狙いは1つだけ ――「適格性が判定できていない制度の金額を、画面に出さない」。

   これまでの構造では、金額の可否判定は match.ts のフィルタ1本に閉じていた。
   フィルタは true/false しか返さないので、
     ・要件を満たさないから0円なのか
     ・こちらが情報を持っていないから0円なのか
   を呼び出し側が区別できず、UIは一律に「該当なし」と表示していた。
   実務ではこの2つは全く違う。前者は本当に対象外、後者は「聞けば対象かもしれない」。
   後者を「該当なし」と表示すると取れる補助金を取り逃がすし、
   逆に不明のまま金額を出すと、根拠のない数字を客に渡すことになる。

   そこで判定を3値にする:
     eligible    … 判定に必要な情報が揃い、要件を満たす → 金額を出してよい
     needs_check … 判定に必要な情報が欠けている         → 金額は出さず、不足事項を出す
     ineligible  … 要件を満たさないことが確定           → 対象外と明示する

   ここで重要なのは「不足事項」と「確認事項」を混ぜないこと。
   ・blockers / missing … 判定そのものが出来ない、または対象外が確定 → 金額を止める
   ・confirmations      … 判定は出来るが申請前に見ておくべき事      → 金額は止めない
   混ぜると、書類の話（法人か個人事業主か等）だけで全制度が0円になり、
   アプリが何も答えられなくなる。実際そうなりかけたので、明示的に分けている。

   このファイルは事実判定だけを行い、金額計算・表示文言は持たない。 */

export type EligibilityVerdict = "eligible" | "needs_check" | "ineligible";

export interface EligibilityResult {
  verdict: EligibilityVerdict;
  /** 対象外が確定した理由（そのまま画面に出してよい文言） */
  blockers: string[];
  /** 判定に必要なのに、こちらが情報を持っていない事項＝先に聞くべきこと */
  missing: string[];
  /** 判定は出来るが、申請前に確認しておく事項。金額表示は止めない */
  confirmations: string[];
  /** 金額・回収年数の根拠として使ってよいか（infoOnly 制度はここで false） */
  amountUsable: boolean;
}

/** 金額を画面・提案書・メールに出してよいか。 */
export function canShowAmount(r: EligibilityResult): boolean {
  return r.verdict === "eligible" && r.amountUsable;
}

/* 制度側の状態（受付中か・公式確認済みか）。
   ここを通らないものは、要件以前に金額の根拠が無い。 */
function checkProgramState(s: Subsidy, out: EligibilityResult): void {
  if (s.closed || s.status === "closed") {
    out.blockers.push("今年度の受付は終了しています。");
  } else if (s.status === "suspended") {
    out.blockers.push("現在、公募が停止されています。");
  } else if (s.status === "upcoming") {
    out.missing.push("公募開始前です。要件・補助率は次回公募要領の公表待ちです。");
  } else if (s.status !== "open") {
    out.missing.push("公募状況が未確認です。制度ページで受付中かご確認ください。");
  }

  if (s.verificationState !== "verified") {
    const label =
      s.verificationState === "needs_review"
        ? "内容の再確認が必要"
        : s.verificationState === "stale"
        ? "最終確認から時間が経過"
        : "公式情報を取得できていない";
    out.missing.push(`制度情報が公式確認済みではありません（${label}）。`);
  }
}

/* 申請者側の属性要件。情報が「無い」のか「合わない」のかを必ず区別する。 */
function checkApplicant(s: Subsidy, input: MatchInput, out: EligibilityResult): void {
  if (!s.biz.includes(input.bizType)) {
    out.blockers.push("対象となる事業者区分に該当しません。");
  }
  if (!s.size.includes(input.size)) {
    out.blockers.push("対象となる企業規模に該当しません。");
  }
  if (s.pref !== "all") {
    if (!input.pref) {
      out.missing.push("所在地（都道府県）が未入力のため、地域要件を判定できません。");
    } else if (!s.pref.includes(input.pref)) {
      out.blockers.push("対象地域外です。");
    }
  }
  /* 法人か個人事業主かで提出書類が変わる（登記事項証明書 / 確定申告書）。
     ただし採否そのものを左右しないので、金額は止めない。 */
  if (!input.entityType) {
    out.confirmations.push("法人・個人事業主の別が未確認です（提出書類が変わります）。");
  }
}

/* 設備要件。1グループでも対象種別があれば満たす（match.ts と同じ考え方）。 */
function checkEquipment(s: Subsidy, groups: EquipGroup[], out: EligibilityResult): void {
  if (!groups.length) {
    out.missing.push("対象設備が未入力のため、設備要件を判定できません。");
    return;
  }
  if (!groups.some((g) => s.target.includes(g.equip))) {
    out.blockers.push("対象設備の種別に該当しません。");
  }
  if (groups.some((g) => !g.installYear)) {
    out.confirmations.push("設置年が未入力の設備があります（削減効果の根拠になります）。");
  }
}

/* 制度ごとの個別要件。match.ts に散っていた id 判定をここへ集約する。
   ここに挙げていない制度は「本アプリで個別要件を自動判定していない」だけで、
   要件が無いという意味ではない。だから確認事項として必ず出す。 */
const PROGRAM_SPECIFIC_HANDLED = new Set([
  "sii_iv",
  "sii_gx",
  "kanagawa",
  "hotel_sustainability",
  "osaka",
  "tokyo_zeroemi",
  "saitama",
  "chiba",
]);

function checkProgramSpecific(
  s: Subsidy,
  input: MatchInput,
  ctx: { co2ReductionTon: number },
  out: EligibilityResult
): void {
  if (s.id === "kanagawa") {
    if (!ctx.co2ReductionTon) {
      out.missing.push("CO2削減量を算定できていないため、県の削減要件を判定できません。");
    } else if (ctx.co2ReductionTon < 3) {
      out.blockers.push("CO2削減量が要件（3t/年以上）に達していません。");
    }
  }
  if (s.id === "hotel_sustainability" && input.building !== "hotel") {
    out.blockers.push("宿泊施設が対象の制度です。");
  }
  if (!PROGRAM_SPECIFIC_HANDLED.has(s.id)) {
    out.confirmations.push(
      "この制度は個別要件を本アプリで自動判定していません。公募要領でご確認ください。"
    );
  }
}

/* 申請期間。締切超過は対象外が確定するので blockers。
   期間が未確定なだけなら確認事項に留める（制度自体は生きている）。 */
function checkWindow(s: Subsidy, now: Date, out: EligibilityResult): void {
  const today = now.toISOString().slice(0, 10);
  if (s.applyClose && s.applyClose < today) {
    out.blockers.push(`申請締切（${s.applyClose}）を過ぎています。`);
    return;
  }
  if (s.applyOpen && s.applyOpen > today) {
    out.confirmations.push(`公募開始（${s.applyOpen}）前です。開始後に申請できます。`);
  }
  if (!s.applyOpen && !s.applyClose) {
    out.confirmations.push("公募期間が未確定です。制度ページで最新の受付期間をご確認ください。");
  }
}

export function checkEligibility(
  s: Subsidy,
  input: MatchInput,
  ctx: { co2ReductionTon: number; now?: Date }
): EligibilityResult {
  const out: EligibilityResult = {
    verdict: "needs_check",
    blockers: [],
    missing: [],
    confirmations: [],
    amountUsable: !s.infoOnly,
  };

  checkProgramState(s, out);
  checkApplicant(s, input, out);
  checkEquipment(s, input.equipGroups, out);
  checkProgramSpecific(s, input, ctx, out);
  checkWindow(s, ctx.now ?? new Date(), out);

  if (s.infoOnly) {
    out.confirmations.push(
      "情報提供のみの制度です。補助額・回収年数の計算には含めていません。"
    );
  }

  out.verdict = out.blockers.length
    ? "ineligible"
    : out.missing.length
    ? "needs_check"
    : "eligible";
  return out;
}

/* ───────────── 併用（重複受給）の可否 ─────────────

   併用可否は各制度の公募要領に書かれた事項であり、こちらで断定できない。
   断定できないものを「併用可」と表示すると、返還リスクを客に負わせる。
   なので返り値に「併用可」は用意しない。不可が確定しているか、要確認かの2値。 */
export type CombineVerdict = "not_allowed" | "needs_confirmation";

export interface CombineResult {
  verdict: CombineVerdict;
  reason: string;
}

/** 同一の設備・経費に対して重ねて申請できない組み合わせ。 */
const EXCLUSIVE_PAIRS: Array<[string, string]> = [
  ["sii_iv", "sii_gx"], // 同一SII内の枠違い。同じ設備で両枠には出せない
];

export function canCombine(aId: string, bId: string): CombineResult {
  if (aId === bId) {
    return { verdict: "not_allowed", reason: "同一制度への二重申請はできません。" };
  }
  const hit = EXCLUSIVE_PAIRS.some(
    ([x, y]) => (x === aId && y === bId) || (x === bId && y === aId)
  );
  if (hit) {
    return {
      verdict: "not_allowed",
      reason: "同一の設備・経費に対して、この2制度を重ねて申請することはできません。",
    };
  }
  return {
    verdict: "needs_confirmation",
    reason:
      "同一経費への重複受給の可否は各制度の公募要領に定めがあります。併用を前提とした金額は提示せず、申請前に双方の事務局へご確認ください。",
  };
}

/* 複数制度の合算額を出してよいか。
   併用可を断定できない以上、2件以上の合算は出さない（安全側）。
   本アプリが「最大額1件」を採用しているのは、この判断による。 */
export function canSumAmounts(ids: string[]): boolean {
  return ids.length <= 1;
}
