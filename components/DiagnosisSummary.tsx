"use client";

import { buildDiagnosisDetails } from "@/lib/diagnosis";
import { MatchResult } from "@/lib/match";
import { MatchInput, Subsidy } from "@/lib/types";
import { ClipboardCheck, ExternalLink } from "lucide-react";

export function DiagnosisSummary({
  input,
  result,
  appliedSubsidyManYen = 0,
  appliedSubsidy = null,
  printable = false,
}: {
  input: MatchInput;
  result: MatchResult;
  appliedSubsidyManYen?: number;
  appliedSubsidy?: Subsidy | null;
  printable?: boolean;
}) {
  const details = buildDiagnosisDetails(input, result);
  const base = printable ? "border-slate-200 bg-white text-slate-800" : "border-white/10 bg-white/[0.03] text-slate-200";
  const muted = printable ? "text-slate-600" : "text-slate-400";
  const title = printable ? "text-ehc-800" : "text-white";
  const appliedOutOfPocket = Math.max(0, input.invest - appliedSubsidyManYen);

  return (
    <section className={printable ? "mb-5" : "rounded-2xl border border-ehc-500/30 bg-night-900 p-5 md:p-6"}>
      <h2 className={`font-bold flex items-center gap-2 ${printable ? "text-sm border-l-4 border-ehc-600 pl-3 mb-3" : "text-base mb-1"} ${title}`}>
        <ClipboardCheck className="w-4 h-4" />
        診断結果：判断に必要な9項目
      </h2>
      {!printable && (
        <p className="text-[11px] text-slate-400 mb-4">
          金額・準備期間・間に合うかは概算です。採択・受給・補助額を保証するものではありません。
        </p>
      )}

      <div className="space-y-3 text-xs">
        <Item n="1" label="課題・推奨対策" base={base} title={title}>
          <ul className="list-disc pl-4 space-y-1">
            {details.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
          <p className="mt-1.5"><strong>推奨：</strong>{details.recommendation}</p>
        </Item>

        <Item n="2" label="補助金・助成金の候補" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => (
            <div key={c.subsidy.id} className="mb-1.5 last:mb-0">
              <strong>{c.subsidy.name}</strong>
              <span className={`ml-1 ${muted}`}>（候補・要件確認前）</span>
            </div>
          )) : <p>現在の入力条件で候補は見つかりませんでした。所在地・企業規模・設備条件を個別確認します。</p>}
        </Item>

        <Item n="3" label="使い道" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => (
            <p key={c.subsidy.id} className="mb-1.5 last:mb-0"><strong>{c.subsidy.name}：</strong>{c.subsidy.useOfFunds || "高効率空調等の導入費。対象経費は公募要領で確認します。"}</p>
          )) : <p>候補制度が確定後、対象となる設備費・工事費を確認します。</p>}
        </Item>

        <Item n="4" label="補助率・上限（公式確認済み範囲）" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => (
            <p key={c.subsidy.id} className="mb-1.5 last:mb-0">
              <strong>{c.subsidy.name}：</strong>{c.subsidy.rate}／上限 {c.subsidy.max}{" "}
              <a href={c.subsidy.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-cobalt-400 underline">
                公式情報 <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          )) : <p>候補制度が確定していません。個別相談で対象地域・規模・設備を再確認します。</p>}
        </Item>

        <Item n="5" label="申請の進めやすさ" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => <p key={c.subsidy.id} className="mb-1.5 last:mb-0"><strong>{c.subsidy.name}：</strong>{c.ease}</p>) : <p>候補制度確定後に、書類量・審査方法・公募時期から目安を判定します。</p>}
          <p className={`mt-1.5 ${muted}`}>準備量・必要書類・公募時期を基にした目安で、採択可否ではありません。</p>
        </Item>

        <Item n="6" label="補助金適用時の実質負担概算" base={base} title={title}>
          {appliedSubsidy ? (
            <p><strong>要件チェック後の選択：</strong>{appliedSubsidy.name}／補助額概算 {appliedSubsidyManYen.toLocaleString("ja-JP")}万円／実質負担概算 {appliedOutOfPocket.toLocaleString("ja-JP")}万円</p>
          ) : (
            <p><strong>現在は補助金未反映：</strong>実質負担概算 {input.invest.toLocaleString("ja-JP")}万円</p>
          )}
          {details.candidates.map((c) => (
            <p key={c.subsidy.id} className={`mt-1 ${muted}`}>
              {c.subsidy.name}の要件を満たす場合：補助額 最大概算 {c.potentialManYen.toLocaleString("ja-JP")}万円／実質負担 {c.outOfPocketManYen.toLocaleString("ja-JP")}万円
            </p>
          ))}
          <p className={`mt-1.5 ${muted}`}>対象経費・補助率区分・審査前の概算です。交付額を保証しません。</p>
        </Item>

        <Item n="7" label="受付期限" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => <p key={c.subsidy.id} className="mb-1.5 last:mb-0"><strong>{c.subsidy.name}：</strong>{c.deadline}</p>) : <p>未定。公式公募情報を個別に確認します。</p>}
        </Item>

        <Item n="8" label="申請準備の目安・今から間に合うか" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => (
            <p key={c.subsidy.id} className="mb-1.5 last:mb-0"><strong>{c.subsidy.name}：</strong>{c.preparation}。{c.inTime}</p>
          )) : <p>制度未確定のため判定できません。一般的には見積・既設機器一覧・電気料金明細の準備から始めます。</p>}
        </Item>

        <Item n="9" label="次に確認すること" base={base} title={title}>
          <ol className="list-decimal pl-4 space-y-1">
            {details.nextChecks.map((next) => <li key={next}>{next}</li>)}
          </ol>
        </Item>
      </div>
    </section>
  );
}

function Item({ n, label, base, title, children }: { n: string; label: string; base: string; title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${base}`}>
      <div className={`font-bold mb-1.5 flex items-center gap-2 ${title}`}>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ehc-600 text-white text-[10px] flex-shrink-0">{n}</span>
        {label}
      </div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
