"use client";

import { CheckCircle2, HelpCircle, XCircle, AlertCircle, Clock, ExternalLink, CalendarClock, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchInput, Subsidy } from "@/lib/types";
import { co2TonLabel, type MatchResult } from "@/lib/match";
import type { FitLevel5 } from "@/lib/eligibility";
import { judgePrep, type PrepJudgement } from "@/lib/prep";
import { buildRoiSnapshot } from "@/lib/roiState";
import { ELECTRIC_PRICE_YEN_PER_KWH } from "@/lib/pricing";
import { INVEST_SOURCE_LABEL, type InvestChoice, type InvestSource } from "@/lib/amountBasis";
import { ENERGY_SOURCE_NOTE, type EnergyBasis, type EnergyBill } from "@/lib/diagnosisEnergy";
import { EnergyBillInput } from "./EnergyBillInput";
import { InvestBasisChooser } from "./InvestBasisChooser";
import { GlossaryDetails } from "./Glossary";
import type { ProgramAssessment } from "./ProgramMatchBoard";
import { ProgramSelfCheck } from "./ProgramSelfCheck";
import { FIT_LABEL } from "@/lib/fitLabels";
import type { SelfCheckAnswers, SelfCheckKey } from "@/lib/selfCheck";
import {
  UNRESOLVED_REASON_LABEL,
  UNRESOLVED_REASON_NOTE,
  type EquipProjection,
} from "@/lib/diagnosisProjection";
import { ReductionBasisPanel } from "./ReductionBasisPanel";
import type {
  PlannedUnitStatus,
  TargetProductApiResponse,
  TargetProductDetail,
  TargetProductStatus,
} from "@/lib/targetProduct";

/* ───────────────────────────────────────────────────────────
   結果を確認する段（EHC-0039 第6片 / 2026-09-14 v1）
   段ナビでいう 3 / 4。

   ■ この画面がやること
   　　(1) 入力が足りていて計算したのか、足りなくて計算していないのかを先に言う
   　　(2) 計算したなら、制度ごとに「いま申請できる見込みか」を1語で出す
   　　(3) その1語の根拠を、押せば全部読める形で必ず添える

   ■ この画面が持たないもの
   　　適合の判定も、補助額の計算も、締切の計算も、ここには書かない。
   　　すべて components/ProgramMatchBoard.tsx の assessPrograms()
   　　（中身は lib/eligibility.ts / lib/pricing.ts / lib/prep.ts）が出した
   　　結果を読むだけにする。
   　　ProgramMatchBoard.tsx の冒頭に書かれているとおり、
   　　ここで判定をもう1本書くと、同じ画面の中で
   　　「診断結果」と「該当制度」の結論が食い違う事故が実際に起きた。

   ■ 適合度（FitLevel5）とは何か（ここで作る判定ではない）
   　　2026-09-14 EHC-0039 v3指示 §C段 で、適合度は
   　　　不可 ／ 低い ／ 余地あり ／ 高い ／ 判定保留
   　　の5段階と決まった。判定そのものは lib/eligibility.ts の assessFit() が行い、
   　　assessPrograms() が ProgramAssessment.fit に載せて渡してくる。
   　　このファイルが持っているのは、その5値に対応する
   　　「日本語の見出し」「アイコン」「配色」だけである。

   　　v1 まではここに ProgramBucket(A/B/C) → 3値 の変換表を置いていたが、
   　　バケットAは「入力した設備が全群この制度の対象か」を見ていないので、
   　　3群入れて1群しか対象でない制度もAとして「申請できる見込み」に並んでいた。
   　　客はそれを「全設備が対象」と読む。だから5段階へ移し、
   　　変換表そのものを削除した。ここで level を作り直さないこと。

   　　語を必ず添える理由は変わらない。"A" "B" "C" も色も、
   　　　・読み上げると意味を持たない
   　　　・白黒印刷でも色覚型でも差が残らない
   　　ので、アイコン＋日本語の語を常に対にして出す。
   ─────────────────────────────────────────────────────────── */

const FIT_VIEW: Record<
  FitLevel5,
  { label: string; note: string; icon: typeof CheckCircle2; tone: string }
> = {
  /* 2026-09-25 UXレビュー No.7: 呼び名を短く、意味が伝わる語にする。
     判定そのもの（lib/eligibility.ts の assessFit）は変えていない。語だけを替えた。
       適合は高い → 使える見込みが高い
       確認すれば候補（余地あり） → 条件次第
       判定保留 → 制度の発表待ち（お客様側で埋められる項目ではないことが伝わる語）
       適合は低い → 一部の設備だけ対象（実際の意味そのもの）
       今回は対象外（不可） → 今回は対象外 */
  high: {
    label: FIT_LABEL.high,
    /* 「入力した設備」と書かない。この見出しが指しているのは
       試算に含めた群（input.equipGroups）だけで、お客様が入力した全群ではない。
       ルームエアコンなど計算に回せなかった群は、この判定に入っていない。
       群ごとの内訳は各制度カードの「この判定の根拠」（assessFit の why）に出る。 */
    /* 2026-09-16 EHC-0039 修正2:
       必須要件（対象製品リストへの登録・交付決定前の着手・企業規模の裏付け）を
       確認できていない案件は、assessFit が high に進めなくなった。
       ここに到達している＝それらも確認済み、という意味になるので、文にも書く。 */
    note: "ご入力の設備がすべてこの制度の対象種別で、事業者区分・規模・地域・期間のいずれとも矛盾がなく、必須要件の確認も済んでいます。採択を保証するものではありません。",
    icon: CheckCircle2,
    tone: "border-brand/35 bg-[#edf6e8] text-brand-deep",
  },
  possible: {
    label: FIT_LABEL.possible,
    note: "対象外と決まったわけではありません。確認できれば候補になります。何が分かれば判定できるかを各制度に並べています。",
    icon: HelpCircle,
    tone: "border-amber-500/45 bg-amber-50 text-amber-800",
  },
  on_hold: {
    label: FIT_LABEL.on_hold,
    note: "制度側の情報（公募要領など）がまだ公表されていないため、判定できません。お客様側で埋められる項目ではありません。",
    icon: Clock,
    tone: "border-ink-line bg-paper-tint text-ink",
  },
  low: {
    label: FIT_LABEL.low,
    /* 2026-09-16 EHC-0039 修正2:
       旧文は「…または、この制度から補助額を算定できません」と書いていた。
       本アプリが金額を出せないことと、制度への適合が低いことは別である。
       情報提供のみの制度（持続化補助金など）は、適合が低いのではなく
       こちらが算定していないだけで、そう書けば営業は候補から落としてしまう。
       算定可否は各カードの「補助額の算定」行（fit.amount）へ移した。
       ここに残るのは対象種別の話だけ。 */
    note: "要件と矛盾はありませんが、ご入力の設備のうち一部しかこの制度の対象種別ではありません。内訳を下に出しています。",
    icon: AlertCircle,
    tone: "border-ink-line bg-paper-sub text-ink",
  },
  not_possible: {
    label: FIT_LABEL.not_possible,
    note: "受付が終了しているか、要件と明確に矛盾する点があります。理由を下に出しています。",
    icon: XCircle,
    tone: "border-ink-line bg-paper-sub text-ink-soft",
  },
};

/* 2026-09-25: 並び順は ComputedResult の中で段ごとに決める（今回の公募 → 次回の公募 → 発表待ち → 一部のみ → 対象外）。 */

export interface ResultStageProps {
  /** projection.canCompute が false のときは null。null なら計算していない */
  input: MatchInput | null;
  /** 同上。null を「結果が0件」と読まないこと */
  result: MatchResult | null;
  projection: EquipProjection;
  /** 「設備を入力」へ戻す。未入力を埋めに行く唯一の導線 */
  onBack?: () => void;
  /* ───────── 対象製品の照合結果（EHC-0039 v2 §2 / 2026-09-16） ─────────
     サーバ（app/api/target-product）が返した結果をそのまま受け取る。
     この画面で照合しない・true を作らない。
     undefined は「まだ導入予定機器を伺っていない」で、
     「照合した結果どれも未確認」とは別の状態である。 */
  targetProduct?: TargetProductApiResponse;
  /** 照合結果を取れなかった理由。取れなかったことを黙って未確認にしない */
  targetProductError?: string | null;
  /* ───────── 2026-09-25 UXレビュー ─────────
     investChoice … 補助額の計算に使っている金額の出どころ（No.2。lib/amountBasis.ts）
     energy       … 年間kWh の出どころ（追加所見。lib/diagnosisEnergy.ts）
     stage1Matched … 第1段階（7問の直後）で候補に挙がっていた制度。件数の変化を説明するため（No.6） */
  investChoice?: InvestChoice;
  onInvestSourceChange?: (source: InvestSource) => void;
  energy?: EnergyBasis | null;
  stage1Matched?: Subsidy[];
  /* 2026-09-25: 制度ごとの判定結果は DiagnosisFlow が1回だけ作って渡す
     （E段の問い合わせにも同じ結果を載せるため。ここで作り直すと出どころが2つになる）。 */
  assessments: ProgramAssessment[];
  monitorCheckedAt: string | null;
  /* 2026-09-25 適合チェックの回答と、答えたときの受け口 */
  selfCheckAnswers: SelfCheckAnswers;
  onSelfCheckAnswer: (key: SelfCheckKey, value: string) => void;
  /* 2026-09-25 電気料金の明細（任意）。渡されたときだけ入力欄を出す */
  energyBill?: EnergyBill;
  onEnergyBillChange?: (bill: EnergyBill) => void;
}

export function ResultStage({
  input,
  result,
  projection,
  onBack,
  targetProduct,
  targetProductError,
  investChoice,
  onInvestSourceChange,
  energy,
  stage1Matched,
  assessments,
  monitorCheckedAt,
  selfCheckAnswers,
  onSelfCheckAnswer,
  energyBill,
  onEnergyBillChange,
}: ResultStageProps) {
  /* 計算していないときは、数字の器そのものを出さない。
     「—」や「0万円」を並べた枠を見せると、枠があること自体が
     「算定は済んでいて中身が0だった」という読み方を招く。 */
  if (!projection.canCompute || !input || !result) {
    return <NotComputed projection={projection} onBack={onBack} />;
  }
  /* useProgramAssessments はフックなので、input/result が揃った場合だけ
     描画される子側で呼ぶ。ここで呼ぶと上の早期 return と条件付き呼び出しになる。 */
  return (
    <ComputedResult
      input={input}
      result={result}
      projection={projection}
      onBack={onBack}
      targetProduct={targetProduct}
      targetProductError={targetProductError}
      investChoice={investChoice}
      onInvestSourceChange={onInvestSourceChange}
      energy={energy ?? null}
      stage1Matched={stage1Matched ?? []}
      assessments={assessments}
      monitorCheckedAt={monitorCheckedAt}
      selfCheckAnswers={selfCheckAnswers}
      onSelfCheckAnswer={onSelfCheckAnswer}
      energyBill={energyBill}
      onEnergyBillChange={onEnergyBillChange}
    />
  );
}

/* ───────── 計算していないとき ───────── */

function NotComputed({
  projection,
  onBack,
}: {
  projection: EquipProjection;
  onBack?: () => void;
}) {
  /* 理由は群ごとに重複するので、文言は1回ずつにまとめる。
     同じ「台数が未入力です」を群の数だけ並べても、直す場所は増えない。 */
  const reasons = Array.from(
    new Set(projection.unresolvedGroups.flatMap((u) => u.reasons))
  );

  return (
    <section aria-labelledby="result-not-computed" className="space-y-4">
      <div className="rounded-2xl border border-amber-500/45 bg-amber-50 p-4">
        <h2
          id="result-not-computed"
          className="flex items-center gap-2 text-base/[1.7] font-bold text-amber-800"
        >
          <AlertCircle aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
          まだ金額を出していません
        </h2>
        {/* 2026-09-14 EHC-0039: この段の主文なので §7「本文16pxを基本」に従って16px。
            14pxは根拠・不足理由・補足のための下限であって、本文の既定ではない。 */}
        <p className="mt-2 text-base/[1.7] text-ink">
          金額・削減量は未算定です。下の項目をご確認ください。
        </p>
      </div>

      <div className="rounded-2xl border border-ink-line bg-paper-card p-4">
        <h3 className="text-base/[1.7] font-bold text-ink">足りていないのは次の点です</h3>
        <ul className="mt-2 space-y-2.5">
          {reasons.map((r) => (
            <li key={r} className="text-sm/[1.7]">
              <span className="font-bold text-ink">{UNRESOLVED_REASON_LABEL[r]}</span>
            </li>
          ))}
        </ul>
        <details className="mt-3 border-t border-ink-line">
          <summary className="min-h-[48px] cursor-pointer py-3 text-sm/[1.7] font-bold text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
            未算定の理由と、確認方法を見る
          </summary>
          <p className="mt-2 text-base/[1.7] text-ink">
            入力いただいた設備のうち、計算に回せる群がありませんでした。
            足りない項目を推測で埋めて数字を出すことはしないので、この段では金額も削減量も表示しません。
          </p>
          <ul className="mt-3 space-y-3">
            {reasons.map((r) => (
              <li key={r} className="text-sm/[1.7]">
                <span className="font-bold text-ink">{UNRESOLVED_REASON_LABEL[r]}</span>
                <span className="mt-0.5 block leading-[1.7] text-ink-soft">
                  {UNRESOLVED_REASON_NOTE[r]}
                </span>
              </li>
            ))}
          </ul>
        </details>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-4 min-h-[48px] w-full rounded-2xl border border-brand bg-paper-tint px-4 text-sm/[1.7] font-bold text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            設備の入力に戻る
          </button>
        )}
      </div>
    </section>
  );
}

/* ───────── 計算したとき ───────── */

/* 2026-09-25 UXレビュー No.1: 締切に間に合うかで段を分ける。
   適合度（assessFit）は「条件が合うか」だけを見ていて、締切までの日数は見ていない。
   そのため、締切まで約4日・準備の目安35〜56日の制度が、最上位に金額つきで並んでいた。
   ここでは判定を作らない。lib/prep.ts の judgePrep()（受付中の制度の残日数と準備日数の比較）
   が「日程が厳しい（short）」と出した制度を、「次回の公募に備える制度」へ分けて表示するだけ。 */
function prepOf(s: Subsidy, now: Date): PrepJudgement | null {
  return s.status === "open" ? judgePrep(s, now) : null;
}

/* 万円の表示。カードとまとめで同じ関数を使い、同じ数字が違う桁で出ないようにする。 */
function manYenText(v: number): string {
  return v.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

function ComputedResult({
  input,
  result,
  projection,
  onBack,
  targetProduct,
  targetProductError,
  investChoice,
  onInvestSourceChange,
  energy,
  stage1Matched,
  assessments,
  monitorCheckedAt,
  selfCheckAnswers,
  onSelfCheckAnswer,
  energyBill,
  onEnergyBillChange,
}: {
  input: MatchInput;
  result: MatchResult;
  projection: EquipProjection;
  onBack?: () => void;
  targetProduct?: TargetProductApiResponse;
  targetProductError?: string | null;
  investChoice?: InvestChoice;
  onInvestSourceChange?: (source: InvestSource) => void;
  energy: EnergyBasis | null;
  stage1Matched: Subsidy[];
  assessments: ProgramAssessment[];
  monitorCheckedAt: string | null;
  selfCheckAnswers: SelfCheckAnswers;
  onSelfCheckAnswer: (key: SelfCheckKey, value: string) => void;
  energyBill?: EnergyBill;
  onEnergyBillChange?: (bill: EnergyBill) => void;
}) {
  /* 判定結果（assessments）は DiagnosisFlow が useProgramAssessmentsOrEmpty で作って渡す。
     第3引数（試算に含めなかった群の種類）の扱いは従来どおり（あちらで projection.excludedKinds を渡している）。 */

  const now = new Date();
  /* 判定は assessFit() が済ませてある。ここは仕分けるだけ。 */
  const byFit = (level: FitLevel5) =>
    assessments.filter((a) => a.fit.level === level);
  const promising = assessments.filter((a) => a.fit.level === "high" || a.fit.level === "possible");
  const isNextRound = (a: ProgramAssessment) => prepOf(a.subsidy, now)?.verdict === "short";
  /* 並びは 高い → 条件次第。同じ段の中は制度データの並び（assessPrograms の順）を保つ。 */
  const levelRank = (a: ProgramAssessment) => (a.fit.level === "high" ? 0 : 1);
  const current = promising.filter((a) => !isNextRound(a)).sort((x, y) => levelRank(x) - levelRank(y));
  const nextRound = promising.filter(isNextRound).sort((x, y) => levelRank(x) - levelRank(y));

  /* 計算に回せなかった群が「1つも無い」のか「一部あった」のかを区別する。
     一部だけ計算した結果を、全設備の結果として読ませない。 */
  const partial = projection.unresolvedGroups.length > 0;

  /* No.6: 第1段階（7問の直後）で候補だった制度が、設備を入れたあと候補から外れたときは理由を1行で言う。 */
  const changed = stage1Matched
    .map((s) => ({ s, a: assessments.find((x) => x.subsidy.id === s.id) }))
    .filter((x): x is { s: Subsidy; a: ProgramAssessment } => !!x.a && x.a.fit.level !== "high" && x.a.fit.level !== "possible");

  const secondaryLevels: FitLevel5[] = ["on_hold", "low", "not_possible"];

  return (
    <section aria-labelledby="result-heading" className="ehc-result-stage space-y-6">
      <header className="ehc-result-header">
        <p className="mb-2 text-[14px] font-semibold text-brand-deep">{assessments.length}制度を判定しました</p>
        <h2 id="result-heading" className="text-2xl font-bold leading-relaxed tracking-tight text-ink">
          使える制度と、申請の時期
        </h2>
        <p className="mt-3 text-[16px] leading-[1.8] text-ink-soft">
          入力いただいた設備で、制度ごとの条件と締切を確認しました。採択や補助額を保証するものではありません。
        </p>
        <ul className="ehc-result-chips mt-4 flex flex-wrap gap-2" aria-label="判定の内訳">
          <li><span>今回の公募で進められる</span><strong>{current.length}</strong>件</li>
          {nextRound.length > 0 && <li><span>次回の公募に備える</span><strong>{nextRound.length}</strong>件</li>}
          {secondaryLevels.map((level) =>
            byFit(level).length > 0 ? (
              <li key={level}><span>{FIT_VIEW[level].label}</span><strong>{byFit(level).length}</strong>件</li>
            ) : null
          )}
        </ul>
        <details className="mt-3">
          <summary className="min-h-[48px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
            判定の見方
          </summary>
          <dl className="mt-2 space-y-3">
            <div>
              <dt className="text-[14px] font-bold leading-[1.8] text-ink">次回の公募に備える</dt>
              <dd className="mt-1 text-[14px] leading-[1.8] text-ink-soft">
                条件は合う見込みですが、今回の締切までの日数が、申請の準備にかかる日数の目安より短い制度です。準備日数は運用上の目安です。
              </dd>
            </div>
            {(["high", "possible", "on_hold", "low", "not_possible"] as FitLevel5[]).map((level) => (
              <div key={level}>
                <dt className="text-[14px] font-bold leading-[1.8] text-ink">{FIT_VIEW[level].label}</dt>
                <dd className="mt-1 text-[14px] leading-[1.8] text-ink-soft">{FIT_VIEW[level].note}</dd>
              </div>
            ))}
          </dl>
        </details>
        <GlossaryDetails />
      </header>

      <ResultSummary
        input={input}
        result={result}
        current={current}
        nextRound={nextRound}
        energy={energy}
        investChoice={investChoice}
      />

      {/* 2026-09-25 電気料金の明細（任意）。削減額を推計できているときだけ出す（推計できないときは変わる数字が無い） */}
      {energy?.source === "equipment_estimate" && energyBill && onEnergyBillChange && (
        <EnergyBillInput bill={energyBill} energy={energy} onChange={onEnergyBillChange} />
      )}

      {investChoice && onInvestSourceChange && (
        <InvestBasisChooser choice={investChoice} onChange={onInvestSourceChange} idPrefix="result" />
      )}

      {changed.length > 0 && (
        <div className="ehc-result-changed rounded-2xl border border-ink-line bg-paper-sub p-4">
          <p className="text-[16px] font-bold leading-[1.7] text-ink">第1段階の候補から変わった制度</p>
          <ul className="mt-2 space-y-2">
            {changed.map(({ s, a }) => (
              <li key={s.id} className="text-[14px] leading-[1.7] text-ink-soft">
                <span className="font-bold text-ink">{s.name}</span>：設備の情報を加えた結果、「{FIT_VIEW[a.fit.level].label}」になりました。
                {a.fit.why[0] ? <span className="block">{a.fit.why[0]}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {partial && <PartialNotice projection={projection} onBack={onBack} />}

      {targetProductError && (
        <p className="ehc-result-product-warning rounded-2xl border border-amber-500/45 bg-amber-50 p-4 text-[14px] leading-[1.8] text-amber-800">
          <span className="block font-bold">対象製品の確認</span>
          {targetProductError}
        </p>
      )}

      <section aria-labelledby="result-group-current" className="ehc-result-fit-group space-y-3">
        <h3 id="result-group-current" className="flex items-start gap-2 rounded-2xl border border-brand/35 bg-[#edf6e8] px-4 py-3 text-[16px] font-bold leading-[1.7] text-brand-deep">
          <CheckCircle2 aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
          <span className="min-w-0">今回の公募で進められる制度</span>
          <span className="ml-auto shrink-0 tabular-nums">{current.length}件</span>
        </h3>
        {current.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {current.map((a, i) => (
              <li key={a.subsidy.id}>
                <ProgramCard
                  assessment={a}
                  level={a.fit.level}
                  prep={prepOf(a.subsidy, now)}
                  topPick={i === 0}
                  selfCheckAnswers={selfCheckAnswers}
                  onSelfCheckAnswer={onSelfCheckAnswer}
                  targetProduct={targetProduct?.details[a.subsidy.id]}
                  targetProductFiscalYear={targetProduct?.details[a.subsidy.id]?.fiscalYear ?? targetProduct?.fiscalYear}
                  targetProductStore={targetProduct?.store}
                  targetProductError={targetProductError}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-ink-line bg-paper-card p-4 text-[16px] leading-[1.8] text-ink">
            {nextRound.length > 0
              ? "今回の締切に間に合う制度は見つかりませんでした。下の「次回の公募に備える制度」で、今から準備できることを確認できます。"
              : "今回の条件で進められる制度は見つかりませんでした。条件が変われば候補になる制度もあります。担当者にご相談ください。"}
          </p>
        )}
      </section>

      {nextRound.length > 0 && (
        <section aria-labelledby="result-group-next" className="ehc-result-fit-group space-y-3">
          <h3 id="result-group-next" className="flex items-start gap-2 rounded-2xl border border-ink-line bg-paper-tint px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink">
            <CalendarClock aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
            <span className="min-w-0">次回の公募に備える制度</span>
            <span className="ml-auto shrink-0 tabular-nums">{nextRound.length}件</span>
          </h3>
          <p className="text-[14px] leading-[1.8] text-ink-soft">
            条件は合う見込みですが、今回の締切までに申請の準備が間に合わない可能性が高い制度です。次回の公募に向けて、今から準備を進められます。
          </p>
          <ul className="mt-2 space-y-4">
            {nextRound.map((a, i) => (
              <li key={a.subsidy.id}>
                <ProgramCard
                  assessment={a}
                  level={a.fit.level}
                  prep={prepOf(a.subsidy, now)}
                  nextRound
                  topPick={current.length === 0 && i === 0}
                  selfCheckAnswers={selfCheckAnswers}
                  onSelfCheckAnswer={onSelfCheckAnswer}
                  targetProduct={targetProduct?.details[a.subsidy.id]}
                  targetProductFiscalYear={targetProduct?.details[a.subsidy.id]?.fiscalYear ?? targetProduct?.fiscalYear}
                  targetProductStore={targetProduct?.store}
                  targetProductError={targetProductError}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {secondaryLevels.map((level) => {
        const items = byFit(level);
        if (items.length === 0) return null;
        const view = FIT_VIEW[level];
        const Icon = view.icon;
        return (
          <details key={level} className="ehc-result-fit-group ehc-result-secondary-group rounded-2xl border border-ink-line bg-paper-card px-4 py-2">
            <summary className="ehc-result-fit-summary min-h-[56px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
              <Icon aria-hidden="true" className="mr-1 inline h-5 w-5 align-[-4px]" />
              <span className="ml-1">{view.label}</span>
              <span className="ml-2 whitespace-nowrap text-[14px] font-semibold tabular-nums text-ink-soft">{items.length}件</span>
            </summary>
            <div className="pb-3">
              <p className="mt-1 text-[14px] leading-[1.8] text-ink-soft">{view.note}</p>
              <ul className="mt-4 space-y-4">
                {items.map((a) => (
                  <li key={a.subsidy.id}>
                    <ProgramCard
                      assessment={a}
                      level={level}
                      prep={prepOf(a.subsidy, now)}
                      targetProduct={targetProduct?.details[a.subsidy.id]}
                      targetProductFiscalYear={targetProduct?.details[a.subsidy.id]?.fiscalYear ?? targetProduct?.fiscalYear}
                      targetProductStore={targetProduct?.store}
                      targetProductError={targetProductError}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </details>
        );
      })}

      {monitorCheckedAt && (
        <p className="text-sm/[1.7] text-ink-soft">
          公式ページの更新確認:{" "}
          {new Date(monitorCheckedAt).toLocaleString("ja-JP", {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      <details className="ehc-result-energy rounded-2xl border border-ink-line bg-[#f5f7ef] px-4 py-2 sm:px-5">
        <summary className="min-h-[56px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
          省エネ見込みの算定根拠
        </summary>
        <div className="space-y-4 pt-3 pb-4">
          <EffectSummary result={result} energy={energy} />

          {/* 削減率の根拠と未確定の係数を、数値と同じ展開内に保持する。 */}
          <ReductionBasisPanel groups={result.groups} />

          {!result.coefficientAudit.allSourced && (
            <ProvisionalNotice audit={result.coefficientAudit} />
          )}
        </div>
      </details>
    </section>
  );
}

/* ───────── まとめ（2026-09-25 UXレビュー No.8） ─────────
   段の先頭に、お客様を動かす数字（補助額の目安・工事費・実質負担・年間の削減額・回収の目安）を
   まとめて出す。以前は削減額が畳まれた「省エネ見込み」の中にしか無かった。
   計算は1本も書かない。補助額は assessPrograms() の potentialManYen、
   実質負担と回収年数は lib/roiState.ts の buildRoiSnapshot() が出した値だけを読む。 */
function ResultSummary({
  input,
  result,
  current,
  nextRound,
  energy,
  investChoice,
}: {
  input: MatchInput;
  result: MatchResult;
  current: ProgramAssessment[];
  nextRound: ProgramAssessment[];
  energy: EnergyBasis | null;
  investChoice?: InvestChoice;
}) {
  /* 補助額の目安は「今回の公募で進められる制度」だけから取る。
     次回向けの制度の金額を、今回の見込みとして混ぜない。 */
  const best = current
    .filter((a) => a.amountShown)
    .sort((x, y) => y.potentialManYen - x.potentialManYen)[0] ?? null;
  const energyKnown = energy?.source !== "unknown";
  const roi = buildRoiSnapshot({
    investManYen: input.invest,
    subsidyConfirmed: !!best,
    subsidyManYen: best ? best.potentialManYen : null,
    saveYenPerYear: energyKnown ? result.saveYenPerYear : 0,
    investQuoted: input.investQuoted,
  });
  const investSourceLabel =
    investChoice?.source != null ? INVEST_SOURCE_LABEL[investChoice.source] : null;

  const subsidyNote = best
    ? best.subsidy.name
    : current.length === 0
      ? nextRound.length > 0
        ? `今回の締切に間に合う制度がありません（次回の公募に備える制度 ${nextRound.length}件）`
        : "今回の条件で進められる制度がありません"
      : roi.investState === "unknown"
        ? "工事費が未算定のため出していません（馬力を入れると概算できます）"
        : "条件の確認が済むまで、金額は出していません";

  return (
    <section aria-labelledby="result-summary-heading" className="ehc-result-summary rounded-2xl border border-brand/35 bg-[#f3f8ea] p-4 sm:p-5">
      <h3 id="result-summary-heading" className="flex items-center gap-2 text-[18px] font-bold leading-[1.6] text-ink">
        <ListChecks aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-deep" />
        診断のまとめ
      </h3>
      <dl className="ehc-result-summary-grid mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <SummaryItem
          term="補助額の目安（最大）"
          value={best ? `約${manYenText(best.potentialManYen)}万円` : current.length === 0 ? "今回はなし" : "未算定"}
          note={subsidyNote}
          strong
          wide
        />
        <SummaryItem
          term="工事費（税抜）"
          value={roi.investManYen != null ? `約${manYenText(roi.investManYen)}万円` : "未算定"}
          note={roi.investManYen != null ? investSourceLabel ?? "" : "馬力を入れると、設備から概算できます"}
        />
        <SummaryItem
          term="実質負担の目安"
          value={roi.investManYen != null && best ? `約${manYenText(roi.netInvestManYen ?? 0)}万円` : "未算定"}
          note={roi.investManYen != null && best ? "工事費 − 補助額の目安" : "工事費と補助額がそろうと出します"}
        />
        <SummaryItem
          term="年間の電気代削減"
          value={energyKnown && result.saveYenPerYear > 0 ? `約${manYenText(result.saveYenPerYear / 10000)}万円` : "未算定"}
          note={
            energyKnown
              ? energy?.priceSource === "bill"
                ? `電気代は明細の単価 ${energy.priceYenPerKwh.toFixed(1)}円/kWh で計算`
                : `電気代は ${ELECTRIC_PRICE_YEN_PER_KWH.toFixed(1)}円/kWh（推計）で計算`
              : "馬力が未入力の設備があるため、出していません"
          }
        />
        <SummaryItem
          term="回収の目安"
          value={roi.recoveryYears != null && best ? `約${roi.recoveryYears}年` : roi.recoveryYearsNoSubsidy != null ? `約${roi.recoveryYearsNoSubsidy}年` : "未算定"}
          note={
            roi.recoveryYears != null && best
              ? "補助金を使った場合"
              : roi.recoveryYearsNoSubsidy != null
                ? "補助金を使わない場合"
                : "工事費と削減額がそろうと出します"
          }
        />
        <SummaryItem
          term="CO2の削減量（年間）"
          value={energyKnown ? co2TonLabel(result.co2ReductionTon, "t") : "未算定"}
          note={energyKnown ? "設備からの推計" : "馬力が未入力の設備があるため、出していません"}
        />
      </dl>
      <p className="mt-4 rounded-xl bg-paper-card px-4 py-3 text-[14px] leading-[1.8] text-ink">
        <span className="font-bold">次にやること：</span>
        {current.length + nextRound.length > 0
          ? "下の制度カードの「この制度に合うか、今確認する」で、ご自身で確かめられる条件をその場で確認できます（2〜3問）。"
          : ""}
        {current.length > 0
          ? "そのうえで「概算費用と工事」で工事費の内訳を確かめ、診断書を受け取って担当者にご相談ください。締切のある制度は、準備を早めに始めるほど選べる手が増えます。"
          : "そのうえで診断書を受け取って担当者にご相談ください。次回の公募に向けた準備や、買い替えずに冷媒を入れ替える方法（ドロップイン）もご提案します。"}
      </p>
      <p className="mt-3 text-[14px] leading-[1.7] text-ink-soft">
        金額はすべて概算です。工事費は現地確認後の正式見積で、補助額は公募要領と審査で変わります。
      </p>
    </section>
  );
}

/* dl の中の div には dt と dd しか置けない（補足も dd の中に入れる）。 */
function SummaryItem({ term, value, note, strong, wide }: { term: string; value: string; note: string; strong?: boolean; wide?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-paper-card px-3 py-3 sm:px-4", wide && "col-span-2 lg:col-span-1")}>
      <dt className="text-[14px] leading-[1.6] text-ink-soft">{term}</dt>
      <dd className="mt-1">
        <span className={cn("block font-bold tabular-nums leading-[1.3]", strong ? "text-[24px] text-brand-deep" : "text-[20px] text-ink")}>{value}</span>
        {note ? <span className="mt-1 block text-[14px] leading-[1.6] text-ink-soft">{note}</span> : null}
      </dd>
    </div>
  );
}

/* 一部の群だけ計算したことの明示。
   合計値が全設備のものだと読まれると、実際より小さい数字を
   「この建物の全部」として持ち帰られる。 */
function PartialNotice({
  projection,
  onBack,
}: {
  projection: EquipProjection;
  onBack?: () => void;
}) {
  const n = projection.unresolvedGroups.length;
  return (
    <div className="rounded-2xl border border-amber-500/45 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-base/[1.7] text-ink">
        <AlertCircle aria-hidden="true" className="w-5 h-5 flex-shrink-0 text-amber-700 mt-0.5" />
        <span>
          <span className="font-bold text-amber-800">
            {n}群を計算に含めていません。
          </span>
          下の数字は、入力が揃っている
          {projection.equipGroups.length}群だけの合計です。建物全体の合計ではありません。
        </span>
      </p>
      <details className="mt-2">
        <summary className="min-h-[48px] cursor-pointer py-3 text-sm/[1.7] font-bold text-amber-800 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
          計算に含めていない設備と理由を見る
        </summary>
        <ul className="mt-2.5 space-y-1.5 pl-7">
          {projection.unresolvedGroups.map((u) => (
            <li key={u.group.id} className="text-sm/[1.7] text-ink-soft leading-[1.7]">
              {u.reasons.map((r) => UNRESOLVED_REASON_LABEL[r]).join(" / ")}
            </li>
          ))}
        </ul>
      </details>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-3 min-h-[48px] w-full rounded-2xl border border-ink-line bg-paper-card px-4 text-sm/[1.7] font-bold text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
        >
          足りない設備を入力しに戻る
        </button>
      )}
    </div>
  );
}

/* 削減の概算。金額計算はしない——match.ts が出した値をそのまま並べる。 */
function EffectSummary({ result, energy }: { result: MatchResult; energy: EnergyBasis | null }) {
  /* 2026-09-25 UXレビュー 追加所見: 年間kWh は設備からの推計。推計できないときは数字を出さない。 */
  if (energy?.source === "unknown") {
    return (
      <div className="rounded-2xl border border-ink-line bg-paper-card p-4">
        <h3 className="text-base/[1.7] font-bold text-ink">更新したときの年間の見込み</h3>
        <p className="mt-2 text-sm/[1.7] leading-[1.7] text-ink-soft">{ENERGY_SOURCE_NOTE.unknown}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-ink-line bg-paper-card p-4">
      <h3 className="text-base/[1.7] font-bold text-ink">更新したときの年間の見込み</h3>
      <p className="mt-1 text-sm/[1.7] leading-[1.7] text-ink-soft">{ENERGY_SOURCE_NOTE.equipment_estimate}</p>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Stat
          term="電気の使用量"
          value={`${result.totalKwh.toLocaleString("ja-JP")} kWh`}
          note={
            energy?.cappedByBill
              ? "いまの年間使用量（設備からの推計。明細の年間使用量を上限にしました）"
              : "いまの年間使用量（設備からの推計）"
          }
        />
        <Stat
          term="減らせる見込み"
          value={`約 ${Math.round(result.effectiveReductionRate * 100)} %`}
          note={`年間 約${result.saveYenPerYear.toLocaleString("ja-JP")}円（${
            energy?.priceSource === "bill"
              ? `明細の単価 ${energy.priceYenPerKwh.toFixed(1)}円/kWh`
              : `推計の単価 ${ELECTRIC_PRICE_YEN_PER_KWH.toFixed(1)}円/kWh`
          }）`}
        />
        <Stat
          term="CO2の削減量"
          value={co2TonLabel(result.co2ReductionTon, "t/年")}
          note="未算定は、算定した結果が0という意味ではありません"
        />
      </dl>
    </div>
  );
}

function Stat({ term, value, note }: { term: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-ink-line bg-paper-tint px-3 py-2.5">
      <dt className="text-sm/[1.7] text-ink-soft">{term}</dt>
      <dd className="text-lg font-black text-ink tabular-nums leading-[1.3] mt-0.5">{value}</dd>
      <p className="text-sm/[1.7] text-ink-soft leading-[1.7] mt-1">{note}</p>
    </div>
  );
}

function ProvisionalNotice({
  audit,
}: {
  audit: MatchResult["coefficientAudit"];
}) {
  return (
    <details className="rounded-2xl border border-ink-line bg-paper-sub p-4">
      {/* 2026-09-14 EHC-0039: 開閉の見出しも「押す場所」なので48px以上にする
          v3の§7は新規5段の操作対象を48px以上と決めている。summary は既定では
          文字の高さぶん（実測24px）しか無く、指の幅に足りない。display は
          list-item のまま上下の余白だけで高さを作る。flex へ変えると開閉の
          三角印が消えて、押せる場所だと分からなくなるため使わない。 */}
      <summary className="cursor-pointer text-sm/[1.7] font-bold text-ink min-h-[48px] py-3 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
        この削減率は暫定値です（{audit.provisional.length}件の係数が出典未確定）
      </summary>
      <p className="mt-2 text-sm/[1.7] leading-[1.7] text-ink-soft">
        下の係数は、EHCとして提示できる一次資料をまだ特定できていないものです。
        数字を伏せずに出したうえで、何が未確定かを同じ場所に書いています。
      </p>
      <ul className="mt-2.5 space-y-2">
        {audit.provisional.map((c) => (
          <li key={c.label} className="text-sm/[1.7] leading-[1.7]">
            <span className="font-bold text-ink">
              {c.label}（{c.value}）
            </span>
            <span className="block text-ink-soft">根拠: {c.basis}</span>
            <span className="block text-ink-soft">必要な資料: {c.needed}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ───────── 制度1件 ───────── */

function ProgramCard({
  assessment: a,
  level,
  prep,
  nextRound = false,
  topPick = false,
  selfCheckAnswers,
  onSelfCheckAnswer,
  targetProduct,
  targetProductFiscalYear,
  targetProductStore,
  targetProductError,
}: {
  assessment: ProgramAssessment;
  level: FitLevel5;
  /** 受付中の制度だけ。lib/prep.ts の judgePrep() の結果（2026-09-25 UXレビュー No.1） */
  prep?: PrepJudgement | null;
  /** 今回の締切に準備が間に合わない見込みで、「次回の公募に備える」段に置いたカード */
  nextRound?: boolean;
  /** いちばん可能性が高い制度（段の先頭）。適合チェックを最初から開いておく */
  topPick?: boolean;
  /** 適合チェック（2026-09-25）。渡されたカードにだけ「この制度に合うか、今確認する」を出す */
  selfCheckAnswers?: SelfCheckAnswers;
  onSelfCheckAnswer?: (key: SelfCheckKey, value: string) => void;
  /* この制度についての照合結果。サーバが作った物をそのまま出すだけで、
     ここで判定し直したり、無いものを既定値で埋めたりしない。 */
  targetProduct?: TargetProductDetail;
  targetProductFiscalYear?: number;
  /** 照合記録の保存先。未接続なら、その事実をそのまま画面に出す */
  targetProductStore?: { name: string; connected: boolean };
  targetProductError?: string | null;
}) {
  const view = FIT_VIEW[level];
  const Icon = view.icon;
  /* 適合度の理由（a.fit.why）は、多くの場合 a.missing と同じ文を含む。
     同じ文を2箇所へ並べると、読み手は別々の指摘だと思って数える。
     「適合度の理由」を先に出し、残りだけを「確認が必要な点」に回す。
     フィルタで消えた行が無いことは、両方を足せば元の件数になることで確かめられる。 */
  const extraMissing = a.missing.filter((m) => !a.fit.why.includes(m));
  return (
    <article className={cn("ehc-result-program rounded-2xl border bg-paper-card p-4 sm:p-5", topPick ? "border-brand border-[1.5px]" : "border-ink-line")}>
      {topPick && (
        <p className="mb-2 inline-flex rounded-full bg-brand-deep px-3 py-1 text-[13px] font-bold leading-[1.5] text-white">
          いちばん可能性が高い制度
        </p>
      )}
      <h4 className="text-[18px] font-bold leading-[1.6] text-ink">{a.subsidy.name}</h4>

      {/* 状態は色だけで示さない。アイコン＋語＋読み上げ用の語を必ず添える。 */}
      <p className={cn("mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm/[1.7] font-bold", view.tone)}>
        <Icon aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
        {view.label}
      </p>

      {prep?.verdict === "tight" && !nextRound && (
        <p className="ml-2 mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-50 px-2 py-1 text-sm/[1.7] font-bold text-amber-800">
          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          締切が近い（残り約{Math.max(0, prep.daysLeft ?? 0)}日）
        </p>
      )}

      <div className="ehc-result-timing mt-4 rounded-xl bg-[#f4f7ec] px-4 py-3">
        <p className="text-[14px] font-bold text-brand-deep">申請時期</p>
        <p className="mt-1 text-[16px] leading-[1.8] text-ink">{a.timing}</p>
      </div>

      {nextRound ? (
        /* 2026-09-25 UXレビュー No.1: 間に合わない制度は金額を主役にしない。
           「次回の公募の目安」と「今からできる準備」を先に出し、金額は参考として小さく添える。 */
        <div className="ehc-result-nextround mt-4 rounded-xl border border-ink-line bg-paper-card px-4 py-3">
          <p className="text-[14px] font-bold leading-[1.7] text-ink">次回の公募に向けて</p>
          <p className="mt-1 text-[16px] leading-[1.8] text-ink">
            今回の締切までの準備は難しい見込みです。次回の公募の日程は、公式の発表をお待ちください。
          </p>
          {a.subsidy.docs && (
            <p className="mt-2 text-[14px] leading-[1.8] text-ink-soft">
              <span className="font-bold text-ink">今からできる準備：</span>必要書類（{a.subsidy.docs}）をそろえておく
            </p>
          )}
          {a.amountShown && (
            <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
              参考：今回と同じ条件なら、補助額の目安は最大 約{manYenText(a.potentialManYen)}万円（次回の公募要領で変わることがあります）
            </p>
          )}
        </div>
      ) : (
        /* 金額か、金額を出さない理由。どちらか必ず出す（空欄にしない）。 */
        <p className="mt-4 text-sm/[1.7]">
          {a.amountShown ? (
            <>
              <span className="text-ink-soft text-sm/[1.7]">補助額の目安 </span>
              <span className="font-black text-ink tabular-nums">
                最大 約{manYenText(a.potentialManYen)}万円
              </span>
            </>
          ) : (
            <span className="text-ink-soft text-sm/[1.7] leading-[1.7]">
              {a.subsidy.infoOnly ? "設備費の概算には含めません。" : "補助額は未算定です。"}
            </span>
          )}
        </p>
      )}

      {selfCheckAnswers && onSelfCheckAnswer && (
        <ProgramSelfCheck
          subsidy={a.subsidy}
          fitLevel={level}
          fitWhy={a.fit.why}
          prepVerdict={prep?.verdict ?? null}
          answers={selfCheckAnswers}
          onAnswer={onSelfCheckAnswer}
          defaultOpen={topPick}
        />
      )}

      {a.missing.length > 0 && (
        <p className="mt-2 text-sm/[1.7] leading-[1.7] text-amber-800">
          未確認の項目があります（{a.missing.length}項目）。
        </p>
      )}

      {/* 根拠の展開。判定の言い分を全部ここに入れ、閉じた状態でも
          「なぜそう出たのか」を開けば読めるようにしておく。
          読ませたくない判定を出すくらいなら、その判定を出さない。 */}
      <details className="mt-2.5">
        {/* 2026-09-14 EHC-0039: ここも押す場所。上と同じ理由で48px以上にする。 */}
        <summary className="cursor-pointer text-sm/[1.7] font-bold text-brand-deep min-h-[48px] py-3.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
          確認事項・次にすること・判定の根拠
        </summary>
        <div className="mt-2 space-y-2.5">
          <div>
            <p className="text-sm/[1.7] font-bold text-ink">次にすること</p>
            <p className="mt-1 text-sm/[1.7] text-ink-soft leading-[1.7]">{a.nextAction}</p>
          </div>
          {!a.amountShown && (
            <div>
              <p className="text-sm/[1.7] font-bold text-ink">補助額を出していない理由</p>
              <p className="mt-1 text-sm/[1.7] leading-[1.7] text-ink-soft">
                {a.amountUnavailableReason ?? "金額は算定していません。"}
              </p>
            </div>
          )}
          <p className="text-sm/[1.7] leading-[1.7] text-ink">{a.reason}</p>

          {a.fit.why.length > 0 && (
            <div>
              <p className="text-sm/[1.7] font-bold text-ink">
                「{view.label}」と判定した理由
              </p>
              <ul className="mt-1 space-y-1">
                {a.fit.why.map((w) => (
                  <li key={w} className="text-sm/[1.7] text-ink-soft leading-[1.7]">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 2026-09-16 EHC-0039 修正2:
              算定可否は適合度と別の軸なので、別の見出しで出す。
              以前は「適合は低い」の理由の中に
              『この制度は本アプリで補助額を算定する対象ではありません』が混ざっていた。
              混ざっていると、読み手は「制度に合っていないから金額が出ない」と読む。
              実際は逆で、制度には合っているがこちらが算定していないだけ、という場合がある。
              見出しに「適合度とは別」と明記して、その読み違いを塞ぐ。 */}
          {!a.fit.amount.calculable && a.fit.amount.note && (
            <div>
              <p className="text-sm/[1.7] font-bold text-ink">
                補助額の算定について（適合度とは別の話です）
              </p>
              <p className="mt-1 text-sm/[1.7] text-ink-soft leading-[1.7]">
                {a.fit.amount.note}
              </p>
            </div>
          )}

          {extraMissing.length > 0 && (
            <div>
              <p className="text-sm/[1.7] font-bold text-ink">確認が必要な点</p>
              <ul className="mt-1 space-y-1">
                {extraMissing.map((m) => (
                  <li key={m} className="text-sm/[1.7] text-ink-soft leading-[1.7]">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ───────── 対象製品の確認（2026-09-16 EHC-0039 v2 §2） ─────────
              「登録されているか確認できていない」とだけ書いて終わらせない。
              どの年度・どの枠の一覧を、誰が、いつ、何を根拠に見たのかを出す。
              確認済みのときは出典・確認日・確認主体を必ず添える。
              未接続・通信失敗はその事実をそのまま書き、確認済みへ倒さない。 */}
          <TargetProductBlock
            detail={targetProduct}
            fiscalYear={targetProductFiscalYear}
            store={targetProductStore}
            error={targetProductError}
          />

          <dl className="text-sm/[1.7] text-ink-soft space-y-1">
            <div className="flex gap-2">
              <dt className="flex-shrink-0 font-bold text-ink">実施機関</dt>
              <dd>{a.subsidy.org}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="flex-shrink-0 font-bold text-ink">補助率</dt>
              <dd>{a.subsidy.rate}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="flex-shrink-0 font-bold text-ink">上限</dt>
              <dd>{a.subsidy.max}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="flex-shrink-0 font-bold text-ink">要件</dt>
              <dd className="leading-[1.7]">{a.subsidy.requirement}</dd>
            </div>
          </dl>

          {/* 監視の注記は、公式確認済みの制度でも必ず出す。
              「監視できていない」ことを黙って落とさないための枠。 */}
          {(a.monitorNote || a.coverageGap) && (
            <p className="text-sm/[1.7] text-amber-800 leading-[1.7]">
              {a.coverageGap
                ? "この制度は、公式ページの更新を自動で追えていません。申請前に必ず公式ページをご確認ください。"
                : a.monitorNote}
            </p>
          )}

          {a.subsidy.url && (
            <a
              href={a.subsidy.url}
              target="_blank"
              rel="noopener noreferrer"
              /* 2026-09-14 EHC-0039: 外部リンクも押す場所。実測24pxだったので
                 48px以上にする。inline-flex のまま min-h と items-center で
                 高さだけを作り、文字の見え方（下線・太さ）は変えない。 */
              className="inline-flex items-center gap-1 text-sm/[1.7] font-bold text-brand-deep underline min-h-[48px] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
            >
              公式ページを開く
              <ExternalLink aria-hidden="true" className="w-3 h-3" />
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          )}
        </div>
      </details>
    </article>
  );
}

/* ───────────────────────────────────────────────────────────
   対象製品の確認経路（EHC-0039 v2 §2 / 2026-09-16 v1）

   ■ ここが何をしないか
   　　判定しない。true を作らない。既定値で埋めない。
   　　detail が無いとき（＝サーバへ問い合わせていない）に
   　　「未確認です」と書くのは正しいが、「確認しました」は書けない。

   ■ 状態を色だけで示さない
   　　語で言い切る。読み上げでも同じ内容が伝わるようにする。
   ─────────────────────────────────────────────────────────── */

const TARGET_PRODUCT_HEADING: Record<TargetProductStatus, string> = {
  no_plan: "対象製品の確認：まだ照合していません",
  unchecked: "対象製品の確認：未確認です",
  not_listed: "対象製品の確認：登録を確認できませんでした",
  listed: "対象製品の確認：登録済みを確認しました",
  /* 2026-09-16 台帳#32。「未確認」と分ける。
     未確認＝担当者が一覧と突き合わせれば進む。
     枠未確定＝先に申請枠を決めないと、見るべき一覧そのものが決まらない。
     次の一手が違うので、見出しも分ける。 */
  frame_undecided: "対象製品の確認：申請枠が決まっていないため照合できません",
};

const PLANNED_UNIT_LABEL: Record<PlannedUnitStatus, string> = {
  model_missing: "型番が未入力",
  kind_unknown: "設備の種類が未選択",
  kind_not_covered: "この制度の対象種別ではないため照合対象外",
  unchecked: "未確認",
  stale: "記録はあるが条件がずれているため無効",
  not_listed: "登録されていない",
  inconclusive: "確認したが判断できなかった",
  listed: "登録済みを確認",
};

function TargetProductBlock({
  detail,
  fiscalYear,
  store,
  error,
}: {
  detail?: TargetProductDetail;
  fiscalYear?: number;
  store?: { name: string; connected: boolean };
  error?: string | null;
}) {
  return (
    <div>
      <p className="text-sm/[1.7] font-bold text-ink">
        {detail
          ? TARGET_PRODUCT_HEADING[detail.status]
          : "対象製品の確認：未確認です"}
      </p>

      {/* 取得に失敗した場合。失敗は未確認であって、登録の根拠ではない。 */}
      {error && (
        <p className="mt-1 text-sm/[1.7] text-amber-800 leading-[1.7]">{error}</p>
      )}

      {detail && (
        <p className="mt-1.5 text-sm/[1.7] text-ink-soft leading-[1.7]">
          <span className="font-bold text-ink">この点について次にすること：</span>
          {detail.nextAction}
        </p>
      )}

      <details className="mt-1.5">
        <summary className="min-h-[48px] cursor-pointer py-3 text-sm/[1.7] font-bold text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
          照合の根拠・機器ごとの内訳
        </summary>

        <p className="mt-1 text-sm/[1.7] text-ink-soft leading-[1.7]">
          {detail
            ? detail.reason
            : "導入予定の機器をまだ伺っていないため、対象製品一覧との照合を行っていません。いま付いている機械の型番は、撤去する側のものなので照合の根拠になりません。"}
        </p>

        {detail && (
          <dl className="mt-1.5 text-sm/[1.7] text-ink-soft space-y-1">
            <div className="flex gap-2">
              <dt className="flex-shrink-0 font-bold text-ink">照合した年度</dt>
              <dd className="tabular-nums">
                {fiscalYear ? `${fiscalYear}年度` : "不明"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="flex-shrink-0 font-bold text-ink">申請枠</dt>
              {/* 2026-09-16 台帳#32。枠が2つ以上あるあいだ detail.frame は
                  「（申請枠が未確定）」になる。それだけだと、どの枠から選ぶのかが分からない。
                  候補が複数あるときは候補名も並べる。 */}
              <dd className="leading-[1.7]">
                {detail.frames.length > 1
                  ? `${detail.frame}（候補：${detail.frames.join("／")}）`
                  : detail.frame}
              </dd>
            </div>
          </dl>
        )}

        {/* 台ごとの内訳。合計だけを出すと、どの台で止まっているか分からない。 */}
        {detail && detail.units.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {detail.units.map((u) => (
              <li key={u.unitId} className="text-sm/[1.7] text-ink-soft leading-[1.7]">
                {u.model ? u.model : "（型番未入力）"} — {PLANNED_UNIT_LABEL[u.status]}
                {u.staleReason ? `（${u.staleReason}）` : ""}
              </li>
            ))}
          </ul>
        )}

        {/* 確認済みのときだけ、出典・確認日・確認主体を出す。
            ここが空のまま「確認済み」と書くことはできない。 */}
        {detail && detail.evidence.length > 0 && (
          <div className="mt-1.5">
            <p className="text-sm/[1.7] font-bold text-ink">確認の根拠</p>
            <ul className="mt-1 space-y-1">
              {detail.evidence.map((e) => (
                <li
                  key={`${e.model}-${e.checkedOn}`}
                  className="text-sm/[1.7] text-ink-soft leading-[1.7] break-words"
                >
                  {e.model}：{e.officialSource}（確認日 {e.checkedOn} ／ 確認者 {e.checkedBy}）
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 保存先が未接続なら、そのことを隠さない。
            未接続のときに「確認済み」が出ないのは仕様であって不具合ではない。 */}
        {store && !store.connected && (
          <p className="mt-1.5 text-sm/[1.7] text-amber-800 leading-[1.7]">
            対象製品の確認記録の保存先がまだ接続されていません（現在の設定：{store.name}）。
            そのため、この画面では「登録済みを確認しました」は表示されません。
          </p>
        )}

      </details>
    </div>
  );
}
