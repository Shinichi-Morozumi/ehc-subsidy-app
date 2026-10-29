// ID: EHC-0095 / v1 / 2026-10-26. 営業対象外は除外。未取得≠0。支払確定は別承認。
import { referralLinkOf } from "./referral";

export interface AgencyLead {
  receiptNo: string; ref: string; submittedAt: string; isTest: boolean; crmUrl: string;
}
export interface AgencyOrderLine {
  lineId: string; orderId: string; receiptNo: string; orderedOn: string;
  category: "gas" | "ac_equipment" | "interior_other" | "excluded";
  netYen: number; agreedRateBps: number | null; contractEvidence: string;
  isTest: boolean; cancelled: boolean;
}
export interface AgencyAnalytics {
  ref: string; opens: number | null; source: string;
  /** 同一JST月の全期間・本番環境、試験除外を確認した結果 */
  complete: boolean;
}
export interface MonthlyInput {
  month: string; leads: AgencyLead[]; orders: AgencyOrderLine[]; analytics: AgencyAnalytics[];
  leadsComplete: boolean; ordersComplete: boolean; checkedBy: string;
}
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("対象月はYYYY-MM");
  const [year, mon] = month.split("-").map(Number);
  const start = Date.parse(`${month}-01T00:00:00+09:00`);
  const end = Date.UTC(year, mon, 1) - 9 * 3600000;
  return { start, end, reportAt: end + 9 * 3600000 };
}
/** KRH01以外へこの料率を流用しない。基準額は顧客販売価格の税抜対象明細。 */
export function rewardEstimate(line: AgencyOrderLine, partnerId: string): number | null {
  if (partnerId !== "KRH01" || !["gas", "ac_equipment", "interior_other", "excluded"].includes(line.category) || !Number.isSafeInteger(line.netYen) || line.netYen < 0 || !line.contractEvidence?.trim()) return null;
  if (line.category === "excluded") return 0;
  const bps = line.category === "gas" ? 1000 : line.category === "ac_equipment" ? 300 : line.agreedRateBps;
  if (bps === null || !Number.isInteger(bps) || bps < 300 || bps > (line.category === "gas" ? 1000 : line.category === "ac_equipment" ? 300 : 500)) return null;
  // 円未満は確定支払ではなく試算。契約の端数条件は支払前に照合する。
  return Number(BigInt(line.netYen) * BigInt(bps) / 10000n);
}
export function closeAgencyMonth(input: MonthlyInput, now = new Date()) {
  const bounds = monthBounds(input.month);
  const issues: string[] = [];
  if (now.getTime() < bounds.reportAt) issues.push("翌月1日09:00（JST）前です。確定版は出しません。");
  if (!input.leadsComplete) issues.push("問い合わせ全件の照合が未完了");
  if (!input.ordersComplete) issues.push("受注全件・取消の照合が未完了");
  if (!input.checkedBy.trim()) issues.push("締め確認者が未入力");
  const leads = new Map<string, AgencyLead>();
  for (const lead of input.leads) {
    if (typeof lead.isTest !== "boolean" || !lead.receiptNo || !Number.isFinite(Date.parse(lead.submittedAt))) { issues.push("問い合わせの必須情報に不足"); continue; }
    const prev = leads.get(lead.receiptNo);
    if (prev && JSON.stringify(prev) !== JSON.stringify(lead)) issues.push(`受付番号の重複不一致: ${lead.receiptNo}`);
    else leads.set(lead.receiptNo, lead);
  }
  const lineIds = new Set<string>();
  const group = new Map<string, {partnerId:string; ref:string; enquiries:number; orderIds:Set<string>; netYen:number; rewardYen:number; rewardUnknown:boolean; opens:number|null}>();
  function entry(ref:string) {
    const link=referralLinkOf(ref); if (!link) return null;
    if (!group.has(ref)) group.set(ref,{partnerId:link.partnerId,ref,enquiries:0,orderIds:new Set(),netYen:0,rewardYen:0,rewardUnknown:false,opens:null});
    return group.get(ref)!;
  }
  for (const ref of ["krh01-care","krh01-dropin","krh01-clinic"]) entry(ref);
  for (const lead of leads.values()) {
    const at=Date.parse(lead.submittedAt); if (lead.isTest || at < bounds.start || at >= bounds.end) continue;
    const row=entry(lead.ref); if (row) row.enquiries++;
    else issues.push(`紹介元未登録: ${lead.receiptNo}`);
  }
  for (const line of input.orders) {
    if (typeof line.isTest !== "boolean" || typeof line.cancelled !== "boolean" || !line.lineId) {issues.push("受注明細の必須情報に不足");continue;}
    if (lineIds.has(line.lineId)) {issues.push(`明細ID重複: ${line.lineId}`);continue;} lineIds.add(line.lineId);
    const at=Date.parse(`${line.orderedOn}T00:00:00+09:00`);
    if (!Number.isFinite(at) || !/^\d{4}-\d{2}-\d{2}$/.test(line.orderedOn) || new Date(at+9*3600000).toISOString().slice(0,10)!==line.orderedOn) {issues.push(`受注日不正: ${line.lineId}`);continue;}
    if (line.isTest || line.cancelled || at < bounds.start || at >= bounds.end) continue;
    const lead=leads.get(line.receiptNo); const row=lead && !lead.isTest ? entry(lead.ref) : null;
    if (!row || !line.orderId || !Number.isSafeInteger(line.netYen) || line.netYen<0) {issues.push(`受注照合不能: ${line.lineId}`);continue;}
    row.orderIds.add(line.orderId); row.netYen+=line.netYen;
    const reward=rewardEstimate(line,row.partnerId);
    if (reward===null) {row.rewardUnknown=true;issues.push(`紹介料の契約・基準・料率未確認: ${line.lineId}`);} else row.rewardYen+=reward;
  }
  for (const row of group.values()) {
    const matches=input.analytics.filter(a=>a.ref===row.ref);
    const a=matches[0];
    if (matches.length!==1 || !a.complete || !a.source || a.opens===null || !Number.isSafeInteger(a.opens) || a.opens<0) issues.push(`月全体の試験除外済み計測が未確認: ${row.ref}`);
    else row.opens=a.opens;
  }
  return {schemaVersion:1,month:input.month,timezone:"Asia/Tokyo",status:issues.length?"blocked":"final",issues:[...new Set(issues)],
    rows:[...group.values()].map(({orderIds,rewardUnknown,...r})=>({...r,enquiries:input.leadsComplete?r.enquiries:null,orders:input.ordersComplete?orderIds.size:null,netYen:input.ordersComplete?r.netYen:null,rewardYen:input.ordersComplete&&!rewardUnknown?r.rewardYen:null})),
    note:"紹介料は税抜対象明細による試算。閲覧・申込・受注だけでは支払確定しません。入金・契約条件・支払承認は別途照合。"};
}
