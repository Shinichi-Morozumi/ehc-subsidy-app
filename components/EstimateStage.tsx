"use client";

import { AlertCircle, CheckCircle2, ChevronDown, ClipboardList, FileText, HelpCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiagnosisEquipGroup } from "@/lib/diagnosisState";
import { EstimateInputAssist } from "./EstimateInputAssist";
import type { EstimateGroupPatch } from "./estimateInputFields";
import type { DesiredTiming, EquipGroup, MatchInput } from "@/lib/types";
import {
  CONSUMPTION_TAX_RATE,
  DEFAULT_KG_PER_UNIT,
  PRICING_EXCLUDED_ITEMS,
  PRICING_SOURCE_PUBLIC,
  PRICING_SOURCE_PUBLIC_ASOF,
  SITE_ACCESS,
  estimateUpdateBreakdownGroups,
  yenJP,
} from "@/lib/pricing";
import { buildConstructionTimeline } from "@/lib/timeline";
import { pricedGroupsOf } from "@/lib/diagnosisSnapshot";
import type { InvestChoice, InvestSource } from "@/lib/amountBasis";
import { InvestBasisChooser } from "./InvestBasisChooser";
import {
  UNRESOLVED_REASON_LABEL,
  UNRESOLVED_REASON_NOTE,
  type EquipProjection,
} from "@/lib/diagnosisProjection";

/* ───────────────────────────────────────────────────────────
   概算費用と工事の流れ（EHC-0039 第7片 / 2026-09-14 v1）
   段ナビでいう 4 / 5。

   ■ この画面がやること
   　　(1) 入力された設備のうち、金額を出せるものだけで概算見積を組む
   　　(2) 出せなかったものを、理由付きでそのまま残す（消さない・0円にしない）
   　　(3) その金額が何を含み、何を含まないかを、金額と同じ画面に置く
   　　(4) 工事の流れを4段で示す

   ■ この画面が持たないもの
   　　金額の式は1本も書かない。lib/pricing.ts の
   　　estimateUpdateBreakdownGroups() が唯一の見積エンジンで、
   　　ここはその戻り値を並べるだけにする。
   　　「更新工事 見積シミュレーター」と「案件情報の設備投資概算」も同じ関数を
   　　通っているので、同じ入力なら3画面で必ず同じ金額になる。
   　　工程の日数も lib/timeline.ts の buildConstructionTimeline() から取る。

   ■ 馬力（hp）が無い群を、なぜ金額から外すか
   　　estimateMachineCost(0) は ¥250,000 を返す。0馬力で0円にはならない。
   　　つまり馬力未入力の群をそのままエンジンへ渡すと、
   　　誰も答えていない設備に台数×25万円が付いて合計に混ざる。
   　　混ざったが最後、画面上はただの「概算費用」で、
   　　どこが入力由来でどこがこちらの仮定なのか相手には見えない。
   　　だから渡す前に外し、外したことを画面に残す。

   ■ ルームエアコンの単価を作らないこと
   　　参照している実績は業務用の更新工事のものであり、
   　　ルームエアコンの単価はこの母集団に無い。
   　　無いものを「業務用の8掛け」などで作ると、
   　　出どころの無い数字が見積書の形で相手に渡る。
   　　ルームエアコンは金額を出さず「現地確認のうえお見積り」とする。
   ─────────────────────────────────────────────────────────── */

/* 設備の種類を、相手が使う言葉で出す。EquipType は "ac" | "multi" の2値。 */
const EQUIP_LABEL: Record<EquipGroup["equip"], string> = {
  ac: "業務用パッケージ",
  multi: "ビル用マルチ",
};

const TIMING_LABEL: Record<DesiredTiming, string> = {
  within_1m: "1か月以内",
  within_3m: "3か月以内",
  within_6m: "6か月以内",
  within_12m: "1年以内",
  undecided: "まだ決めていない",
};

export interface EstimateStageProps {
  /** projection.canCompute が false のときは null。null を「0円」と読まないこと */
  input: MatchInput | null;
  projection: EquipProjection;
  /** 想定予算（円）。未回答は null。この値は概算金額へ一切代入しない */
  customerBudgetYen: number | null;
  /** 希望時期。未回答は null。確定工期として扱わない */
  desiredTiming: DesiredTiming | null;
  /** 「結果と根拠」へ戻す */
  onBack?: () => void;
  /** 「診断書を受け取って相談」へ進む */
  onNext?: () => void;
  groups: DiagnosisEquipGroup[];
  onApplyInputs: (patches: EstimateGroupPatch[]) => void;
  onEditEquipment: () => void;
  /** 2026-09-25 UXレビュー No.2: 補助額の計算に使う金額（C段と同じ値）。lib/amountBasis.ts */
  investChoice?: InvestChoice;
  onInvestSourceChange?: (source: InvestSource) => void;
}

export function EstimateStage({
  input,
  projection,
  customerBudgetYen,
  desiredTiming,
  onBack,
  onNext,
  groups,
  onApplyInputs,
  onEditEquipment,
  investChoice,
  onInvestSourceChange,
}: EstimateStageProps) {
  return (
    <section aria-labelledby="estimate-heading" className="ehc-estimate-stage space-y-6">
      <header className="space-y-2">
        <h2 id="estimate-heading" className="text-[20px] font-bold leading-[1.5] text-ink">
          工事費用を確認する
        </h2>
        <p className="text-[16px] leading-[1.7] text-ink-soft">
          分かる設備だけで概算します。正式な見積は現地確認後です。
        </p>
      </header>

      <EstimateInputAssist groups={groups} projection={projection} onApply={onApplyInputs} onEditEquipment={onEditEquipment} onConsult={onNext} />

      {input && projection.canCompute ? (
        <Estimated
          input={input}
          projection={projection}
          customerBudgetYen={customerBudgetYen}
          desiredTiming={desiredTiming}
          investChoice={investChoice}
          onInvestSourceChange={onInvestSourceChange}
        />
      ) : (
        <NotEstimated projection={projection} />
      )}

      <StageFooter onBack={onBack} onNext={onNext} />
    </section>
  );
}

/* ───────── 計算していないとき ─────────
   「¥0」や「—」の並んだ見積書の枠を先に出さない。
   枠があること自体が「算定は済んでいて、中身が0だった」という読み方を招く。 */

function NotEstimated({ projection }: { projection: EquipProjection }) {
  const reasons = Array.from(new Set(projection.unresolvedGroups.flatMap((u) => u.reasons)));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/45 bg-amber-50 p-4">
        <p className="flex items-start gap-2 text-[16px] font-bold leading-[1.7] text-amber-800">
          <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <span>まだ概算を出していません</span>
        </p>
      </div>

      {reasons.length > 0 && (
        <details className="rounded-2xl border border-ink-line bg-paper-card p-4">
          <summary className="min-h-[48px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink">未算定の理由を確認する</summary>
          <ul className="mt-3 divide-y divide-ink-line">
            {reasons.map((r) => (
              <li key={r} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[16px] font-bold leading-[1.7] text-ink">
                  {UNRESOLVED_REASON_LABEL[r]}
                </p>
                <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">
                  {UNRESOLVED_REASON_NOTE[r]}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 金額が出せなくても工事の流れは出せる。ここで白紙にすると
          「まだ何も分からない画面」になり、戻る理由も伝わらない。 */}
      <ConstructionFlow workDays={null} units={null} />
    </div>
  );
}

/* ───────── 概算を出したとき ───────── */

function Estimated({
  input,
  projection,
  customerBudgetYen,
  desiredTiming,
  investChoice,
  onInvestSourceChange,
}: {
  input: MatchInput;
  projection: EquipProjection;
  customerBudgetYen: number | null;
  desiredTiming: DesiredTiming | null;
  investChoice?: InvestChoice;
  onInvestSourceChange?: (source: InvestSource) => void;
}) {
  /* 金額を出せる群＝種類・台数・設置年が揃っていて（projection が保証済み）、
     さらに馬力が入っている群。馬力が無い群は冒頭のコメントのとおり外す。

     2026-09-16 EHC-0039: 判定は lib/diagnosisSnapshot.ts の pricedGroupsOf() に一本化する。
     ここで同じ条件を書き写していたため、hp>0 だけを見ていて units>0 を見ておらず、
     台数0の群があると診断書は workDays=null、画面は 1日 になり得た（定義の二重化）。 */
  const priced = pricedGroupsOf(input.equipGroups);
  const hpMissing = input.equipGroups.filter((g) => !priced.includes(g));

  const groupInput = priced.map((g) => ({ units: g.units, hp: g.hp as number }));
  const hasPriced = groupInput.length > 0;

  /* 見積エンジンは1回だけ通す。幅（コストクラス）も同じ関数で出し、
     ここで 0.85 倍・1.25 倍を掛け直さない。掛け直すと丸めの位置が変わって
     「幅の下限＞標準」のような逆転が起きうる。 */
  const est = hasPriced ? estimateUpdateBreakdownGroups(groupInput) : null;
  const low = hasPriced ? estimateUpdateBreakdownGroups(groupInput, { costClass: "value" }) : null;
  const high = hasPriced
    ? estimateUpdateBreakdownGroups(groupInput, { costClass: "premium" })
    : null;

  /* 工程の日数。ドロップイン（冷媒入替のみ）の日数計算に落ちないよう
     dropinOnly を明示する。この段で出しているのは機器入替の概算なので、
     日数も機器入替のものでなければ、金額と工程が別の工事の話になる。

     渡すのは priced（馬力が入っていて金額を出した群）だけ。input 全体を渡すと、
     馬力が無くて金額を出していない群の台数まで日数に入り、
     診断書（lib/diagnosisSnapshot.ts の workDays。priced のみで計算）と割れる。
     実測: 業務用パッケージ6台・馬力未入力で、画面は「実働 約3日」、
     PDFは「金額を算定した設備がないため、日数の目安を出していません。」になっていた。 */
  const plan = hasPriced
    ? buildConstructionTimeline({ ...input, equipGroups: priced }, { dropinOnly: false })
    : null;

  /* 結果の段が使っている設備投資額と、この概算の税抜小計が違う場合は黙らない。
     同じ画面の中で2つの金額が並ぶこと自体は避けられない（片方は申告値）が、
     違っていることを言わないと、相手はどちらかを根拠にしてしまう。 */
  const investYen = Math.round((input.invest ?? 0) * 10000);
  const mismatch =
    est != null && investYen > 0 && Math.abs(investYen - est.subtotal) >= 10000
      ? { investYen, subtotal: est.subtotal }
      : null;

  return (
    <div className="space-y-5">
      {est && low && high ? (
        <>
          <TotalCard est={est} low={low} high={high} />
          {/* 2026-09-25 UXレビュー No.2: 「一致していません」と注意するだけでなく、
              どちらで計算するかをここで選べるようにする（C段と同じ選択。どちらで選んでも両段に反映）。 */}
          {investChoice && onInvestSourceChange ? (
            <InvestBasisChooser choice={investChoice} onChange={onInvestSourceChange} idPrefix="estimate" />
          ) : (
            mismatch && <InvestMismatch {...mismatch} />
          )}
        </>
      ) : (
        <p className="text-[16px] font-bold leading-[1.7] text-amber-800">概算金額は未算定です。</p>
      )}

      {hasPriced ? <NotPriced hpMissing={hpMissing} projection={projection} /> : (
        <details className="rounded-2xl border border-ink-line px-4">
          <summary className="min-h-[56px] cursor-pointer py-4 text-[16px] font-bold leading-[1.7] text-ink">未算定の設備と理由を見る</summary>
          <NotPriced hpMissing={hpMissing} projection={projection} />
        </details>
      )}

      {est && low && high && (
        <>
          <div className="space-y-3">
            <EstimateLines est={est} priced={priced} />
            <Assumptions est={est} />
            <ExcludedCosts />
          </div>
        </>
      )}

      <CustomerWishes customerBudgetYen={customerBudgetYen} desiredTiming={desiredTiming} />

      <ConstructionFlow workDays={plan?.workDays ?? null} units={plan?.units ?? null} />
    </div>
  );
}

/* ───────── 合計 ───────── */

type Breakdown = ReturnType<typeof estimateUpdateBreakdownGroups>;

function TotalCard({ est, low, high }: { est: Breakdown; low: Breakdown; high: Breakdown }) {
  return (
    <div className="ehc-estimate-total rounded-2xl border border-brand/35 bg-[#edf6e8] p-5 sm:p-6">
      <p className="text-[14px] font-bold leading-[1.7] text-brand-deep">概算合計（税込）</p>
      <p className="mt-2 break-words text-[24px] font-bold leading-[1.3] tabular-nums text-brand-deep">{yenJP(est.total)}</p>
      <p className="mt-3 text-[14px] leading-[1.7] text-brand-deep">
        機種のグレードにより {yenJP(low.total)} 〜 {yenJP(high.total)} の幅があります
      </p>
      <p className="mt-3 text-[14px] leading-[1.7] text-ink">補助金を差し引く前の金額です。足場・追加工事などは別途、現地確認で変わります。</p>
    </div>
  );
}

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-card px-3 py-3">
      <dt className="text-[14px] leading-[1.7] text-ink-soft">{label}</dt>
      <dd className="text-[16px] font-bold leading-[1.7] text-ink">{value}</dd>
    </div>
  );
}

/* ───────── 明細 ───────── */

function EstimateLines({ est, priced }: { est: Breakdown; priced: EquipGroup[] }) {
  const taxPct = Math.round(est.taxRate * 100);
  return (
    <details className="group rounded-2xl border border-ink-line bg-paper-card">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">内訳と設備明細<span className="ml-2 text-[14px] font-normal text-ink-soft">{est.lines.length} 行</span></span>
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-ink-line px-4 pb-4 pt-3">
        <dl className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Amount label="機器費（税抜）" value={yenJP(est.machine)} />
          <Amount label="工事費・諸経費（税抜）" value={yenJP(est.work)} />
          <Amount label={`消費税（${taxPct}%）`} value={yenJP(est.tax)} />
        </dl>
        <p className="mb-4 text-[14px] leading-[1.7] text-ink-soft">
          総工事費（税込）と補助の算定基礎は別です。補助額の基礎は税抜小計 {yenJP(est.subtotal)} で、消費税は含みません。制度ごとに対象外の費目があるため、実際の補助対象経費は小さくなる場合があります。
        </p>
        <p className="text-[14px] leading-[1.7] text-ink-soft">
          金額を算定した設備は {priced.length} 群・室内機 {est.units} 台です。
          機器費は設備群ごとに、工事費は現場に1回だけ計上しています
          （複数の群でも、同じ現場の撤去・搬入・諸経費を重ねて数えません）。
        </p>

        <ul className="mt-3 space-y-2">
          {priced.map((g) => (
            <li
              key={g.id}
              className="rounded-2xl border border-ink-line bg-paper-sub px-3 py-2 text-[14px] leading-[1.7] text-ink"
            >
              {EQUIP_LABEL[g.equip]}／{g.hp}馬力／室内機 {g.units} 台／{g.installYear} 年設置
            </li>
          ))}
        </ul>

        {/* 2026-09-14 EHC-0039 §7「320px幅でも横スクロールを生じさせない」への対応
            ───────────────────────────────────────────────────────────
            もとは table に min-w-[320px] を付け、親を overflow-x-auto にしていた。
            320px の画面ではカードの余白を引くと明細の置ける幅が 212px しかなく、
            表(320px)が箱(212px)からはみ出して、表だけが横に滑る状態だった。
            画面全体は横に動かないので気づきにくいが、
            「金額」の列が指で押し出さないと読めない＝金額が初期状態で見えない。

            列を詰めて字を小さくする逃げ方は取らない（§7「スマホで小さい文字へ縮めない」）。
            640px 未満では 1行=1ブロックに積み、
              1行目 項目 / 2行目 数量・単価 / 3行目 金額（右寄せ・太字）
            とする。640px 以上は今までどおりの3列の表。
            列見出しは積んだときには意味を持たないので narrow では隠す
            （各値の前後関係で読める。金額だけは太字＋右寄せで区別する）。
            table 要素のままなので、支援技術から見た表構造・読み上げ順は変わらない。 */}
        <div className="mt-4">
          <table className="w-full border-collapse text-left">
            <thead className="hidden sm:table-header-group">
              <tr className="border-b border-ink-line">
                <th scope="col" className="py-2 pr-2 text-[14px] font-bold text-ink-soft">
                  項目
                </th>
                <th scope="col" className="py-2 pr-2 text-[14px] font-bold text-ink-soft">
                  数量・単価
                </th>
                <th scope="col" className="py-2 text-right text-[14px] font-bold text-ink-soft">
                  金額
                </th>
              </tr>
            </thead>
            <tbody>
              {est.lines.map((l, i) => (
                <tr
                  key={`${l.label}-${i}`}
                  className="block border-b border-ink-line/60 py-2 sm:table-row sm:py-0"
                >
                  <td className="block text-[14px] font-bold leading-[1.7] text-ink sm:table-cell sm:py-2 sm:pr-2 sm:align-top sm:font-normal">
                    {l.label}
                  </td>
                  <td className="block text-[14px] leading-[1.7] text-ink-soft sm:table-cell sm:py-2 sm:pr-2 sm:align-top">
                    {l.detail}
                  </td>
                  <td className="block text-right text-[14px] font-bold leading-[1.7] text-ink sm:table-cell sm:py-2 sm:align-top sm:font-normal">
                    {yenJP(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="block border-b border-ink-line py-2 sm:table-row sm:py-0">
                <td
                  colSpan={2}
                  className="block text-[14px] font-bold leading-[1.7] text-ink sm:table-cell sm:py-2 sm:pr-2"
                >
                  小計（税抜）
                </td>
                <td className="block text-right text-[14px] font-bold leading-[1.7] text-ink sm:table-cell sm:py-2">
                  {yenJP(est.subtotal)}
                </td>
              </tr>
              <tr className="block border-b border-ink-line py-2 sm:table-row sm:py-0">
                <td
                  colSpan={2}
                  className="block text-[14px] leading-[1.7] text-ink-soft sm:table-cell sm:py-2 sm:pr-2"
                >
                  消費税（{taxPct}%）
                </td>
                <td className="block text-right text-[14px] leading-[1.7] text-ink-soft sm:table-cell sm:py-2">
                  {yenJP(est.tax)}
                </td>
              </tr>
              <tr className="block py-2 sm:table-row sm:py-0">
                <td
                  colSpan={2}
                  className="block text-[16px] font-bold leading-[1.7] text-ink sm:table-cell sm:py-2 sm:pr-2"
                >
                  合計（税込）
                </td>
                <td className="block text-right text-[16px] font-bold leading-[1.7] text-ink sm:table-cell sm:py-2">
                  {yenJP(est.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </details>
  );
}

/* ───────── こちらが置いた仮定 ─────────
   聞いていない項目を、聞いたことにしない。
   下の4つは入力された値ではなく、この画面が置いた既定値である。 */

function Assumptions({ est }: { est: Breakdown }) {
  const rows: { label: string; value: string; why: string }[] = [
    {
      label: "系統数（室外機の数）",
      value: `${est.systems} 系統`,
      why: "室内機2台で1系統として置いています。実際の系統数は伺っていません。フロンガス回収の費用がこの数で変わります。",
    },
    {
      label: "回収するフロンの量",
      value: `${est.kg} kg`,
      why: `室内機1台あたり ${DEFAULT_KG_PER_UNIT}kg として置いています。銘板の充填量が分かれば置き換えます。`,
    },
    {
      label: "機器のグレード",
      value: "標準",
      why: "補助制度の高効率要件を満たす上位機は価格が上がります。どの機種にするかは現地確認のうえご相談です。",
    },
    {
      label: "高所作業車",
      value: "0 日（費用に含めていません）",
      why: `必要な場合は ¥${SITE_ACCESS.aerialLiftPerDay.toLocaleString("ja-JP")}/日 が別途かかります。要否は設置場所を見てから判断します。`,
    },
    {
      label: "足場",
      value: "未確認",
      why: "設置階を伺っていないため、要否を判定していません。必要な場合の費用は現地確認後のお見積りになります。",
    },
  ];

  return (
    <details className="group rounded-2xl border border-ink-line bg-paper-card">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2"><HelpCircle aria-hidden className="h-5 w-5 shrink-0 text-ink-soft" />概算の前提・単価の根拠</span>
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-ink-line px-4 pb-4 pt-3">
        <p className="text-[14px] leading-[1.7] text-ink-soft">
          下の項目は伺っていないため、こちらで置いています。入力された値ではありません。
        </p>
        <dl className="mt-3 divide-y divide-ink-line">
          {rows.map((r) => (
            <div key={r.label} className="py-3 first:pt-0 last:pb-0">
              <dt className="text-[14px] font-bold leading-[1.7] text-ink">
                {r.label}：{r.value}
              </dt>
              <dd className="text-[14px] leading-[1.7] text-ink-soft">{r.why}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-ink-line pt-4 text-[14px] leading-[1.7] text-ink-soft">
          参照: {PRICING_SOURCE_PUBLIC}（{PRICING_SOURCE_PUBLIC_ASOF}）。
          馬力別の機器単価と、撤去・据付・配管・電気の各単価は、この明細の中央値を使っています。
        </p>
      </div>
    </details>
  );
}

function ExcludedCosts() {
  return (
    <details className="rounded-2xl border border-ink-line bg-paper-sub px-4">
      <summary className="min-h-[56px] cursor-pointer py-4 text-[16px] font-bold leading-[1.7] text-ink">別途かかる費用を確認する</summary>
      <ul className="mb-4 grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
        {PRICING_EXCLUDED_ITEMS.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[14px] leading-[1.7] text-ink-soft">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-line" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function InvestMismatch({ investYen, subtotal }: { investYen: number; subtotal: number }) {
  return (
    <div className="rounded-2xl border border-amber-500/45 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-[16px] font-bold leading-[1.7] text-amber-800">
        <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <span>前の段の設備投資額と、この概算が一致していません</span>
      </p>
      <p className="mt-2 text-[14px] leading-[1.7] text-amber-800">
        「結果と根拠」の段で補助額の算定に使っている設備投資額は {yenJP(investYen)}、
        この段の概算（税抜小計）は {yenJP(subtotal)} です。
        別の見積を入力されている場合はそれが優先されます。どちらを根拠にするかはご相談のうえ揃えます。
      </p>
    </div>
  );
}

/* ───────── 金額を出していない設備 ─────────
   一覧から消さない。0円にもしない。
   消すと「その設備は無いことになった」、0円にすると「ただで直る」と読まれる。 */

function NotPriced({
  hpMissing,
  projection,
}: {
  hpMissing: EquipGroup[];
  projection: EquipProjection;
}) {
  const unresolved = projection.unresolvedGroups;
  const reasons = Array.from(new Set(unresolved.flatMap((u) => u.reasons)));
  if (hpMissing.length === 0 && unresolved.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink-line bg-paper-card p-4">
      <h3 className="text-[16px] font-bold leading-[1.7] text-ink">
        金額を出していない設備（{hpMissing.length + unresolved.length} 件）
      </h3>
      <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">
        対象外と決まったわけではありません。上の概算には、下の設備の機器費も工事費も入っていません。
      </p>

      <ul className="mt-3 space-y-2">
        {hpMissing.map((g) => (
          <li key={g.id} className="rounded-2xl border border-ink-line bg-paper-sub px-3 py-2">
            <p className="text-[14px] font-bold leading-[1.7] text-ink">
              {EQUIP_LABEL[g.equip]}／室内機 {g.units} 台／{g.installYear} 年設置
              　<span className="font-normal text-ink-soft">— 未算定</span>
            </p>
            {/* 2026-09-16 EHC-0039: 未算定の理由は実際の欠けに合わせる。
                pricedGroupsOf() は hp>0 かつ units>0 を見るので、
                ここへは「馬力が無い群」と「台数が0の群」の両方が来る。
                台数0に「馬力が未入力です」と書くと、直す場所を間違えさせる。 */}
            <p className="text-[14px] leading-[1.7] text-ink-soft">
              {!(typeof g.hp === "number" && g.hp > 0)
                ? "馬力が未入力です。入力すると概算できます。"
                : "室内機の台数が 0 台です。台数を入れると算定します。"}
            </p>
          </li>
        ))}

        {unresolved.map((u) => (
          <li key={u.group.id} className="rounded-2xl border border-ink-line bg-paper-sub px-3 py-2">
            <p className="text-[14px] font-bold leading-[1.7] text-ink">
              {u.group.units != null ? `室内機 ${u.group.units} 台` : "台数未入力の設備"}
              　<span className="font-normal text-ink-soft">— 未算定</span>
            </p>
            {u.reasons.map((r) => (
              <p key={r} className="text-[14px] leading-[1.7] text-ink-soft">
                {UNRESOLVED_REASON_LABEL[r]}
              </p>
            ))}
          </li>
        ))}
      </ul>

      {reasons.length > 0 && (
        <details className="group mt-3 border-t border-ink-line">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[14px] font-bold leading-[1.7] text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep [&::-webkit-details-marker]:hidden">
            未算定の理由を詳しく見る
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="space-y-3 pb-2">
            {reasons.map((r) => (
              <div key={r}>
                <dt className="text-[14px] font-bold leading-[1.7] text-ink">{UNRESOLVED_REASON_LABEL[r]}</dt>
                <dd className="mt-1 text-[14px] leading-[1.7] text-ink-soft">{UNRESOLVED_REASON_NOTE[r]}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {/* 2026-09-14 EHC-0039 統合検証で見つけた不具合の修正
          ─────────────────────────────────────────
          この一文は、以前は無条件で出していた。
          そのため「馬力が未入力」だけ、あるいは「種類が分からない」だけの場合にも
          ルームエアコンの話が出てしまい、入れていない設備の説明が紙面に残った。
          実測（3群 → ルームを削除し、残り1群を「分からない」にした状態）で
          ルームが1台も無いのに本文が出ることを確認したので、
          room_not_covered が実際に立っている群があるときだけ出す。 */}
      {unresolved.some((u) => u.reasons.includes("room_not_covered")) && (
        <p className="mt-3 text-[14px] leading-[1.7] text-ink-soft">
          ルームエアコンは、参照している業務用の施工実績に単価がありません。
          業務用の単価を流用すると出どころの無い金額になるため、現地確認のうえ別途お見積りします。
        </p>
      )}
    </div>
  );
}

/* ───────── ご希望条件 ─────────
   予算と希望時期は「相手が出せる額・動きたい時期」であって、
   「工事にかかる額・かかる期間」ではない。
   同じ枠に入れると、予算を低く答えた人ほど工事が安く見える画面になる。
   だから概算とは別の枠に、金額へ代入せずに置く。 */

function CustomerWishes({
  customerBudgetYen,
  desiredTiming,
}: {
  customerBudgetYen: number | null;
  desiredTiming: DesiredTiming | null;
}) {
  if (customerBudgetYen == null && desiredTiming == null) return null;

  return (
    <details className="rounded-2xl border border-ink-line bg-paper-sub px-4">
      <summary className="min-h-[56px] cursor-pointer py-4 text-[16px] font-bold leading-[1.7] text-ink">
        希望時期・予算を確認する
      </summary>
      <p className="text-[14px] leading-[1.7] text-ink-soft">ご希望は概算金額・確定工期ではありません。</p>
      <dl className="my-3 space-y-1">
        {customerBudgetYen != null && (
          <div className="text-[14px] leading-[1.7] text-ink-soft">
            <dt className="inline font-bold text-ink">ご予算：</dt>
            <dd className="inline">
              {yenJP(customerBudgetYen)}
              　概算金額の代わりには使いません。ご予算に収める組み方（台数を分ける・年度をまたぐ）をご提案する材料にします。
            </dd>
          </div>
        )}
        {desiredTiming != null && (
          <div className="text-[14px] leading-[1.7] text-ink-soft">
            <dt className="inline font-bold text-ink">ご希望の時期：</dt>
            <dd className="inline">
              {TIMING_LABEL[desiredTiming]}
              　ご希望であって、確定した工期ではありません。実際の日程は現地確認と機器の納期で決まります。
            </dd>
          </div>
        )}
      </dl>
    </details>
  );
}

/* ───────── 工事の流れ（4段） ─────────
   ■ 総工期を書かない理由
   　　実働日数は「パッケージ1日2台・ビル用マルチ1日1台」で足した目安である。
   　　現場は1つなので、群ごとの日数を足したものは連続した稼働日数ではなく、
   　　搬入計画・停止できる時間帯・機器の納期で前後に伸びる。
   　　足し算の結果を「総工期◯日」と書くと、こちらが約束していない日程が
   　　相手の工程表に載る。だから実働の目安としてだけ出す。

   ■ 交付決定前の発注について
   　　「交付決定前に発注すると対象外」は多くの制度で共通だが、全制度ではない。
   　　ここで一律に断定すると、その縛りの無い制度を使う案件まで
   　　数か月待たせることになる。どの制度がそれに当たるかは
   　　lib/eligibility.ts / lib/prep.ts が持っているので、
   　　この画面は「使う制度によって変わる。着工前に必ず確認する」とだけ言う。 */

function ConstructionFlow({ workDays, units }: { workDays: number | null; units: number | null }) {
  const steps = [
    {
      icon: ClipboardList,
      title: "現地確認・計画",
      lines: [
        "設置場所・搬入経路・電源容量・設置階を見て、概算を実費へ落とします。",
        "銘板で機種・馬力・冷媒・充填量を確認します。この段でお出しした仮定はここで置き換わります。",
      ],
    },
    {
      icon: FileText,
      title: "制度の手続き・着工条件の確認",
      lines: [
        "候補制度の受付状況と必要書類を確認し、申請します。",
        "制度によっては、交付決定より前に発注・契約・着工すると対象外になります。該当するかは制度ごとに違うため、③へ進む前に必ず確認します。",
      ],
    },
    {
      icon: Wrench,
      title: "機器の手配と更新工事",
      lines: [
        "機器の納期：機種と時期で変わります。現地確認で機種が決まった時点でお知らせします。",
        workDays != null && units != null && units > 0
          ? `現地での施工日数：実働 約${workDays}日が目安です（室内機${units}台）。連続した日数とは限らず、総工期ではありません。`
          : "現地での施工日数：設備が決まってから算出します。",
        "空調が止まる時間：系統ごとに切り替えるため、建物全体を止める必要はありません。止まるのは施工中の系統だけです。何時間止まるかは機器構成で変わるため、現地確認で確定します。",
      ],
    },
    {
      icon: CheckCircle2,
      title: "試運転・引渡し・必要な報告",
      lines: [
        "試運転で能力を確認し、取扱説明のうえお引渡しします。",
        "補助金を使った場合は、請求書・施工写真・計測データなどの実績報告が必要です。作成はこちらで行います。",
      ],
    },
  ];

  return (
    <section aria-labelledby="construction-flow-heading" className="ehc-construction-flow border-t border-ink-line pt-6">
      <h3 id="construction-flow-heading" className="text-[20px] font-bold leading-[1.5] text-ink">工事を進める前に</h3>
      <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
        補助制度によっては、交付決定前の発注・契約・着工が対象外になります。先に制度の条件を確認しましょう。
      </p>
      <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
        {workDays != null && units != null && units > 0
          ? `施工の目安：実働 約${workDays}日（算定対象の室内機${units}台）。総工期ではなく、日程は現地確認後です。`
          : "工期は設備と現地を確認してからご案内します。"}
      </p>
      <details className="mt-3 rounded-2xl border border-ink-line px-4">
      <summary className="min-h-[56px] cursor-pointer py-4 text-[16px] font-bold leading-[1.7] text-ink">相談から工事までの4ステップを見る</summary>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const visibleCount = i === 1 || i === 2 ? 2 : 1;
          const detailLines = s.lines.slice(visibleCount);
          return (
            <li
              key={s.title}
              className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-3"
            >
              {i < steps.length - 1 && <span aria-hidden className="absolute -bottom-3 left-4 top-8 w-px bg-ink-line" />}
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-paper-tint text-[14px] font-bold text-brand-deep">{i + 1}</span>
              <div className="min-w-0 rounded-2xl border border-ink-line bg-paper-sub p-4">
                <h4 className="flex items-start gap-2 text-[16px] font-bold leading-[1.7] text-ink">
                  <Icon aria-hidden className="mt-1 h-4 w-4 shrink-0 text-brand" />
                  <span>{s.title}</span>
                </h4>
                <ul className="mt-2 space-y-2">
                  {s.lines.slice(0, visibleCount).map((line) => (
                    <li key={line} className="text-[14px] leading-[1.7] text-ink-soft">
                      {line}
                    </li>
                  ))}
                </ul>
                {detailLines.length > 0 && (
                  <details className="group mt-2">
                    <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 py-2 text-[14px] font-bold leading-[1.7] text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep [&::-webkit-details-marker]:hidden">
                      この工程を詳しく見る
                      <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="space-y-2 border-t border-ink-line pt-3">
                      {detailLines.map((line) => (
                        <li key={line} className="text-[14px] leading-[1.7] text-ink-soft">{line}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      </details>
    </section>
  );
}

/* ───────── 前後の導線 ───────── */

function StageFooter({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  if (!onBack && !onNext) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-ink-line pt-5 sm:flex-row">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "min-h-[48px] w-full rounded-2xl border border-ink-line bg-paper-card px-4 text-[16px] font-bold leading-[1.7] text-ink",
            "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          )}
        >
          結果と根拠へ戻る
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className={cn(
            "min-h-[48px] w-full rounded-2xl bg-brand px-4 text-[16px] font-bold leading-[1.7] text-white",
            "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          )}
        >
          診断書を受け取って相談する
        </button>
      )}
    </div>
  );
}

/* 未使用にならないよう、消費税率の出どころをここで明示しておく。
   画面に出している「消費税（10%）」は est.taxRate（既定＝CONSUMPTION_TAX_RATE）から
   作っており、この定数を画面側で書き直してはいない。 */
export const ESTIMATE_STAGE_TAX_RATE = CONSUMPTION_TAX_RATE;
