// EHC-0120 / v1 / 2026-11-03 — 広告2経路。3問では補助対象・金額を確定しない。
import { readConsultation, consultationLines, type ConsultationRequest } from "./consultation";

export const AD_CAMPAIGN = "ehc_zeroemi_flow_202611";
export const AD_INDUSTRIES = ["工場・倉庫", "事務所・オフィス", "店舗・飲食店", "病院・クリニック", "介護・福祉施設", "学校", "その他"] as const;
export const AD_BUDGETS = ["1,000万円未満", "1,000万〜1,500万円未満", "1,500万〜3,000万円未満", "3,000万円以上", "まだ分からない"] as const;
export const AD_PREFS = ["東京都", "神奈川県", "埼玉県", "千葉県", "その他"] as const;
export type AdVariant = "lp" | "diagnosis";
export interface AdConsultation {
  variant: AdVariant;
  requestId: string;
  pref: string;
  city: string;
  industry: string | null;
  budget: string | null;
  consultation: ConsultationRequest;
  test: boolean;
  campaign: typeof AD_CAMPAIGN | null;
}
export const AD_REQUEST_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readAdConsultation(raw: unknown, now = new Date()): { value: AdConsultation | null; error: string | null } {
  if (raw == null) return { value: null, error: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { value: null, error: "相談の入口を確認できません。ページを開き直してください。" };
  const r = raw as Record<string, unknown>;
  if ((r.variant !== "lp" && r.variant !== "diagnosis") || typeof r.requestId !== "string" || !AD_REQUEST_RE.test(r.requestId)) return { value: null, error: "相談の受付番号を確認できません。ページを開き直してください。" };
  if (!(AD_PREFS as readonly unknown[]).includes(r.pref) || typeof r.city !== "string" || !r.city.trim() || r.city.length > 60 || /[\u0000-\u001f<>]/.test(r.city)) return { value: null, error: "工事場所の都道府県・市区町村をご入力ください。" };
  const industry = (AD_INDUSTRIES as readonly unknown[]).includes(r.industry) ? String(r.industry) : null;
  const budget = (AD_BUDGETS as readonly unknown[]).includes(r.budget) ? String(r.budget) : null;
  if (r.variant === "diagnosis" && (!industry || !budget)) return { value: null, error: "施設の種類と、ご予算の目安をお選びください。" };
  const c = readConsultation(r.consultation, now);
  if (c.error || !c.value) return { value: null, error: c.error || "Zoom相談の候補日時を3つご入力ください。" };
  return { value: { variant: r.variant, requestId: r.requestId.toLowerCase(), pref: String(r.pref), city: r.city.trim(), industry, budget, consultation: c.value, test: r.test === true, campaign: r.campaign === AD_CAMPAIGN ? AD_CAMPAIGN : null }, error: null };
}

export function adConsultationLines(ad: AdConsultation): string[] {
  return [
    ...(ad.test ? ["【営業対象外・広告公開確認テスト／月次集計から除外】"] : []),
    `広告入口: ${ad.variant === "lp" ? "A・短いLP" : "B・3項目の相談目安"}`,
    `キャンペーン: ${ad.campaign ?? "広告以外／未確認"}`,
    `工事場所: ${ad.pref} ${ad.city}`,
    ...(ad.industry ? [`施設・業種: ${ad.industry}`] : []),
    ...(ad.budget ? [`対象設備等の予算（税抜の目安）: ${ad.budget}`] : []),
    "補助対象・補助額: 未確定。法人規模・所有関係・実機・CO2削減量の確認が必要。",
    ...consultationLines(ad.consultation),
  ];
}

/** 営業上の相談目安。補助金の適合判定や概算金額はここで作らない。 */
export function adGuidance(pref: string, budget: string): { title: string; reason: string } {
  if (pref !== "東京都") return { title: "工事場所の地域の制度を確認します", reason: "東京都のゼロエミ助成は都内の事業所向けです。通常の設備更新工事も含めてご相談いただけます。" };
  if (budget === AD_BUDGETS[0]) return { title: "まず、工事の範囲を整理しましょう", reason: "ご予算だけでは補助額を決められません。今回は補助額800万円を超える規模を優先してご案内しています。通常工事のご相談も承ります。" };
  return { title: "東京都の助成を使えるか、具体的に確認しましょう", reason: "都内の工事をご検討中ですね。対象になる法人・設備か、省エネ量が条件を満たすかをZoomで整理します。現時点では採択や金額は決まっていません。" };
}
