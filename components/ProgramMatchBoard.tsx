"use client";

import { SUBSIDIES } from "@/lib/subsidies";
import { MatchInput, Subsidy } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { AlertCircle, CalendarClock, CheckCircle2, ExternalLink, HelpCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export type ProgramBucket = "A" | "B" | "C";

export interface ProgramAssessment {
  subsidy: Subsidy;
  bucket: ProgramBucket;
  reason: string;
  missing: string[];
  potentialManYen: number;
  outOfPocketManYen: number;
  nextAction: string;
  timing: string;
  monitorNote?: string;
}

const REFERENCE_NOW = new Date("2026-08-18T12:00:00+09:00");

function samePref(s: Subsidy, pref: string) {
  return s.pref === "all" || s.pref.includes(pref);
}

function dateLabel(value?: string) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}

function checkedLabel(value?: string) {
  if (!value) return "未確認";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildTiming(s: Subsidy) {
  if (s.status === "closed") return `受付終了${s.scheduleNote ? `。${s.scheduleNote}` : ""}`;
  if (s.status === "upcoming") return `受付予定：${dateLabel(s.applyOpen) ?? "公式発表待ち"}〜${dateLabel(s.applyClose) ?? "期限未定"}`;
  if (s.status === "open") {
    if (!s.applyClose) return "受付中（締切は公式要領で確認）";
    const days = Math.ceil((new Date(`${s.applyClose}T23:59:59+09:00`).getTime() - REFERENCE_NOW.getTime()) / 86400000);
    const lead = s.prepLeadDaysMax ?? 42;
    return `受付中・期限 ${dateLabel(s.applyClose)}。残り約${Math.max(0, days)}日、準備${s.prepLeadDaysMin ?? 21}〜${lead}日を見込むため${days >= lead ? "今から準備できる可能性があります" : "早急な個別確認が必要です"}`;
  }
  return s.scheduleNote || "受付時期は公式確認が必要です";
}

interface MonitorSourceState { id: string; fetchedAt: string; state: "unchanged" | "needs_review" | "unavailable"; note: string }
interface MonitorPayload { checkedAt: string; sources: MonitorSourceState[] }
let monitorPromise: Promise<MonitorPayload | null> | null = null;

function loadMonitor() {
  if (!monitorPromise) monitorPromise = fetch("/api/subsidies/monitor").then((r) => r.ok ? r.json() as Promise<MonitorPayload> : null).catch(() => null);
  return monitorPromise;
}

export function assessPrograms(input: MatchInput, result: MatchResult, monitorStates: Record<string, MonitorSourceState> = {}): ProgramAssessment[] {
  return SUBSIDIES.map((s) => {
    const monitored = monitorStates[s.id];
    const verificationState = monitored?.state === "needs_review" ? "needs_review" : monitored?.state === "unavailable" ? "unavailable" : s.verificationState;
    const effectiveSubsidy: Subsidy = { ...s, verificationState, fetchedAt: monitored?.fetchedAt ?? s.fetchedAt };
    const hardReasons: string[] = [];
    if (!s.biz.includes(input.bizType)) hardReasons.push("事業者区分が対象外");
    if (!s.size.includes(input.size)) hardReasons.push("現在選択した事業規模が対象外");
    if (!samePref(s, input.pref)) hardReasons.push("所在地が対象地域外");
    if (s.programCategory === "equipment" && !input.equipGroups.some((g) => s.target.includes(g.equip))) hardReasons.push("業務用空調が対象設備に含まれない");
    if (s.id === "hotel_sustainability" && input.building !== "hotel") hardReasons.push("宿泊施設向け制度");
    if (s.id === "kanagawa" && result.co2ReductionTon < 3) hardReasons.push("CO₂削減量3t/年以上の要件を満たさない概算");

    const missing: string[] = [];
    if (s.programCategory === "equipment") {
      missing.push("導入予定機器の型番・対象設備登録");
      missing.push("契約・発注・着工前であること");
      if (!input.employeeCount) missing.push("資本金・従業員数による正式な事業規模");
    } else {
      if (!input.employeeCount) missing.push("従業員数");
      if (!input.employmentInsurance || input.employmentInsurance === "unknown") missing.push("雇用保険の適用状況");
      if (!input.hiringOrTrainingPlan || input.hiringOrTrainingPlan === "unknown") missing.push("採用・研修・雇用管理改善の具体的な計画");
    }
    if (!input.desiredTiming || input.desiredTiming === "undecided") missing.push("希望する契約・発注・導入時期");

    let bucket: ProgramBucket;
    if (hardReasons.length || s.status === "closed" || s.status === "suspended") bucket = "C";
    else if (s.status === "open" && verificationState === "verified" && s.programCategory === "equipment") bucket = "A";
    else bucket = "B";

    const potentialManYen = s.infoOnly ? 0 : Math.min(input.invest * s.rateNum, s.capManYen);
    const reason = bucket === "A"
      ? `${input.pref}・${input.size === "sme" ? "中小企業等" : "選択した事業規模"}・業務用空調更新が、公式確認済みの基本条件と矛盾しないためです。`
      : bucket === "B"
        ? s.programCategory === "equipment"
          ? `${input.pref}・事業規模・空調更新との関連がありますが、${s.status === "upcoming" ? "受付開始前です" : "公式要件と不足情報の追加確認が必要です"}。`
          : "雇用・研修等の取組がある場合に関連する可能性があります。空調設備費の補助額には算入しません。"
        : hardReasons.length ? hardReasons.join("、") : "今回確認した受付回は終了しています。";
    const nextAction = bucket === "A"
      ? `発注前に${missing[0] ?? "公募要領"}を確認し、見積・設備一覧の準備を始める`
      : bucket === "B"
        ? `${missing[0] ?? "最新の公募要領"}を確認する`
        : s.scheduleNote?.includes("次") ? "次回公募の公式発表を待ち、見積・設備一覧を先に準備する" : "今回は計算に含めず、別制度を確認する";

    return { subsidy: effectiveSubsidy, bucket, reason, missing, potentialManYen, outOfPocketManYen: Math.max(0, input.invest - potentialManYen), nextAction, timing: buildTiming(s), monitorNote: monitored?.note };
  }).sort((a, b) => a.bucket.localeCompare(b.bucket) || a.subsidy.name.localeCompare(b.subsidy.name, "ja"));
}

const BUCKETS: { key: ProgramBucket; title: string; note: string; icon: typeof CheckCircle2; tone: string }[] = [
  { key: "A", title: "いま申請可能性がある", note: "公式情報が確認済みで、入力条件に明確な矛盾がない制度", icon: CheckCircle2, tone: "border-ehc-500/45 bg-ehc-500/10 text-ehc-200" },
  { key: "B", title: "条件確認で候補になる", note: "受付予定・要件不足・関連助成金など、追加確認が必要な制度", icon: HelpCircle, tone: "border-amber-500/45 bg-amber-500/10 text-amber-200" },
  { key: "C", title: "今回は対象外・受付終了", note: "対象外の理由または終了した受付回を確認できます", icon: XCircle, tone: "border-white/15 bg-white/[0.03] text-slate-300" },
];

export function ProgramMatchBoard({ input, result, printable = false }: { input: MatchInput; result: MatchResult; printable?: boolean }) {
  const [monitor, setMonitor] = useState<MonitorPayload | null>(null);
  useEffect(() => { let active = true; loadMonitor().then((data) => { if (active) setMonitor(data); }); return () => { active = false; }; }, []);
  const monitorStates = Object.fromEntries((monitor?.sources ?? []).map((s) => [s.id, s]));
  const assessments = assessPrograms(input, result, monitorStates);
  const shell = printable ? "border-slate-200 bg-white text-slate-800" : "border-white/10 bg-night-900 text-slate-200";
  return (
    <section className={`rounded-2xl border p-4 md:p-6 ${shell}`}>
      <div className="flex items-start gap-3 mb-4">
        <CalendarClock className={`w-5 h-5 mt-0.5 ${printable ? "text-ehc-700" : "text-ehc-300"}`} />
        <div><h2 className={`font-bold ${printable ? "text-slate-900" : "text-white"}`}>制度マッチング結果</h2><p className={`text-[11px] mt-1 ${printable ? "text-slate-600" : "text-slate-400"}`}>資格確定や採択見込みではありません。公式情報と不足条件を確認したうえで申請可否を判断します。{monitor ? ` 公式ページ更新確認：${new Date(monitor.checkedAt).toLocaleString("ja-JP")}` : " 公式ページの更新有無を確認中です。"}</p></div>
      </div>
      <div className="space-y-4">
        {BUCKETS.map((group) => {
          const items = assessments.filter((a) => a.bucket === group.key);
          const Icon = group.icon;
          const content = <div className="space-y-3 mt-3">{items.length ? items.map((a) => <ProgramCard key={a.subsidy.id} assessment={a} printable={printable} />) : <p className={`rounded-xl border p-4 text-xs ${printable ? "border-slate-200 text-slate-600" : "border-white/10 text-slate-400"}`}>該当する制度はありません。</p>}</div>;
          if (group.key === "C" && !printable) return <details key={group.key} className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer list-none flex items-center gap-2"><Icon className="w-4 h-4 text-slate-400" /><strong className="text-sm text-slate-200">C｜{group.title}</strong><span className="ml-auto text-[11px] text-slate-500">{items.length}件・開いて確認</span></summary>{content}</details>;
          return <div key={group.key}><div className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 ${printable ? "border-slate-200 bg-slate-50 text-slate-800" : group.tone}`}><Icon className="w-4 h-4 mt-0.5 flex-shrink-0" /><div><h3 className="text-sm font-bold">{group.key}｜{group.title} <span className="font-normal text-[11px]">（{items.length}件）</span></h3><p className="text-[10px] opacity-80 mt-0.5">{group.note}</p></div></div>{content}</div>;
        })}
      </div>
    </section>
  );
}

function ProgramCard({ assessment: a, printable }: { assessment: ProgramAssessment; printable: boolean }) {
  const s = a.subsidy;
  const amount = a.potentialManYen;
  return (
    <article className={`rounded-xl border p-4 text-xs ${printable ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.025]"}`}>
      <div className="flex flex-wrap items-start gap-2"><div className="flex-1 min-w-[220px]"><h4 className={`font-bold text-sm ${printable ? "text-slate-900" : "text-white"}`}>{s.name}</h4><p className={`text-[10px] mt-0.5 ${printable ? "text-slate-500" : "text-slate-500"}`}>{s.org}・{s.programKind === "grant" ? "助成金" : "補助金"}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${s.verificationState === "verified" ? "border-ehc-500/30 text-ehc-600" : "border-amber-500/40 text-amber-600"}`}>{s.verificationState === "verified" ? "公式確認済み" : "公式要件の再確認が必要"}</span></div>
      <dl className="mt-3 grid gap-2 leading-relaxed">
        <div><dt className="font-bold inline">候補理由：</dt><dd className="inline">{a.reason}</dd></div>
        <div><dt className="font-bold inline">期限・間に合う目安：</dt><dd className="inline">{a.timing}</dd></div>
        <div><dt className="font-bold inline">補助率・上限：</dt><dd className="inline">{s.rate}／{s.max}</dd></div>
        <div><dt className="font-bold inline">今回の概算：</dt><dd className="inline">{s.infoOnly ? "設備費の概算には含めません" : `補助額 最大約${amount.toLocaleString("ja-JP")}万円、実質負担 約${a.outOfPocketManYen.toLocaleString("ja-JP")}万円`}</dd></div>
        <div><dt className="font-bold inline">不足情報：</dt><dd className="inline">{a.missing.length ? a.missing.join("／") : "現時点なし（申請時の最終確認は必要）"}</dd></div>
        <div><dt className="font-bold inline">次の一手：</dt><dd className="inline">{a.nextAction}</dd></div>
      </dl>
      <div className={`mt-3 pt-2 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${printable ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-500"}`}><span>公式確認：{checkedLabel(s.officialCheckedAt)}</span><a href={s.sourceUrl || s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline text-cobalt-500">公式情報 <ExternalLink className="w-3 h-3" /></a>{s.verificationState !== "verified" ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle className="w-3 h-3" />未確認情報をA判定・金額反映していません</span> : null}</div>
      {a.monitorNote && s.verificationState !== "verified" ? <p className="mt-2 text-[10px] text-amber-600">更新監視：{a.monitorNote}</p> : null}
    </article>
  );
}
