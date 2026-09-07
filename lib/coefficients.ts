import { RefriType, EquipType } from "./types";
import { INDUSTRY_PROFILES } from "./industries";

/* 2026-08-27 監査での追加 ─ 削減率係数の出典管理
 *
 * これまで lib/match.ts の getAgeDegradationRate() / getRefrigerantGenRate() /
 * getEquipBonusRate() と lib/industries.ts の reductionPotentialPct は、
 * ただの `number` を返す関数だった。コメントに「資源エネルギー庁／メーカー資料」とは
 * 書いてあったが、どの資料の何ページかは誰も辿れず、画面には
 * 「出典: 資源エネルギー庁／メーカー資料／業界資料」とだけ出ていた。
 *
 * これは補助金の verificationState を必須にしたのと同じ問題である。
 * 出典の無い数字が、出典のある数字と同じ顔をして客先に出る。
 * 大塚倉庫の「6658 kg-CO2/年」も、単位を誰も検算しないまま出た数字だった。
 *
 * そこで係数を「値だけ」から「値＋根拠＋検証状態」へ構造ごと変える。
 *   - verified   … 一次資料が特定できている。sourceUrl と checkedAt が無いと型エラー。
 *   - provisional… 出典未確定の推定値。何を取れば確定するか(needed)が無いと型エラー。
 *   - definition … 定義上の基準値。value は 0 しか許さない（推定を紛れ込ませない）。
 *
 * 現時点で verified にできる係数は1つも無い。全て provisional である。
 * それが実態なので、実態のとおり provisional と書き、画面にも「暫定値」と出す。
 * 出典確定シート（v1_2026-08-24_…_係数と単価の出典確定シート.xlsx）が返ってきたら、
 * 該当係数を verified に書き換える。書き換え忘れは画面の「暫定値」表示で気づける。
 */

export type CoefficientVerification = "verified" | "provisional" | "definition";

interface CoefficientBase {
  /** 係数の値（比率。0.12 なら 12%） */
  value: number;
  /** 画面・帳票に出す名前 */
  label: string;
  /** どういう考え方で置いた値か */
  basis: string;
}

/** 一次資料が特定できている係数。URLと確認日が無いと型エラーになる。 */
export interface VerifiedCoefficient extends CoefficientBase {
  verification: "verified";
  sourceTitle: string;
  sourceUrl: string;
  /** ISO yyyy-mm-dd。人が実際に原典を開いて値を照合した日 */
  checkedAt: string;
}

/** 出典未確定の推定値。「何を取れば確定するか」が無いと型エラーになる。 */
export interface ProvisionalCoefficient extends CoefficientBase {
  verification: "provisional";
  /** この係数を verified に上げるために取得すべき一次資料 */
  needed: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

/** 定義上の基準値。0 以外は書けない（推定値を「定義」と偽れないようにする）。 */
export interface DefinitionCoefficient extends CoefficientBase {
  verification: "definition";
  value: 0;
}

export type Coefficient = VerifiedCoefficient | ProvisionalCoefficient | DefinitionCoefficient;

export function isProvisional(c: Coefficient): c is ProvisionalCoefficient {
  return c.verification === "provisional";
}

/* ------------------------------------------------------------------ *
 * 経年劣化率
 * ------------------------------------------------------------------ */

const AGE_NEEDED =
  "業務用空調の経年による効率低下率の一次資料（機種区分・低下率の定義・測定条件が明記されたもの）。" +
  "「年約2%低下」「10〜15年で20〜40%低下」は業界で広く引用される値だが、EHCとして提示できる原典を特定していない。";

const AGE_BASIS = "年約2%の効率低下を経過年数で積み上げ、25年で頭打ちとした社内推定";

/** 経過年数の降順。find() で最初に一致した段が採用される。 */
export const AGE_DEGRADATION_TIERS: { minYears: number; coefficient: Coefficient }[] = [
  { minYears: 25, coefficient: { verification: "provisional", value: 0.40, label: "経年劣化（築25年以上）", basis: AGE_BASIS, needed: AGE_NEEDED } },
  { minYears: 20, coefficient: { verification: "provisional", value: 0.33, label: "経年劣化（築20〜24年）", basis: AGE_BASIS, needed: AGE_NEEDED } },
  { minYears: 15, coefficient: { verification: "provisional", value: 0.25, label: "経年劣化（築15〜19年）", basis: AGE_BASIS, needed: AGE_NEEDED } },
  { minYears: 10, coefficient: { verification: "provisional", value: 0.12, label: "経年劣化（築10〜14年）", basis: AGE_BASIS, needed: AGE_NEEDED } },
  { minYears: 5, coefficient: { verification: "provisional", value: 0.08, label: "経年劣化（築5〜9年）", basis: AGE_BASIS, needed: AGE_NEEDED } },
  { minYears: 0, coefficient: { verification: "provisional", value: 0.03, label: "経年劣化（築4年以下）", basis: AGE_BASIS, needed: AGE_NEEDED } },
];

export function getAgeDegradationCoefficient(years: number): Coefficient {
  const tier = AGE_DEGRADATION_TIERS.find((t) => years >= t.minYears);
  // 段は minYears: 0 まで用意してあるので通常は必ず一致する。
  // 負の経過年数（設置年が未来）だけがここに落ちるので、最も小さい段に寄せる。
  return tier?.coefficient ?? AGE_DEGRADATION_TIERS[AGE_DEGRADATION_TIERS.length - 1].coefficient;
}

/* ------------------------------------------------------------------ *
 * 冷媒世代による技術効率差（現行R32を基準0として、旧世代ほど加算）
 * ------------------------------------------------------------------ */

const REFRI_NEEDED =
  "R22機・R410A機・R32機の同容量帯における通年エネルギー消費効率（APF）の比較値。" +
  "メーカー公表カタログの型番・年式まで特定し、比較条件（容量・運転条件）を揃えたうえで差を取り直す。";

export const REFRIGERANT_GEN_COEFFICIENTS: Record<RefriType, Coefficient> = {
  r22: { verification: "provisional", value: 0.12, label: "冷媒世代差（R22機）", basis: "R22機と現行R32機のAPF差から置いた社内推定", needed: REFRI_NEEDED },
  r410a: { verification: "provisional", value: 0.05, label: "冷媒世代差（R410A機）", basis: "R410A機と現行R32機のAPF差から置いた社内推定", needed: REFRI_NEEDED },
  r32: { verification: "definition", value: 0, label: "冷媒世代差（R32機）", basis: "更新後と同世代のため加算なし（基準）" },
  unknown: { verification: "provisional", value: 0.05, label: "冷媒世代差（冷媒不明）", basis: "冷媒不明の場合はR410A相当に寄せる安全側の仮置き", needed: "現地調査で銘板の冷媒種別を確認し、r22 / r410a / r32 のいずれかに確定させる。" },
};

export function getRefrigerantGenCoefficient(refri: RefriType): Coefficient {
  return REFRIGERANT_GEN_COEFFICIENTS[refri] ?? REFRIGERANT_GEN_COEFFICIENTS.unknown;
}

/* ------------------------------------------------------------------ *
 * 設備種別の制御効率差
 * ------------------------------------------------------------------ */

export const EQUIP_BONUS_COEFFICIENTS: Record<EquipType, Coefficient> = {
  multi: {
    verification: "provisional",
    value: 0.03,
    label: "制御効率差（ビル用マルチ）",
    basis: "室内機の個別・部分負荷制御による運用面の追加省エネを見込んだ社内推定",
    needed: "マルチ／パッケージを同一条件で比較した運用実績、またはVRFの部分負荷効率に関するメーカー資料。",
  },
  ac: { verification: "definition", value: 0, label: "制御効率差（パッケージ）", basis: "個別制御の上乗せを見込まない（基準）" },
};

export function getEquipBonusCoefficient(equip: EquipType): Coefficient {
  return EQUIP_BONUS_COEFFICIENTS[equip] ?? EQUIP_BONUS_COEFFICIENTS.ac;
}

/* ------------------------------------------------------------------ *
 * 業種別の高効率化削減率
 * ------------------------------------------------------------------ */

const INDUSTRY_NEEDED =
  "業種別の省エネ余地（reductionPotentialPct）の一次資料。省エネルギーセンター等の業種別診断事例を、" +
  "対象設備・基準年・削減メニューの範囲まで揃えて特定する。";

export function getIndustryReductionCoefficient(building: string): Coefficient {
  const profile = INDUSTRY_PROFILES[building] ?? INDUSTRY_PROFILES.other;
  return {
    verification: "provisional",
    value: profile.reductionPotentialPct / 100,
    label: `業種別 高効率化削減率（${profile.label}）`,
    basis: "業種別の電力消費内訳と省エネ余地から置いた社内推定",
    needed: INDUSTRY_NEEDED,
  };
}

/* ------------------------------------------------------------------ *
 * 監査：使った係数のうち出典未確定のものを集める
 * ------------------------------------------------------------------ */

export interface CoefficientAuditItem {
  label: string;
  value: number;
  basis: string;
  needed: string;
}

export interface CoefficientAudit {
  /** 使った係数がすべて verified / definition なら true */
  allSourced: boolean;
  /** 出典未確定の係数（ラベル重複は除外） */
  provisional: CoefficientAuditItem[];
}

export function auditCoefficients(used: Coefficient[]): CoefficientAudit {
  const seen = new Set<string>();
  const provisional: CoefficientAuditItem[] = [];
  used.forEach((c) => {
    if (!isProvisional(c) || seen.has(c.label)) return;
    seen.add(c.label);
    provisional.push({ label: c.label, value: c.value, basis: c.basis, needed: c.needed });
  });
  return { allSourced: provisional.length === 0, provisional };
}

/** 画面・帳票に共通で出す注記。文言を1箇所に集約する。 */
export const PROVISIONAL_COEFFICIENT_NOTE =
  "削減率の内訳に使用している係数は、現時点で一次資料を特定できていない暫定値です。" +
  "実際の削減量は建物・運用条件により変動します。契約前には現地調査と実測に基づく再算定を行います。";
