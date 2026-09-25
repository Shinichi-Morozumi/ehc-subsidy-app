"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchSubsidies } from "@/lib/match";
import type { Subsidy } from "@/lib/types";
import { applyInvestChoice, resolveInvestChoice, type InvestSource } from "@/lib/amountBasis";
import { applyEquipmentEnergy } from "@/lib/diagnosisEnergy";
import { newDiagnosisState, type DiagnosisState } from "@/lib/diagnosisState";
import { projectEquipGroups, toMatchInput } from "@/lib/diagnosisProjection";
import { useProject } from "./ProjectContext";
import { StageNav, DIAGNOSIS_STAGES, type DiagnosisStage } from "./StageNav";
import { EquipInputStage } from "./EquipInputStage";
import { useTargetProduct } from "./useTargetProduct";
import { ResultStage } from "./ResultStage";
import { EstimateStage } from "./EstimateStage";
import { applyEstimateGroupPatches } from "./estimateInputFields";
import { ContactStage } from "./ContactStage";
import { GlossaryDetails } from "./Glossary";

/* ───────────────────────────────────────────────────────────
   5段の診断フローの器（EHC-0039 第9片 / 2026-09-14 v1）

   ■ この器がやること
   　　段の現在地を持ち、A〜Eのどれを描くかを決める。それだけ。
   　　金額も適格性も工程日数も、ここでは1行も計算しない。
   　　計算は lib/match.ts・lib/pricing.ts・lib/timeline.ts・lib/eligibility.ts
   　　にしかない、という前提をここで崩さない。

   ■ 既存の診断（SubsidyMatcher）との関係
   　　入口は今までどおり HomeV17 → OPEN_HEARING_EVENT → GuidedDiagnosis である。
   　　そこで答えた所在地・事業規模・建物用途などは、SubsidyMatcher が
   　　ProjectContext へ draft / input として流している。
   　　この器はそれを **読むだけ** で、SubsidyMatcher には触らない。

   　　なぜ SubsidyMatcher の中に組み込まないか:
   　　　あのファイルは2,000行を超えていて、結果表示・適格性チェック・
   　　　提案書・ロードマップ・共有URLが同居している。
   　　　新しい5段をその内側に差し込むと、いま本番で動いている
   　　　既存の導線まで一緒に壊れる範囲に入る。
   　　　EHC-0039 の作業範囲は新規5段であって、既存診断の作り替えではない。

   ■ A段「候補を見る」に新しい判定を書かない
   　　A段が見せるのは、SubsidyMatcher が matchSubsidies() で既に出した候補である。
   　　ここで「この人ならこの制度」を作り直すと、同じ画面の中で
   　　候補の出どころが2つになる。名前を並べるだけにする。

   ■ 段を進む条件はここが持つ
   　　StageNav は渡された current / reached を描くだけで、遷移条件を持たない。
   　　「設備が1群でも計算できる形になったか」を判定するのは
   　　lib/diagnosisProjection.ts の canCompute で、その結果をここで使う。
   　　判定式をこのファイルに書き写さない。
   ─────────────────────────────────────────────────────────── */

export function DiagnosisFlow() {
  const { draft, input: confirmed, result: confirmedResult } = useProject();

  /* 基準となる MatchInput。
     「即答」を押したあとの確定値があればそれ、まだなら入力中の draft。
     どちらも無い（＝まだ何も答えていない）ときは null で、A段が入口の案内を出す。 */
  const base = confirmed ?? draft;

  const [stage, setStage] = useState<DiagnosisStage>("find");
  const [state, setState] = useState<DiagnosisState>(() => newDiagnosisState());
  /* 到達済みの段。戻るのは自由、先へ飛ぶのは到達済みの範囲だけ。
     「まだ設備を入れていないのに概算費用の段へ飛べる」状態を作らない。 */
  const [reached, setReached] = useState<DiagnosisStage[]>(["find"]);

  /* base（所在地・規模などの回答）が無いときでも、設備側の投影だけは同じ関数で作る。
     ここで手書きの空オブジェクトを返すと、canCompute の定義がこのファイルにも
     生えることになる。判定は lib/diagnosisProjection.ts の1か所に置いたままにする。 */
  /* ───────── 対象製品の照合（EHC-0039 v2 §2 / 2026-09-16） ─────────
     導入予定機器をサーバへ送り、制度ごとの照合結果を受け取る。
     判定も true の生成もここではしない（app/api/target-product が唯一の作り手）。
     1台も入れていない間は undefined で、判定側は従来どおり未確認として扱う。 */
  const targetProduct = useTargetProduct(state.plannedUnits);

  const { input: projectedInput, projection } = useMemo(
    () =>
      base
        ? toMatchInput(
            state,
            base,
            targetProduct.data
              ? { checks: targetProduct.data.checks, notes: targetProduct.data.notes }
              : undefined
          )
        : { input: null, projection: projectEquipGroups(state) },
    [state, base, targetProduct.data]
  );

  /* 2026-09-25 UXレビュー 追加所見: 年間の電力使用量。
     5段の診断は kWh を聞いていないのに、旧シミュレーターの初期値（80,000kWh）が
     計算入力に残っていた。入力した設備（台数×馬力）と建物用途からの推計に置き換える。
     推計できないとき（馬力が未入力の設備がある）は不明として扱う。判定と式は lib/diagnosisEnergy.ts。 */
  const energyApplied = useMemo(
    () => (projectedInput ? applyEquipmentEnergy(projectedInput) : null),
    [projectedInput]
  );
  const energy = energyApplied?.energy ?? null;

  /* 2026-09-25 UXレビュー No.2: 補助額の計算に使う金額を1本にする。
     既定は「この診断の概算（税抜）」。7問目で答えた金額と違うときは、
     C段・D段の同じ選択肢から1回だけ選んでもらい、全段が同じ invest を読む。
     決め方は lib/amountBasis.ts。ここに式を書かない。 */
  const [investSource, setInvestSource] = useState<InvestSource>("estimate");
  const investChoice = useMemo(
    () => resolveInvestChoice(energyApplied?.input ?? null, investSource),
    [energyApplied, investSource]
  );
  const input = useMemo(
    () => (energyApplied ? applyInvestChoice(energyApplied.input, investChoice) : null),
    [energyApplied, investChoice]
  );

  /* matchSubsidies は equipGroups が空だと既定の設備群（R410A・パッケージ・
     15年前・1台）を勝手に立てて結果を返す。canCompute を見ずに呼ぶと、
     誰も答えていない設備の削減額が画面に出る。input が null なら呼ばない。 */
  const result = useMemo(() => (input ? matchSubsidies(input) : null), [input]);

  /* 2026-09-14 EHC-0039: 希望時期（ご希望条件）の出どころ
     ─────────────────────────────────────────────
     希望時期は入口の GuidedDiagnosis 第1問で既に伺っていて、MatchInput の
     desiredTiming に入っている。DiagnosisState 側の desiredTiming は
     5段のどの画面でも聞いていないため常に null で、そのまま D段・E段へ
     渡すと「伺ったのに画面に出ない」状態になる。同じことを二度聞かないために
     入口の回答を読む。5段側で聞くようになったらそちらを優先する順序にしてある。

     予算（customerBudgetYen）はここで埋めない。
     入口の第7問が持っているのは invest＝「更新の見積額」で、
     「相手が出せる予算」ではない。同じ数字として扱うと、
     見積額を答えただけで「ご予算」として画面に出てしまい、
     さらに v3 §4 の「予算を概算金額へ代入しない」も、代入の向きが逆になる。
     5段のどこかで予算を伺うまでは未回答（null）のままにする。 */
  const desiredTiming = state.desiredTiming ?? base?.desiredTiming ?? null;

  const go = (next: DiagnosisStage) => {
    setStage(next);
    setReached((prev) => (prev.includes(next) ? prev : [...prev, next]));
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const workspace = document.getElementById("diagnosis-workspace");
        workspace?.scrollIntoView({ block: "start", behavior: "auto" });
        workspace?.focus({ preventScroll: true });
      });
    }
  };

  return (
    <section id="diagnosis-workspace" tabIndex={-1} aria-label="空調更新の診断" className="ehc-diagnosis-flow space-y-5 no-print">
      <StageNav current={stage} reached={reached} onSelect={go} />

      {/* 2026-09-14 EHC-0039: 5段の外枠は既存カードの意匠をそのまま借りる
          ───────────────────────────────────────────────
          この画面の既存ブロック（ヒアリング・比較表・提案）は例外なく
          bg-paper-card / rounded-3xl lg:rounded-[30px] / border-ink-line / p-6
          の1枚カードに載っている。新5段だけ枠なしで背景に直接置くと、
          同じページの中で「ここだけ別のアプリ」に見える。
          v3 §7 の「既存合意の色、角丸24/30、余白を継承する」はこの意味なので、
          段ごとに5つのコンポーネントへ書き写すのではなく、
          段の入れ替わる場所を1枚のカードで包んで一箇所で持つ。
          中の rounded-2xl（16px）は既存カードの内側の小箱と同じ扱いで、
          外枠24/30・内側16という既存の入れ子をそのまま踏襲している。 */}
      <div className="ehc-stage-panel rounded-3xl lg:rounded-[30px] border border-ink-line bg-paper-card p-5 md:p-6">
      {stage === "find" && (
        <FindStage
          base={confirmed}
          matched={confirmedResult?.matched ?? []}
          needsCheck={confirmedResult?.needsCheck ?? []}
          onNext={() => go("equip")}
        />
      )}

      {stage === "equip" && (
        <section aria-labelledby="equip-heading" className="space-y-4">
          <header className="space-y-2">
            <h2 id="equip-heading" className="text-[20px] font-bold leading-[1.5] text-ink">
              お使いの空調を教えてください
            </h2>
            <p className="text-[16px] leading-[1.7] text-ink-soft">
              まずは1種類から。年式や機器が違うものは、あとで追加できます。
            </p>
          </header>

          <EquipInputStage state={state} onChange={setState} />

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => go("find")}
              className={cn(
                "min-h-[48px] w-full rounded-2xl border border-ink-line bg-paper-card px-4 text-[16px] font-bold leading-[1.7] text-ink",
                "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
              )}
            >
              候補を見るへ戻る
            </button>
            <button
              type="button"
              onClick={() => go("result")}
              className={cn(
                "min-h-[48px] w-full rounded-2xl bg-brand px-4 text-[16px] font-bold leading-[1.7] text-white",
                "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
              )}
            >
              結果と根拠へ進む
            </button>
          </div>
          {/* 進めないようにはしない。足りない入力があることは次の段が理由つきで出す。
              ここでボタンを無効にすると、何が足りないのか分からないまま行き止まりになる。 */}
          {/* 2026-09-25 UXレビュー No.13: 何も入力していないうちは出さない（始める前から失敗したように見えるため）。 */}
          {!projection.canCompute && hasAnyEquipInput(state) && (
            <p className="flex items-start gap-2 rounded-2xl border border-ink-line bg-paper-sub p-4 text-[14px] leading-[1.7] text-ink-soft">
              <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                いまの入力では金額の算定ができません。進んでいただくと、どの項目が足りないかを出します。
              </span>
            </p>
          )}
        </section>
      )}

      {stage === "result" && (
        <div className="space-y-4">
          <ResultStage
            input={input}
            result={result}
            projection={projection}
            onBack={() => go("equip")}
            /* 照合結果は素通しで渡す。ここで既定値を作らない。
               data が undefined なのは「まだ問い合わせていない」ときだけで、
               画面側はそれを未確認として表示する。 */
            targetProduct={targetProduct.data}
            targetProductError={targetProduct.error}
            investChoice={investChoice}
            onInvestSourceChange={setInvestSource}
            energy={energy}
            stage1Matched={confirmedResult?.matched ?? []}
          />
          <button
            type="button"
            onClick={() => go("estimate")}
            className={cn(
              "min-h-[48px] w-full rounded-2xl bg-brand px-4 text-[16px] font-bold leading-[1.7] text-white",
              "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
            )}
          >
            概算費用と工事へ進む
          </button>
        </div>
      )}

      {stage === "estimate" && (
        <EstimateStage
          input={input}
          projection={projection}
          customerBudgetYen={state.customerBudgetYen}
          desiredTiming={desiredTiming}
          groups={state.groups}
          onApplyInputs={(patches) => setState((previous) => ({ ...previous, groups: applyEstimateGroupPatches(previous.groups, patches) }))}
          onEditEquipment={() => go("equip")}
          onBack={() => go("result")}
          onNext={() => go("docs")}
          investChoice={investChoice}
          onInvestSourceChange={setInvestSource}
        />
      )}

      {reached.includes("docs") && <div hidden={stage !== "docs"}>
        <ContactStage
          input={input}
          projection={projection}
          /* 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）:
             C段（ResultStage）へ渡しているものと同じ照合結果をE段へも渡す。
             E段で matchSubsidies() を呼び直さないため。呼び直すと、
             同じ画面の中で結果の出どころが2つになる。 */
          result={result}
          customerBudgetYen={state.customerBudgetYen}
          desiredTiming={desiredTiming}
          onBack={() => go("estimate")}
        />
      </div>}
      </div>
    </section>
  );
}

/* ───────── A段「候補を見る」 ─────────
   ここは新しい判定を持たない。
   上のヒアリングで matchSubsidies() が出した候補の名前を並べ、
   次の段（設備を入力）へ渡すだけ。

   2026-09-25 UXレビュー No.5:
   以前は制度名が「候補の制度名を見る＋」の中に畳まれていて、7問に答えて
   一番知りたい「どの制度が使えそうか」が隠れていた。畳まずに出し、
   補助率・上限・受付状況も並べる。値は制度データ（lib/subsidies.ts）の文字そのままで、
   ここで計算や判定はしない。 */

function FindStage({
  base,
  matched,
  needsCheck,
  onNext,
}: {
  base: unknown;
  matched: Subsidy[];
  needsCheck: Subsidy[];
  onNext: () => void;
}) {

  if (!base) {
    return (
      <section aria-labelledby="find-heading" className="space-y-4">
        <header className="space-y-2">
          <h2 id="find-heading" className="text-[20px] font-bold leading-[1.5] text-ink">
            候補を見る
          </h2>
          <p className="text-[16px] leading-[1.7] text-ink-soft">
            7問にお答えいただくと、所在地・事業規模・建物用途から候補を確認できます。
          </p>
        </header>
        <p className="rounded-2xl border border-ink-line bg-paper-sub p-4 text-[14px] leading-[1.7] text-ink-soft">
          まずは上の「基本条件を確認・変更」から始めてください。名前やメールアドレスは不要です。
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="find-heading" className="space-y-4">
      <header className="space-y-2">
        <h2 id="find-heading" className="text-[20px] font-bold leading-[1.5] text-ink">
          候補を見る
        </h2>
        <p className="text-[16px] leading-[1.7] text-ink-soft">
          7問の答えから、使えそうな制度を探しました。次に空調の情報を加えると、補助額の目安と申請の時期まで確認できます。
        </p>
      </header>

      <p className="ehc-find-counts">
        <span>
          候補 <strong>{matched.length}</strong> 件
        </span>
        <span>
          条件の確認が必要 <strong>{needsCheck.length}</strong> 件
        </span>
      </p>

      {matched.length > 0 ? (
        <ul className="ehc-find-programs space-y-3" aria-label="候補に挙がっている制度">
          {matched.map((s) => (
            <li key={s.id} className="ehc-find-program rounded-2xl border border-ink-line bg-paper-card p-4">
              <p className="text-[16px] font-bold leading-[1.6] text-ink">{s.name}</p>
              <dl className="ehc-find-facts mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[14px] leading-[1.7] sm:grid-cols-3">
                <div className="flex gap-2 sm:block">
                  <dt className="shrink-0 text-ink-soft">補助率</dt>
                  <dd className="font-bold text-ink">{s.rate}</dd>
                </div>
                <div className="flex gap-2 sm:block">
                  <dt className="shrink-0 text-ink-soft">上限</dt>
                  <dd className="font-bold text-ink">{s.max}</dd>
                </div>
                <div className="flex gap-2 sm:block">
                  <dt className="shrink-0 text-ink-soft">受付</dt>
                  <dd className="font-bold text-ink">{receptionLabel(s)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-ink-line bg-paper-sub p-4 text-[14px] leading-[1.7] text-ink-soft">
          現時点で確定した候補はありません。設備の内容や不足している条件を確認すると、候補になる制度があります。
        </p>
      )}

      {needsCheck.length > 0 && (
        <details className="ehc-find-needs rounded-2xl border border-ink-line bg-paper-sub px-4">
          <summary className="min-h-[48px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink">
            条件の確認が必要な制度（{needsCheck.length}件）
          </summary>
          <p className="text-[14px] leading-[1.7] text-ink-soft">
            対象外と決まったわけではありません。設備の情報や条件を確かめると、判定が進みます。
          </p>
          <ul className="mt-2 space-y-1 pb-4">
            {needsCheck.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-[14px] leading-[1.7] text-ink">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-soft" />
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[14px] leading-[1.7] text-ink-soft">
        候補に挙がっていることは、採択・受給を保証するものではありません。
      </p>

      <GlossaryDetails />

      <details className="ehc-next-details"><summary>このあと確認できること</summary>
      <ol className="ehc-next-overview grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="このあと確認できること">
        {DIAGNOSIS_STAGES.slice(1).map((s, i) => (
          <li
            key={s.id}
            className="rounded-2xl border border-ink-line bg-paper-sub px-3 py-2 text-[14px] leading-[1.7] text-ink-soft"
          >
            <span className="font-bold text-ink">{i + 2}.</span> {s.label}
          </li>
        ))}
      </ol>
      </details>

      <button
        type="button"
        onClick={onNext}
        className={cn(
          "min-h-[48px] w-full rounded-2xl bg-brand px-4 text-[16px] font-bold leading-[1.7] text-white",
          "flex items-center justify-center gap-2",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
        )}
      >
        設備を入力へ進む
        <ArrowRight aria-hidden className="h-5 w-5 shrink-0" />
      </button>
    </section>
  );
}

/* 受付状況の短い表示。制度データの status と日付をそのまま言い換えるだけで、判定はしない。
   年が今年と違うときだけ年を付ける（2027年1月の回を「1月18日」と書かない）。 */
function jpDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return y === new Date().getFullYear() ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

function receptionLabel(s: Subsidy): string {
  if (s.status === "open") return s.applyClose ? `受付中（${jpDate(s.applyClose)}まで）` : "受付中";
  if (s.status === "upcoming") return s.applyOpen ? `受付予定（${jpDate(s.applyOpen)}から）` : "受付予定";
  if (s.status === "closed") return "受付終了";
  return "受付時期は公式発表待ち";
}

/* 2026-09-25 UXレビュー No.13: 設備の入力が1つでも始まっているか。
   未入力の注意は、入力が始まってから出す。 */
function hasAnyEquipInput(state: DiagnosisState): boolean {
  return state.groups.some(
    (g) => g.kind !== null || g.units !== null || g.installYear !== null || g.hp !== null
  );
}
