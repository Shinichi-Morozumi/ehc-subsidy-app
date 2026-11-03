// 連絡先・回答・クリックIDは保存しない。広告入口とQA区分だけを同じタブで保持。
import { AD_CAMPAIGN } from "./adConsultation";
import { readLeadContext, type LeadContext } from "./leadContext";
const KEY = "ehc_lead_context_v1";
const TTL = 24 * 3600000;
let memory: { at: number; value: LeadContext } | null = null;
export function currentLeadContext(now = Date.now()): LeadContext {
  if (typeof window === "undefined") return readLeadContext(null);
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (v && typeof v.at === "number" && now >= v.at && now - v.at < TTL) memory = { at: v.at, value: readLeadContext(v.value) };
  } catch { /* 同じページではメモリで保持 */ }
  if (memory && now - memory.at >= TTL) memory = null;
  return memory?.value ?? readLeadContext(null);
}
export function captureLeadContext(now = Date.now()): LeadContext {
  const old = currentLeadContext(now);
  const q = new URLSearchParams(window.location.search);
  const flow = q.get("adflow");
  const qa = q.get("qa");
  const value = readLeadContext({ ...old,
    ...(flow === "lp" || flow === "diagnosis" ? { variant: flow, campaign: q.get("utm_campaign") === AD_CAMPAIGN ? AD_CAMPAIGN : null } : {}),
    ...(qa && /^[a-zA-Z0-9_-]{1,64}$/.test(qa) ? { test: true, testRun: qa } : q.get("adtest") === "1" ? { test: true } : {}),
  });
  memory = { at: now, value };
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* 保存不可でも受付可能 */ }
  return value;
}
export function leaveTestMode(): void {
  const value = { ...currentLeadContext(), test: false, testRun: null };
  memory = { at: Date.now(), value };
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* メモリのみ */ }
  const u = new URL(window.location.href); u.searchParams.delete("qa"); u.searchParams.delete("adtest");
  window.history.replaceState(window.history.state, "", u);
}
