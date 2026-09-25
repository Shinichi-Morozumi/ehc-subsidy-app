"use client";

import { CheckCircle2, HelpCircle, XCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchInput } from "@/lib/types";
import { co2TonLabel, type MatchResult } from "@/lib/match";
import type { FitLevel5 } from "@/lib/eligibility";
import {
  useProgramAssessments,
  type ProgramAssessment,
} from "./ProgramMatchBoard";
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
  high: {
    label: "適合は高い",
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
    label: "確認すれば候補（余地あり）",
    note: "対象外と決まったわけではありません。お伺いすれば埋まる項目が残っています。何が分かれば判定できるかを下に並べています。",
    icon: HelpCircle,
    tone: "border-amber-500/45 bg-amber-50 text-amber-800",
  },
  on_hold: {
    label: "判定保留",
    note: "制度側の情報が揃っていないため、まだ判定できません。公募要領の公表や公式確認を待つ段階で、お客様側で埋められる項目ではありません。",
    icon: Clock,
    tone: "border-ink-line bg-paper-tint text-ink",
  },
  low: {
    label: "適合は低い",
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
    label: "今回は対象外（不可）",
    note: "受付が終了しているか、要件と明確に矛盾する点があります。理由を下に出しています。",
    icon: XCircle,
    tone: "border-ink-line bg-paper-sub text-ink-soft",
  },
};

/* 並び順は「次に手が動くか」で決める。
   高い → 余地あり（聞けば進む） → 判定保留（待つ） → 低い → 不可。 */
const FIT_ORDER: FitLevel5[] = ["high", "possible", "on_hold", "low", "not_possible"];

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
}

export function ResultStage({
  input,
  result,
  projection,
  onBack,
  targetProduct,
  targetProductError,
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

function ComputedResult({
  input,
  result,
  projection,
  onBack,
  targetProduct,
  targetProductError,
}: {
  input: MatchInput;
  result: MatchResult;
  projection: EquipProjection;
  onBack?: () => void;
  targetProduct?: TargetProductApiResponse;
  targetProductError?: string | null;
}) {
  /* 第3引数は「試算に含めなかった群の種類」（2026-09-16 EHC-0039 修正2 で件数から変更）。
     ルームエアコン2台を入れた画面で、計算に入った1群だけを見て
     「入力した設備はすべて対象」と読ませないこと（lib/eligibility.ts 冒頭の禁止事項）。
     件数だけを渡していた頃は、ルームエアコン（対象種別でないと分かっている）と
     種類未選択（何も分かっていない）が同じ1件として届いていたため、
     判定側はどちらとも言えず、結局どの制度も「すべて対象種別」になっていた。 */
  const { assessments, monitorCheckedAt } = useProgramAssessments(
    input,
    result,
    projection.excludedKinds
  );

  /* 判定は assessFit() が済ませてある。ここは仕分けるだけ。 */
  const byFit = (level: FitLevel5) =>
    assessments.filter((a) => a.fit.level === level);

  /* 計算に回せなかった群が「1つも無い」のか「一部あった」のかを区別する。
     一部だけ計算した結果を、全設備の結果として読ませない。 */
  const partial = projection.unresolvedGroups.length > 0;

  return (
    <section aria-labelledby="result-heading" className="ehc-result-stage space-y-6">
      <header className="ehc-result-header">
        <p className="mb-2 text-[14px] font-semibold text-brand-deep">{assessments.length}制度の判定結果</p>
        <h2 id="result-heading" className="text-2xl font-bold leading-relaxed tracking-tight text-ink">
          制度の候補と、申請時期を確認
        </h2>
        <p className="mt-3 text-[16px] leading-[1.8] text-ink-soft">
          採択や補助額を保証するものではありません。
        </p>
        <details className="mt-3">
          <summary className="min-h-[48px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
            判定の見方と内訳
          </summary>
          <p className="mt-2 text-[16px] leading-[1.8] text-ink-soft">
            制度ごとの適合度と申請時期を整理しました。判定の根拠・未確認事項は、各制度から開けます。
          </p>
          <dl className="ehc-result-counts mt-5 grid grid-cols-2 gap-3">
            {(["high", "possible"] as const).map((level) => (
              <div key={level} className="rounded-2xl bg-[#f0f5e5] px-4 py-3">
                <dt className="text-[14px] font-semibold leading-relaxed text-ink-soft">{FIT_VIEW[level].label}</dt>
                <dd className="mt-2 text-2xl font-bold tabular-nums text-brand-deep">
                  {byFit(level).length}<span className="ml-1 text-[14px] font-medium">件</span>
                </dd>
              </div>
            ))}
          </dl>
          <dl className="mt-4 space-y-3">
            {FIT_ORDER.map((level) => (
              <div key={level}>
                <dt className="text-[14px] font-bold leading-[1.8] text-ink">{FIT_VIEW[level].label}</dt>
                <dd className="mt-1 text-[14px] leading-[1.8] text-ink-soft">{FIT_VIEW[level].note}</dd>
              </div>
            ))}
          </dl>
        </details>
      </header>

      {partial && <PartialNotice projection={projection} onBack={onBack} />}

      {targetProductError && (
        <p className="ehc-result-product-warning rounded-2xl border border-amber-500/45 bg-amber-50 p-4 text-[14px] leading-[1.8] text-amber-800">
          <span className="block font-bold">対象製品の確認</span>
          {targetProductError}
        </p>
      )}

      {FIT_ORDER.map((level) => {
        const items = byFit(level);
        if (items.length === 0) return null;
        const view = FIT_VIEW[level];
        const Icon = view.icon;
        const content = (
          <>
            <ul className="mt-4 space-y-4">
              {items.map((a) => (
                <li key={a.subsidy.id}>
                  <ProgramCard
                    assessment={a}
                    level={level}
                    targetProduct={targetProduct?.details[a.subsidy.id]}
                    /* 2026-09-16 台帳#32。年度は制度ごとに決まる（SIIの設備単位型／
                       GX設備単位型は令和7年度補正＝2025年度の事業で、3次公募の受付だけが
                       2026年度に行われる）。応答トップの fiscalYear は「今日の年度」の既定値なので、
                       それをカードに出すと、実際に照合した年度と1年ずれた年度を画面が名乗る。
                       制度ごとの年度があればそれを使い、無い場合だけ既定値へ落とす。 */
                    targetProductFiscalYear={
                      targetProduct?.details[a.subsidy.id]?.fiscalYear ?? targetProduct?.fiscalYear
                    }
                    targetProductStore={targetProduct?.store}
                    targetProductError={targetProductError}
                  />
                </li>
              ))}
            </ul>
          </>
        );

        if (level === "high" || level === "possible") {
          return (
            <section key={level} aria-labelledby={`result-fit-${level}`} className="ehc-result-fit-group space-y-3">
              <h3 id={`result-fit-${level}`} className={cn("flex items-start gap-2 rounded-2xl border px-4 py-3 text-[16px] font-bold leading-[1.7]", view.tone)}>
                <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
                <span className="min-w-0">{view.label}</span>
                <span className="ml-auto shrink-0 tabular-nums">{items.length}件</span>
              </h3>
              {content}
            </section>
          );
        }

        return (
          <details key={level} className="ehc-result-fit-group ehc-result-secondary-group rounded-2xl border border-ink-line bg-paper-card px-4 py-2">
            <summary className="ehc-result-fit-summary min-h-[56px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
              <span className="ml-1">{view.label}</span>
              <span className="ml-2 whitespace-nowrap text-[14px] font-semibold tabular-nums text-ink-soft">{items.length}件</span>
            </summary>
            <div className="pb-3">{content}</div>
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
          更新後の省エネ見込みと算定根拠
        </summary>
        <div className="space-y-4 pt-3 pb-4">
          <EffectSummary result={result} />

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
function EffectSummary({ result }: { result: MatchResult }) {
  return (
    <div className="rounded-2xl border border-ink-line bg-paper-card p-4">
      <h3 className="text-base/[1.7] font-bold text-ink">更新したときの年間の見込み</h3>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Stat
          term="電気の使用量"
          value={`${result.totalKwh.toLocaleString("ja-JP")} kWh`}
          note="いまの年間使用量（入力した総量を設備群へ按分した値）"
        />
        <Stat
          term="減らせる見込み"
          value={`約 ${Math.round(result.effectiveReductionRate * 100)} %`}
          note={`年間 約${result.saveYenPerYear.toLocaleString("ja-JP")}円`}
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
  targetProduct,
  targetProductFiscalYear,
  targetProductStore,
  targetProductError,
}: {
  assessment: ProgramAssessment;
  level: FitLevel5;
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
    <article className="ehc-result-program rounded-2xl border border-ink-line bg-paper-card p-4 sm:p-5">
      <h4 className="text-[18px] font-bold leading-[1.6] text-ink">{a.subsidy.name}</h4>

      {/* 状態は色だけで示さない。アイコン＋語＋読み上げ用の語を必ず添える。 */}
      <p className={cn("mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm/[1.7] font-bold", view.tone)}>
        <Icon aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
        {view.label}
      </p>

      <div className="ehc-result-timing mt-4 rounded-xl bg-[#f4f7ec] px-4 py-3">
        <p className="text-[14px] font-bold text-brand-deep">申請時期</p>
        <p className="mt-1 text-[16px] leading-[1.8] text-ink">{a.timing}</p>
      </div>

      {/* 金額か、金額を出さない理由。どちらか必ず出す（空欄にしない）。 */}
      <p className="mt-4 text-sm/[1.7]">
        {a.amountShown ? (
          <>
            <span className="text-ink-soft text-sm/[1.7]">補助額の目安 </span>
            <span className="font-black text-ink tabular-nums">
              最大 約{a.potentialManYen.toLocaleString("ja-JP")}万円
            </span>
          </>
        ) : (
          <span className="text-ink-soft text-sm/[1.7] leading-[1.7]">
            {a.subsidy.infoOnly ? "設備費の概算には含めません。" : "補助額は未算定です。"}
          </span>
        )}
      </p>

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
