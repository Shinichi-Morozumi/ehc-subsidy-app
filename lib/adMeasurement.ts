// EHC-0120 / v1 / 2026-11-03 — 公開計測ID。個人情報や相談日時は渡さない。
export const GOOGLE_ADS_ID = "AW-18553105590";
import { captureLeadContext } from "./leadContextClient";
export const GOOGLE_ADS_SEND_TO = "AW-18553105590/GRbPCNyYjLEdELbZ545F";
export const GOOGLE_ADS_QA_SEND_TO = "AW-18553105590/BLwPCLjQmLEdELbZ545F"; // サブアクション・入札対象外
const CONSENT_KEY = "ehc_ad_measurement_v1";
type Gtag = (...args: unknown[]) => void;
type AdsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };
let initialized = false;
let memoryChoice: "granted" | "denied" | null = null;
const fired = new Set<string>();
export function measurementChoice(): "granted" | "denied" | null {
  try { const v = localStorage.getItem(CONSENT_KEY); return v === "granted" || v === "denied" ? v : memoryChoice; } catch { return memoryChoice; }
}
function safePage(): string {
  const u = new URL(window.location.href);
  const q = new URLSearchParams();
  const flow = u.searchParams.get("adflow");
  if (flow === "lp" || flow === "diagnosis") q.set("adflow", flow);
  for (const key of ["gclid", "gbraid", "wbraid"]) {
    const value = u.searchParams.get(key);
    if (value && /^[A-Za-z0-9_-]{10,512}$/.test(value)) q.set(key, value);
  }
  // Google自身が元の着地URLから広告クリックを処理する。人の入力や任意のUTMをイベントに混ぜない。
  return `${u.origin}${u.pathname}${q.size ? `?${q}` : ""}`;
}
export function enableAdMeasurement(allowQa = false): void {
  if (initialized || typeof window === "undefined" || (captureLeadContext().test && !allowQa)) return;
  initialized = true;
  const w = window as AdsWindow;
  w.dataLayer = w.dataLayer || [];
  // Googleの標準スニペットと同じArgumentsを積む。通常のArrayはコマンドとして処理されない。
  w.gtag = w.gtag || function () { w.dataLayer!.push(arguments); };
  w.gtag("consent", "default", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  w.gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied" });
  w.gtag("js", new Date());
  w.gtag("set", "ads_data_redaction", true);
  w.gtag("config", GOOGLE_ADS_ID, { send_page_view: false, allow_enhanced_conversions: false, allow_ad_personalization_signals: false, page_location: safePage(), page_referrer: "" });
  const script = document.createElement("script");
  script.id = "ehc-google-ads"; script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  document.head.appendChild(script);
}
export function chooseAdMeasurement(choice: "granted" | "denied"): void {
  memoryChoice = choice;
  try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* ブラウザ内保存不可でも相談はできる */ }
  if (choice === "granted") {
    enableAdMeasurement();
    (window as AdsWindow).gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied" });
  }
  else (window as AdsWindow).gtag?.("consent", "update", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
}
/** サーバの正常受付後だけ呼ぶ。同一受付の再描画や戻る操作では再発火しない。 */
export function recordAdConversion(receiptNo: string): boolean {
  if (typeof window === "undefined" || captureLeadContext().test || measurementChoice() !== "granted" || !/^(?:EHCAD-[0-9a-f-]{36}|EHC-[0-9a-f-]{36}|EHC-\d{8}-\d{6}-[0-9A-Z]{4})$/i.test(receiptNo)) return false;
  const key = `ehc_ad_cv_v2:${receiptNo}`;
  try { if (sessionStorage.getItem(key)) return false; } catch { /* メモリでも防ぐ */ }
  if (fired.has(key)) return false;
  enableAdMeasurement();
  fired.add(key);
  (window as AdsWindow).gtag?.("event", "conversion", { send_to: GOOGLE_ADS_SEND_TO, transaction_id: receiptNo, page_location: safePage(), page_referrer: "" });
  try { sessionStorage.setItem(key, "1"); } catch { /* Google側もtransaction_idで重複を防ぐ */ }
  return true;
}
/** 実受付の通し確認だけ。Google広告では入札対象外のサブアクションへ送る。 */
export function recordQaConversion(receiptNo: string): boolean {
  if (typeof window === "undefined" || !captureLeadContext().test || measurementChoice() !== "granted" || !/^(?:EHCAD-[0-9a-f-]{36}|EHC-[0-9a-f-]{36}|EHC-\d{8}-\d{6}-[0-9A-Z]{4})$/i.test(receiptNo)) return false;
  const key = `ehc_qa_cv_v1:${receiptNo}`;
  try { if (sessionStorage.getItem(key)) return false; } catch { /* メモリでも防ぐ */ }
  if (fired.has(key)) return false;
  enableAdMeasurement(true); fired.add(key);
  (window as AdsWindow).gtag?.("event", "conversion", { send_to: GOOGLE_ADS_QA_SEND_TO, transaction_id: `QA-${receiptNo}`, page_location: safePage(), page_referrer: "" });
  try { sessionStorage.setItem(key, "1"); } catch { /* メモリのみ */ }
  return true;
}
