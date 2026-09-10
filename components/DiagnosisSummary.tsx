"use client";

import { buildDiagnosisDetails } from "@/lib/diagnosis";
import { MatchResult } from "@/lib/match";
import { MatchInput, Subsidy } from "@/lib/types";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import {
  SubsidyState, SUBSIDY_STATE_NOTE, INVEST_UNKNOWN_LABEL, resolveInvestState,
} from "@/lib/roiState";

export function DiagnosisSummary({
  input,
  result,
  appliedSubsidyManYen = 0,
  appliedSubsidy = null,
  /* 2026-09-10 EHC-0031 F03:
     補助額の状態は画面側（ResultView）が決めたものを受け取る。
     ここで金額から作り直すと、同じ案件で画面とPDFが違うことを言い始める。
     未指定時は従来互換（正額なら算定済み扱い）。 */
  subsidyState,
  printable = false,
}: {
  input: MatchInput;
  result: MatchResult;
  appliedSubsidyManYen?: number;
  appliedSubsidy?: Subsidy | null;
  subsidyState?: SubsidyState;
  printable?: boolean;
}) {
  const details = buildDiagnosisDetails(input, result);
  const base = printable ? "border-slate-200 bg-white text-slate-800" : "border-white/10 bg-white/[0.03] text-slate-200";
  const muted = printable ? "text-slate-600" : "text-slate-400";
  const title = printable ? "text-ehc-800" : "text-white";
  const state: SubsidyState = subsidyState ?? (appliedSubsidyManYen > 0 ? "positive" : "unconfirmed");
  /* F01: 設備投資額が未算定（空欄→0）のとき、従来は
     「実質負担概算 0万円」と書いていた。費用不明と0円は違う。 */
  const investState = resolveInvestState(input.invest);
  const investLabel = investState === "known" ? `${input.invest.toLocaleString("ja-JP")}万円` : INVEST_UNKNOWN_LABEL;
  const appliedOutOfPocket = investState === "known" ? Math.max(0, input.invest - appliedSubsidyManYen) : null;

  return (
    <section className={printable ? "mb-5" : "rounded-2xl border border-ehc-500/30 bg-night-900 p-5 md:p-6"}>
      <h2 className={`font-bold flex items-center gap-2 ${printable ? "text-sm border-l-4 border-ehc-600 pl-3 mb-3" : "text-base mb-1"} ${title}`}>
        <ClipboardCheck className="w-4 h-4" />
        診断結果：判断に必要な9項目
      </h2>
      {!printable && (
        <p className="text-xs text-slate-400 mb-4">
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
          )) : <p>入力済みの条件だけで適格性が確定した制度はありません。下記の「確認すれば候補になりうる制度」をご覧ください。</p>}

          {/* 判定不能を「該当なし」に混ぜない。不足情報を出して次の一手にする。 */}
          {details.pending.length > 0 && (
            <div className={`mt-2.5 pt-2.5 border-t ${printable ? "border-slate-200" : "border-white/10"}`}>
              <p className="font-bold mb-1.5">確認すれば候補になりうる制度（{details.pending.length}件）</p>
              {details.pending.map((p) => (
                <div key={p.subsidy.id} className="mb-1.5 last:mb-0">
                  <strong>{p.subsidy.name}</strong>
                  <span className={`ml-1 ${muted}`}>（判定に必要な情報が未取得）</span>
                  <ul className={`list-disc pl-4 mt-0.5 ${muted}`}>
                    {p.missing.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              ))}
              <p className={`mt-1.5 ${muted}`}>
                対象外が確定したという意味ではありません。上記が埋まった時点で改めて判定します。
              </p>
            </div>
          )}
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
              <a href={c.subsidy.url} target="_blank" rel="noreferrer" className="min-h-[44px] inline-flex items-center gap-0.5 text-cobalt-400 underline">
                公式情報 <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          )) : <p>候補制度が確定していません。個別相談で対象地域・規模・設備を再確認します。</p>}
        </Item>

        <Item n="5" label="申請の手間・書類量" base={base} title={title}>
          {details.candidates.length ? details.candidates.map((c) => <p key={c.subsidy.id} className="mb-1.5 last:mb-0"><strong>{c.subsidy.name}：</strong>{c.ease}</p>) : <p>候補制度確定後に、書類量・審査方法・公募時期から目安を判定します。</p>}
          <p className={`mt-1.5 ${muted}`}>必要書類の量と審査方法から見た手間の目安です。採択されやすさ・採択の難易度とは別のものです。</p>
        </Item>

        <Item n="6" label="補助金適用時の実質負担概算" base={base} title={title}>
          {appliedSubsidy ? (
            <p>
              <strong>要件チェック後の選択：</strong>{appliedSubsidy.name}／補助額概算{" "}
              {appliedSubsidyManYen.toLocaleString("ja-JP")}万円／実質負担概算{" "}
              {appliedOutOfPocket === null ? INVEST_UNKNOWN_LABEL : `${appliedOutOfPocket.toLocaleString("ja-JP")}万円`}
            </p>
          ) : (
            <p><strong>現在は補助金未反映：</strong>実質負担概算 {investLabel}</p>
          )}
          {/* 補助額が「未確認」なのか「算定して0円」なのかを、金額欄だけで区別させない（F02） */}
          <p className={`mt-1 ${muted}`}>{SUBSIDY_STATE_NOTE[state]}</p>
          {investState !== "known" && (
            <p className={`mt-1 ${muted}`}>
              設備投資額が{INVEST_UNKNOWN_LABEL}のため、実質負担額・投資回収年数は算定していません。0円という意味ではありません。
            </p>
          )}
          {details.candidates.map((c) => (
            <p key={c.subsidy.id} className={`mt-1 ${muted}`}>
              {c.subsidy.infoOnly ? (
                <>{c.subsidy.name}：情報提供のみの制度のため、補助額・実質負担は算定していません。</>
              ) : (
                <>{c.subsidy.name}の要件を満たす場合：補助額 最大概算 {c.potentialManYen.toLocaleString("ja-JP")}万円（千円未満切捨て）／実質負担 {c.outOfPocketManYen.toLocaleString("ja-JP")}万円</>
              )}
            </p>
          ))}
          {details.pending.length > 0 && (
            <p className={`mt-1 ${muted}`}>
              判定に必要な情報が未取得の制度（{details.pending.length}件）は、金額を「未算定」として集計から外しています。0円という意味ではありません。
            </p>
          )}
          <p className={`mt-1.5 ${muted}`}>対象経費・補助率区分・審査前の概算です。交付額を保証しません。併用可否は各制度の公募要領によるため、複数制度の合算額は出していません。</p>
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
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ehc-600 text-white text-xs flex-shrink-0">{n}</span>
        {label}
      </div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
