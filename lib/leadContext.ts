// EHC-0124 / 2026-11-03. 入口と試験区分を、同じ受付・通知・CRMで共有する。
import { AD_CAMPAIGN, AD_REQUEST_RE } from "./adConsultation";

export interface LeadContext {
  campaign: typeof AD_CAMPAIGN | null;
  variant: "lp" | "diagnosis" | null;
  test: boolean;
  testRun: string | null;
}
export function readLeadContext(raw: unknown): LeadContext {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return { campaign: r.campaign === AD_CAMPAIGN ? AD_CAMPAIGN : null,
    variant: r.variant === "lp" || r.variant === "diagnosis" ? r.variant : null,
    test: r.test === true,
    testRun: typeof r.testRun === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(r.testRun) ? r.testRun : null };
}
export function readRequestId(raw: unknown): { value: string | null; error: string | null } {
  if (raw == null) return { value: null, error: null }; // 旧画面との互換
  return typeof raw === "string" && AD_REQUEST_RE.test(raw)
    ? { value: raw.toLowerCase(), error: null }
    : { value: null, error: "受付番号を確認できません。入力画面を開き直してください。" };
}
export function leadContextLines(context?: LeadContext | null): string[] {
  if (!context) return [];
  return [
    ...(context.test ? [`【営業対象外・通し確認テスト／月次・広告実績から除外${context.testRun ? `：${context.testRun}` : ""}】`] : []),
    ...(context.variant ? [`広告からの入口: ${context.variant === "lp" ? "A・短いLP" : "B・3項目診断"}（ページ移動後も保持）`] : []),
    ...(context.campaign ? [`キャンペーン: ${context.campaign}`] : []),
  ];
}
