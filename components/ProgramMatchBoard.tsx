"use client";

import { getSubsidies } from "@/lib/subsidies";
import { MatchInput, Subsidy } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { canShowAmount } from "@/lib/eligibility";
import { subsidyAmountManYen } from "@/lib/pricing";
import { judgePrep, PREP_DISCLAIMER } from "@/lib/prep";
import { AlertCircle, CalendarClock, CheckCircle2, ExternalLink, HelpCircle, WalletCards, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ProgramBucket = "A" | "B" | "C";

export interface ProgramAssessment {
  subsidy: Subsidy;
  bucket: ProgramBucket;
  reason: string;
  missing: string[];
  /* 2026-08-24 監査で追加。
     金額を出してよいかの判定を、金額そのものと分けて持つ。
     以前は potentialManYen だけがあり、適格性が判定できていない制度にも
     「補助額 最大約◯万円」と表示していた。0円と「未算定」も区別できなかった。 */
  amountShown: boolean;
  potentialManYen: number;
  outOfPocketManYen: number;
  nextAction: string;
  timing: string;
  monitorNote?: string;
  /* 2026-08-27 監査で追加。
     coverage_gap は「制度が変わった」ではなく「その制度を監視できていない」状態なので、
     verificationState を降格させない。しかし降格させないと
     『monitorNote && verificationState !== "verified"』という表示条件に引っかかって
     注記そのものが画面から消え、「監視できていない」ことを誰も知らないまま
     公式確認済みバッジだけが残る。これは本監査が潰そうとしている“黙って落ちる”不具合そのもの。
     判定と表示を別のフラグで持ち、注記は必ず出す。 */
  coverageGap: boolean;
}

/* 2026-08-24 監査での修正:
   以前は const REFERENCE_NOW = new Date("2026-08-18T12:00:00+09:00") という固定値で
   「残り約N日」を計算していた。ビルド後に時間が経つほど残日数が実際より多く表示され、
   締切を過ぎた制度でも「今から準備できる可能性があります」と言い続ける状態だった。
   基準時刻は呼び出し時の現在時刻に統一する。 */

/* samePref() はここにあったが、地域要件の判定は lib/eligibility.ts に集約したので削除した。
   同じ判定を2箇所に置くと、片方だけ直したときに画面内で結論が食い違う。 */

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

function buildTiming(s: Subsidy, now: Date) {
  if (s.status === "closed") return `受付終了${s.scheduleNote ? `。${s.scheduleNote}` : ""}`;
  if (s.status === "upcoming") return `受付予定：${dateLabel(s.applyOpen) ?? "公式発表待ち"}〜${dateLabel(s.applyClose) ?? "期限未定"}`;
  if (s.status === "open") {
    if (!s.applyClose) return "受付中（締切は公式要領で確認）";
    /* 2026-09-08 NEOレビュー差し戻しでの修正:
       残日数が最大日数を下回ると一律「早急な個別確認」になっており、
       最小日数すら切っている制度と区別できなかった。判定は lib/prep.ts に一本化。 */
    return `受付中・期限 ${dateLabel(s.applyClose)}。${judgePrep(s, now).text}`;
  }
  return s.scheduleNote || "受付時期は公式確認が必要です";
}

/* 2026-08-27 監査での修正:
     状態は "unchanged" | "needs_review" | "unavailable" の3値しか受け取っていなかった。
     監視側に stale（最終確認から日が経ちすぎ）と coverage_gap（制度ページ単位で監視できていない）を
     足したので、こちらも受け取れるようにする。
     stale は needs_review と同じくA判定から降ろす。
     coverage_gap は制度が変わった証拠ではなく監視体制の欠落なので降格はさせず、注記だけ出す。 */
type MonitorState = "unchanged" | "needs_review" | "stale" | "coverage_gap" | "unavailable";
interface MonitorSourceState { id: string; fetchedAt: string; state: MonitorState; note: string }
interface MonitorPayload { checkedAt: string; sources: MonitorSourceState[] }

function monitorVerification(state: MonitorState | undefined): "needs_review" | "unavailable" | null {
  if (state === "needs_review" || state === "stale") return "needs_review";
  if (state === "unavailable") return "unavailable";
  return null;
}
let monitorPromise: Promise<MonitorPayload | null> | null = null;

function loadMonitor() {
  if (!monitorPromise) monitorPromise = fetch("/api/subsidies/monitor").then((r) => r.ok ? r.json() as Promise<MonitorPayload> : null).catch(() => null);
  return monitorPromise;
}

export function assessPrograms(input: MatchInput, result: MatchResult, monitorStates: Record<string, MonitorSourceState> = {}, now: Date = new Date()): ProgramAssessment[] {
  return getSubsidies(now).map((s) => {
    const monitored = monitorStates[s.id];
    const verificationState = monitorVerification(monitored?.state) ?? s.verificationState;
    const effectiveSubsidy: Subsidy = { ...s, verificationState, fetchedAt: monitored?.fetchedAt ?? s.fetchedAt };

    /* 2026-08-24 監査での修正:
         ここに「事業者区分が対象外」「対象地域外」…という要件判定が、
         lib/match.ts のフィルタとは別に、独立してもう1本書かれていた。
         同じことを2箇所で判定しているので、片方だけ直すと
         同じ画面の「診断結果」と「該当制度」で結論が食い違う。
         判定は lib/eligibility.ts の1本に寄せ、ここはその結果を読むだけにする。 */
    const elig = result.eligibility[s.id];
    const hardReasons: string[] = elig ? [...elig.blockers] : [];

    const missing: string[] = elig ? [...elig.missing, ...elig.confirmations] : [];
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

    /* バケットは lib/eligibility.ts の3値をそのまま写す。
       ただし更新監視（/api/subsidies/monitor）が「公式ページが変わった」と言っている制度は、
       eligibility が verified と判断していてもA判定にしない。
       監視結果はビルド時点の subsidies.ts より新しい情報だからである。 */
    let bucket: ProgramBucket;
    if (hardReasons.length || s.status === "closed" || s.status === "suspended") bucket = "C";
    else if (
      elig?.verdict === "eligible" &&
      verificationState === "verified" &&
      s.programCategory === "equipment"
    ) bucket = "A";
    else bucket = "B";

    /* 金額は「適格と判定できた制度」だけに出す。
       判定に必要な情報が欠けている段階で金額を出すと、根拠のない数字を客に渡すことになる。
       計算式（千円未満切捨て）は lib/pricing.ts に一本化した。 */
    const amountShown = bucket === "A" && !s.infoOnly && (elig ? canShowAmount(elig) : false);
    const potentialManYen = amountShown ? subsidyAmountManYen(input.invest, s.rateNum, s.capManYen) : 0;
    /* 2026-09-10 EHC-0031 P0-D: 所在地は既定値を持たない（未入力を取りうる）。
       未入力のまま `${input.pref}・…` と書くと文が「・中小企業等…」で始まり、
       しかも所在地を判定したかのように読める。未入力なら所在地に触れない。 */
    const prefPhrase = input.pref ? `${input.pref}・` : "";
    const reason = bucket === "A"
      ? `${prefPhrase}${input.size === "sme" ? "中小企業等" : "選択した事業規模"}・業務用空調更新が、公式確認済みの基本条件と矛盾しないためです。`
      : bucket === "B"
        ? s.programCategory === "equipment"
          ? `${prefPhrase}事業規模・空調更新との関連がありますが、${s.status === "upcoming" ? "受付開始前です" : "公式要件と不足情報の追加確認が必要です"}。`
          : "雇用・研修等の取組がある場合に関連する可能性があります。空調設備費の補助額には算入しません。"
        : hardReasons.length ? hardReasons.join("、") : "今回確認した受付回は終了しています。";
    const nextAction = bucket === "A"
      ? `発注前に${missing[0] ?? "公募要領"}を確認し、見積・設備一覧の準備を始める`
      : bucket === "B"
        ? `${missing[0] ?? "最新の公募要領"}を確認する`
        : s.scheduleNote?.includes("次") ? "次回公募の公式発表を待ち、見積・設備一覧を先に準備する" : "今回は計算に含めず、別制度を確認する";

    return { subsidy: effectiveSubsidy, bucket, reason, missing, amountShown, potentialManYen, outOfPocketManYen: Math.max(0, input.invest - potentialManYen), nextAction, timing: buildTiming(s, now), monitorNote: monitored?.note, coverageGap: monitored?.state === "coverage_gap" };
  }).sort((a, b) => a.bucket.localeCompare(b.bucket) || a.subsidy.name.localeCompare(b.subsidy.name, "ja"));
}

const BUCKETS: { key: ProgramBucket; title: string; note: string; icon: typeof CheckCircle2; tone: string }[] = [
  { key: "A", title: "いま申請可能性がある", note: "公式情報が確認済みで、入力条件に明確な矛盾がない制度", icon: CheckCircle2, tone: "border-ehc-500/45 bg-ehc-500/10 text-ehc-200" },
  { key: "B", title: "条件確認で候補になる", note: "受付予定・要件不足・関連助成金など、追加確認が必要な制度", icon: HelpCircle, tone: "border-amber-500/45 bg-amber-500/10 text-amber-200" },
  { key: "C", title: "今回は対象外・受付終了", note: "対象外の理由または終了した受付回を確認できます", icon: XCircle, tone: "border-white/15 bg-white/[0.03] text-slate-300" },
];

/* 2026-09-08 EHC-0028:
   画面の制度マッチングと、印刷専用の診断書（ReportPrintSheet）で
   同じ判定結果を使うためのフック。
   印刷側で assessPrograms を呼び直すと、更新監視の到着タイミング次第で
   画面と紙の A/B/C が食い違う。判定は1回だけ行い、その配列を両方へ配る。
   loadMonitor() はモジュールレベルで Promise を使い回すので、
   複数箇所から呼んでも /api/subsidies/monitor へのfetchは1回で済む。 */
export function useProgramAssessments(input: MatchInput, result: MatchResult) {
  const [monitor, setMonitor] = useState<MonitorPayload | null>(null);
  useEffect(() => { let active = true; loadMonitor().then((data) => { if (active) setMonitor(data); }); return () => { active = false; }; }, []);
  const assessments = useMemo(() => {
    const monitorStates = Object.fromEntries((monitor?.sources ?? []).map((s) => [s.id, s]));
    return assessPrograms(input, result, monitorStates);
  }, [input, result, monitor]);
  return { assessments, monitorCheckedAt: monitor?.checkedAt ?? null };
}

export function ProgramMatchBoard({ input, result, printable = false, onSimulationProgramsChange }: { input: MatchInput; result: MatchResult; printable?: boolean; onSimulationProgramsChange?: (programs: Subsidy[]) => void }) {
  const { assessments, monitorCheckedAt } = useProgramAssessments(input, result);
  const active = assessments.filter((a) => a.bucket === "A");
  const conditional = assessments.filter((a) => a.bucket === "B");
  /* 2026-08-27 監査で追加。
     監視できていない制度が何件あるかを、制度カードを開かなくても分かる位置に出す。
     「公式ページ更新確認：◯月◯日」とだけ書いて、実は一部の制度を見ていない、という状態にしない。 */
  const coverageGapItems = assessments.filter((a) => a.coverageGap);
  const simulationPrograms = useMemo(() => assessments
    .filter((a) =>
      (a.bucket === "A" || a.bucket === "B") &&
      !a.subsidy.infoOnly &&
      a.subsidy.programCategory === "equipment" &&
      a.subsidy.status !== "closed" &&
      a.subsidy.status !== "suspended" &&
      a.amountShown
    )
    .map((a) => a.subsidy), [assessments]);
  useEffect(() => {
    onSimulationProgramsChange?.(simulationPrograms);
  }, [onSimulationProgramsChange, simulationPrograms]);
  const conclusion = active.length
    ? { label: "候補制度あり（条件診断へ）", reason: "所在地・事業規模・設備種別の基本条件とは矛盾しません。発注状況・指定機器・必要書類を確認すると該当見込みを絞れます。", tone: "border-ehc-500/50 bg-ehc-500/10 text-ehc-200" }
    : conditional.length
      ? { label: "条件確認が必要", reason: conditional[0].reason, tone: "border-amber-500/50 bg-amber-500/10 text-amber-200" }
      : { label: "今回は対象外", reason: assessments[0]?.reason ?? "現在の入力条件で候補を確認できませんでした。", tone: "border-white/15 bg-white/[0.03] text-slate-300" };
  /* 2026-08-24 監査での修正:
       以前は bucket B（条件確認が必要）の制度も金額比較の根拠に採用していた。
       B は「適格かどうかまだ判定できていない」制度なので、
       その補助率で「採択された場合の概算」を出すのは根拠が無い。A判定のみを採る。 */
  const simulationCandidate = active
    .filter((a) => a.amountShown)
    .sort((a, b) => b.potentialManYen - a.potentialManYen)[0];
  const potential = simulationCandidate?.potentialManYen ?? 0;
  const potentialUnavailable = !simulationCandidate;
  /* 2026-09-10 EHC-0031 UI-03:
     金額が出せないとき、その原因が「あと少し情報が足りない」のか
     「そもそも候補が無い」のかで、客がとるべき行動は正反対になる。
     前者は不足情報を埋めれば金額が出るので、何を答えればよいかを名指しで出す。 */
  const missingForAmount = useMemo(() => {
    const seen = new Set<string>();
    conditional.forEach((a) => a.missing.forEach((m) => seen.add(m)));
    return [...seen].slice(0, 4);
  }, [conditional]);
  const annualManYen = result.saveYenPerYear / 10000;
  const recoveryWithout = annualManYen > 0 ? input.invest / annualManYen : null;
  const recoveryWith = annualManYen > 0 ? Math.max(0, input.invest - potential) / annualManYen : null;
  const deadlineItems = [...active, ...conditional].slice(0, 3);
  const shell = printable ? "border-slate-200 bg-white text-slate-800" : "border-white/10 bg-night-900 text-slate-200";
  return (
    <section className={`rounded-2xl border p-4 md:p-6 ${shell}`}>
      <div className="flex items-start gap-3 mb-4">
        <CalendarClock className={`w-5 h-5 mt-0.5 ${printable ? "text-ehc-700" : "text-ehc-300"}`} />
        <div><h2 className={`font-bold ${printable ? "text-slate-900" : "text-white"}`}>制度マッチング結果</h2><p className={`text-xs mt-1 ${printable ? "text-slate-600" : "text-slate-400"}`}>資格確定や採択見込みではありません。公式情報と不足条件を確認したうえで申請可否を判断します。{monitorCheckedAt ? ` 公式ページ更新確認：${new Date(monitorCheckedAt).toLocaleString("ja-JP")}` : " 公式ページの更新有無を確認中です。"}</p></div>
      </div>
      {coverageGapItems.length ? (
        <div className={`mb-4 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${printable ? "border-slate-200 bg-slate-50 text-slate-600" : "border-white/10 bg-white/[0.03] text-slate-400"}`}>
          <strong className={printable ? "text-slate-800" : "text-slate-200"}>更新監視の範囲について：</strong>
          {coverageGapItems.length}件（{coverageGapItems.map((a) => a.subsidy.name).join("、")}）は、公式ポータルのトップページしか監視できていません。
          制度ページ単位のURLを登録するまで、これらの制度の改定は自動検知されません。申請前に公募要領を直接ご確認ください。
        </div>
      ) : null}
      <div className="space-y-4">
        <div className={`rounded-2xl border p-4 ${printable ? "border-slate-200 bg-slate-50 text-slate-900" : conclusion.tone}`}>
          <p className="text-xs opacity-80">1｜結論</p>
          <h3 className="mt-1 text-lg md:text-xl font-black">補助金を使える可能性：{conclusion.label}</h3>
          <p className="mt-2 text-xs leading-relaxed">{conclusion.reason}</p>
        </div>

        <div className={`rounded-2xl border p-4 ${printable ? "border-slate-200" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-3"><WalletCards className="w-4 h-4 text-cobalt-400" /><h3 className={`text-sm font-bold ${printable ? "text-slate-900" : "text-white"}`}>2｜金額比較</h3></div>
          {/* 2026-09-10 EHC-0031 UI-03
              SHINICHIさん指摘:「補助金が入らないと話にならなくない？
              該当する補助金がないならないで出さないと」

              従来は A判定が無いときも「採択された場合の概算」の枠を残し、
              中身を全て「未算定／算定不可」で埋めていた。
              空の枠は何も伝えないうえに、「本来は金額が出るはずなのに出せて
              いない」という印象だけを残す。読んだ人が次に何をすればよいかも
              分からない。

              A判定が無いときは枠自体を出さず、次のどちらであるかを言い切る。
                ・条件確認が残っている（B判定あり）→ 何を答えれば金額が出るか
                ・そもそも候補が無い（B判定も無い）→「該当する補助金はありません」
              金額を出す条件（A判定のみ・lib/eligibility.ts canShowAmount）は
              変えていない。変えたのは、出せないときの伝え方だけである。 */}
          {potentialUnavailable ? (
            <>
              <MoneyPanel title="補助金なし（今回の前提）" invest={input.invest} subsidy={0} annualYen={result.saveYenPerYear} recovery={recoveryWithout} printable={printable} />
              <div className={`mt-3 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${
                printable
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : conditional.length
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                    : "border-white/15 bg-white/[0.03] text-slate-300"
              }`}>
                {conditional.length ? (
                  <>
                    <strong className={printable ? "text-slate-900" : "text-amber-200"}>
                      補助金ありの金額は、まだ出せません（該当なしとは限りません）。
                    </strong>
                    <p className="mt-1.5">
                      候補になり得る制度が{conditional.length}件ありますが、適格かどうかの判定に必要な情報が揃っていません。
                      揃っていない状態で補助率を当てはめると、根拠のない金額を出すことになるため算定していません。
                    </p>
                    {missingForAmount.length ? (
                      <p className="mt-1.5">
                        次を確認できると金額を出せます：
                        <strong className={printable ? "text-slate-900" : "text-white"}>{missingForAmount.join("／")}</strong>
                      </p>
                    ) : null}
                    <p className="mt-1.5 opacity-80">制度ごとの不足情報は「4｜制度の詳細」に記載しています。</p>
                  </>
                ) : (
                  <>
                    <strong className={printable ? "text-slate-900" : "text-white"}>
                      現在の入力条件に該当する補助金はありません。
                    </strong>
                    <p className="mt-1.5">
                      確認した制度はいずれも対象外または受付終了で、比較できる「補助金あり」の案がありません。
                      上の金額が、今回そのまま判断材料になります。
                    </p>
                    <p className="mt-1.5 opacity-80">
                      所在地・事業規模・設備種別・導入時期のいずれかが変わると結果が変わることがあります。
                      次回公募の公式発表後にあらためて診断してください。
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MoneyPanel title="補助金なし" invest={input.invest} subsidy={0} annualYen={result.saveYenPerYear} recovery={recoveryWithout} printable={printable} />
                <MoneyPanel title="採択された場合の概算" invest={input.invest} subsidy={potential} annualYen={result.saveYenPerYear} recovery={recoveryWith} printable={printable} accent candidateName={simulationCandidate?.subsidy.name} />
              </div>
              <p className={`mt-3 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-slate-500"}`}>
                {`※右側は「${simulationCandidate?.subsidy.name}」の補助率・上限を仮置きした比較です（補助額は千円未満切捨て）。対象経費、申請区分、審査結果により補助額は変わり、採択・受給を保証しません。併用可否は各制度の公募要領によるため、複数制度の合算額は出していません。`}
              </p>
            </>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${printable ? "border-slate-200" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-amber-400" /><h3 className={`text-sm font-bold ${printable ? "text-slate-900" : "text-white"}`}>3｜期限</h3></div>
          <div className="space-y-2">{deadlineItems.length ? deadlineItems.map((a) => <div key={a.subsidy.id} className={`rounded-xl border p-3 text-xs ${printable ? "border-slate-200" : "border-white/10"}`}><div className="flex flex-wrap items-center gap-2"><strong>{a.subsidy.name}</strong><span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-xs text-amber-500">{statusLabel(a.subsidy)}</span></div><p className="mt-1.5 leading-relaxed">{a.timing}</p></div>) : <p className="text-xs text-slate-500">受付中の候補はありません。次回公募の公式発表待ちです。</p>}</div>
          <p className={`mt-2 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-slate-500"}`}>{PREP_DISCLAIMER}</p>
        </div>

        <details open={printable} className={`rounded-2xl border p-4 ${printable ? "border-slate-200" : "border-white/10 bg-white/[0.02]"}`}>
          <summary className="cursor-pointer list-none flex items-center gap-2"><HelpCircle className="w-4 h-4 text-cobalt-400" /><strong className={`text-sm ${printable ? "text-slate-900" : "text-white"}`}>4｜制度の詳細・不足情報</strong><span className="ml-auto text-xs text-slate-500">開いて確認</span></summary>
          <div className="space-y-4 mt-4">{BUCKETS.map((group) => { const items = assessments.filter((a) => a.bucket === group.key); const Icon = group.icon; return <div key={group.key}><div className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 ${printable ? "border-slate-200 bg-slate-50 text-slate-800" : group.tone}`}><Icon className="w-4 h-4 mt-0.5" /><div><h3 className="text-sm font-bold">{group.key}｜{group.title}（{items.length}件）</h3><p className="text-xs opacity-80">{group.note}</p></div></div><div className="space-y-3 mt-3">{items.length ? items.map((a) => <ProgramCard key={a.subsidy.id} assessment={a} printable={printable} />) : <p className="text-xs text-slate-500">該当なし</p>}</div></div>; })}</div>
        </details>
      </div>
    </section>
  );
}

function statusLabel(s: Subsidy) {
  if (s.status === "open") return "受付中";
  if (s.status === "upcoming") return "受付予定";
  if (s.status === "closed") return "受付終了";
  return "次回公募・受付時期を確認";
}

/* unavailable=true は「補助額を算定していない」状態。0万円と区別して表示する。
   0万円は「計算した結果ゼロ」、未算定は「計算する根拠がまだ無い」で意味が全く違う。 */
function MoneyPanel({ title, invest, subsidy, annualYen, recovery, printable, accent = false, unavailable = false, candidateName }: { title: string; invest: number; subsidy: number; annualYen: number; recovery: number | null; printable: boolean; accent?: boolean; unavailable?: boolean; candidateName?: string }) {
  const amountLabel = unavailable ? "未算定" : `${subsidy.toLocaleString("ja-JP")}万円`;
  const outOfPocketLabel = unavailable ? "未算定" : `${Math.max(0, invest - subsidy).toLocaleString("ja-JP")}万円`;
  return <div className={`rounded-xl border p-4 ${printable ? "border-slate-200 bg-white" : accent ? "border-ehc-500/40 bg-ehc-500/10" : "border-white/10 bg-white/[0.025]"}`}><h4 className={`font-bold ${printable ? "text-slate-900" : "text-white"}`}>{title}</h4>{candidateName ? <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{candidateName}</p> : null}<dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><dt className="text-slate-500">総費用</dt><dd className="text-right font-bold">{invest.toLocaleString("ja-JP")}万円</dd><dt className="text-slate-500">想定補助額</dt><dd className="text-right font-bold">{amountLabel}</dd><dt className="text-slate-500">実質負担</dt><dd className={`text-right font-black ${accent ? "text-ehc-400" : ""}`}>{outOfPocketLabel}</dd><dt className="text-slate-500">年間削減見込み</dt><dd className="text-right font-bold">{Math.round(annualYen / 10000).toLocaleString("ja-JP")}万円/年</dd><dt className="text-slate-500">回収目安</dt><dd className="text-right font-bold">{unavailable || recovery == null ? "算定不可" : `約${recovery.toFixed(1)}年`}</dd></dl></div>;
}

function ProgramCard({ assessment: a, printable }: { assessment: ProgramAssessment; printable: boolean }) {
  const s = a.subsidy;
  const amount = a.potentialManYen;
  return (
    <article className={`rounded-xl border p-4 text-xs ${printable ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.025]"}`}>
      <div className="flex flex-wrap items-start gap-2"><div className="flex-1 min-w-[220px]"><h4 className={`font-bold text-sm ${printable ? "text-slate-900" : "text-white"}`}>{s.name}</h4><p className={`text-xs mt-0.5 ${printable ? "text-slate-500" : "text-slate-500"}`}>{s.org}・{s.programKind === "grant" ? "助成金" : "補助金"}</p></div><span className={`rounded-full border px-2 py-1 text-xs ${s.verificationState === "verified" ? "border-ehc-500/30 text-ehc-600" : "border-amber-500/40 text-amber-600"}`}>{s.verificationState === "verified" ? "公式確認済み" : "公式要件の再確認が必要"}</span></div>
      <dl className="mt-3 grid gap-2 leading-relaxed">
        <div><dt className="font-bold inline">候補理由：</dt><dd className="inline">{a.reason}</dd></div>
        <div><dt className="font-bold inline">期限・間に合う目安：</dt><dd className="inline">{a.timing}</dd></div>
        <div><dt className="font-bold inline">補助率・上限：</dt><dd className="inline">{s.rate}／{s.max}</dd></div>
        <div><dt className="font-bold inline">対象条件：</dt><dd className="inline">{s.requirement}</dd></div>
        <div><dt className="font-bold inline">今回の概算：</dt><dd className="inline">{s.infoOnly
          ? "設備費の概算には含めません"
          : a.amountShown
            ? `補助額 最大約${amount.toLocaleString("ja-JP")}万円、実質負担 約${a.outOfPocketManYen.toLocaleString("ja-JP")}万円（千円未満切捨て）`
            : "未算定。適格性の判定に必要な情報が揃っていないため、金額は出していません。"}</dd></div>
        <div><dt className="font-bold inline">不足情報：</dt><dd className="inline">{a.missing.length ? a.missing.join("／") : "現時点なし（申請時の最終確認は必要）"}</dd></div>
        <div><dt className="font-bold inline">次の一手：</dt><dd className="inline">{a.nextAction}</dd></div>
      </dl>
      <div className={`mt-3 pt-2 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${printable ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-500"}`}><span>公式確認：{checkedLabel(s.officialCheckedAt)}</span><a href={s.sourceUrl || s.url} target="_blank" rel="noreferrer" className="min-h-[44px] inline-flex items-center gap-1 underline text-cobalt-500">公式情報 <ExternalLink className="w-3 h-3" /></a>{s.verificationState !== "verified" ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle className="w-3 h-3" />未確認情報をA判定・金額反映していません</span> : null}</div>
      {a.monitorNote && (s.verificationState !== "verified" || a.coverageGap) ? <p className={`mt-2 text-xs ${a.coverageGap ? "text-slate-500" : "text-amber-600"}`}>更新監視：{a.monitorNote}</p> : null}
    </article>
  );
}
