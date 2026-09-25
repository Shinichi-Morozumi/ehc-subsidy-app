"use client";

/* ───────────────────────────────────────────────────────────
   削減率の根拠（設備群ごと）
   EHC-0039 v2 §4 作業3 / 台帳 #31 / 2026-09-16 v1

   出す内容は lib/reductionBasisView.ts が組み立てたものだけ。
   ここで率を計算したり、比較できるかを判定したりしない。

   §7のUI規律:
   　・本文 16px（text-base）／根拠 14px（text-sm）以上
   　・押す場所は48px以上（summary に min-h-[48px]）
   　・フォーカスは2pxのアウトライン
   　・角丸は 24px（rounded-2xl）
   　・色だけで意味を伝えない（アイコン＋文字で併記）
   ─────────────────────────────────────────────────────────── */

import { BookOpenCheck, CircleHelp, Ruler } from "lucide-react";
import type { GroupResult } from "@/lib/match";
import { buildReductionBasisViews, hasMeasuredGroup } from "@/lib/reductionBasisView";
import type { ReductionBasisView } from "@/lib/reductionBasisView";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function ReductionBasisPanel({ groups }: { groups: GroupResult[] }) {
  if (groups.length === 0) return null;
  const views = buildReductionBasisViews(groups);
  const anyMeasured = hasMeasuredGroup(groups);
  const measuredCount = views.filter((v) => v.basis === "measured").length;

  return (
    <details className="rounded-2xl border border-ink-line bg-paper-sub p-4">
      <summary className="cursor-pointer text-sm/[1.7] font-bold text-ink min-h-[48px] py-3 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
        削減率の根拠（
        {anyMeasured
          ? `${views.length}群のうち${measuredCount}群はメーカー公表値で比較`
          : `${views.length}群すべて係数による概算`}
        ）
      </summary>

      <p className="mt-2 text-base/[1.7] leading-[1.7] text-ink">
        設備群ごとに、削減率を何から出したかを書いています。
        メーカー公表値による比較と、係数による概算は、1つの％の中で混ぜていません。
      </p>

      <ul className="mt-3 space-y-3">
        {views.map((v) => (
          <li key={v.groupId}>
            <GroupBasisCard view={v} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function GroupBasisCard({ view }: { view: ReductionBasisView }) {
  const measured = view.basis === "measured";
  const Icon = measured ? BookOpenCheck : CircleHelp;
  return (
    <div className="rounded-2xl border border-ink-line bg-paper-card p-3.5">
      <p className="text-sm/[1.7] text-ink-soft">{view.groupLabel}</p>

      {/* 色のほかにアイコンと文字で根拠の種類を書く（色だけで伝えない） */}
      <p
        className={
          measured
            ? "mt-1.5 flex items-start gap-2 text-base/[1.7] font-bold text-emerald-900"
            : "mt-1.5 flex items-start gap-2 text-base/[1.7] font-bold text-amber-900"
        }
      >
        <Icon aria-hidden="true" className="w-4 h-4 flex-shrink-0 mt-1" />
        <span>
          {view.basisLabel}：削減 約{pct(view.reductionRate)}
        </span>
      </p>

      {view.measured && (
        <dl className="mt-2.5 space-y-1.5">
          <div className="text-sm/[1.7] leading-[1.7]">
            <dt className="inline font-bold text-ink">既設：</dt>
            <dd className="inline text-ink-soft">
              {view.measured.fromSeries} {view.measured.fromModelNo}（
              {view.measured.indexLabel} {view.measured.fromEfficiency}）
            </dd>
          </div>
          <div className="text-sm/[1.7] leading-[1.7]">
            <dt className="inline font-bold text-ink">更新候補：</dt>
            <dd className="inline text-ink-soft">
              {view.measured.toSeries} {view.measured.toModelNo}（{view.measured.toGradeLabel}・
              {view.measured.indexLabel} {view.measured.toEfficiency}）
            </dd>
          </div>
          <div className="text-sm/[1.7] leading-[1.7]">
            <dt className="inline font-bold text-ink">揃えた条件：</dt>
            <dd className="inline text-ink-soft">
              {view.measured.shapeLabel}・{view.measured.combinationLabel}
              {view.measured.coolingKw != null
                ? `・冷房定格能力 ${view.measured.coolingKw}kW`
                : ""}
            </dd>
          </div>
          {Math.abs(view.measured.rawReductionRate - view.reductionRate) > 1e-9 && (
            <div className="text-sm/[1.7] leading-[1.7]">
              <dt className="inline font-bold text-ink">補足：</dt>
              <dd className="inline text-ink-soft">
                公表値どおりの計算では {pct(view.measured.rawReductionRate)} となり、
                更新候補のほうが効率が高くありません。削減は見込まず0%として扱っています。
              </dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-2 text-sm/[1.7] leading-[1.7] text-ink-soft">{view.note}</p>

      {view.notComparable && (
        <p className="mt-2 text-sm/[1.7] leading-[1.7] text-ink-soft">
          <span className="font-bold text-ink">公表値で比べられない理由：</span>
          {view.notComparable.label}
          <span className="block">
            <span className="font-bold text-ink">これから揃えるもの：</span>
            {view.notComparable.needed}
          </span>
        </p>
      )}

      {view.measured && (
        <>
          <p className="mt-2 flex items-start gap-2 text-sm/[1.7] leading-[1.7] text-ink-soft">
            <Ruler aria-hidden="true" className="w-4 h-4 flex-shrink-0 mt-1" />
            <span>{view.measured.conditionNote}</span>
          </p>
          <ul className="mt-2 space-y-1">
            {view.measured.sources.map((s) => (
              <li key={`${s.catalog}#${s.page}`} className="text-sm/[1.7] leading-[1.7]">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block min-h-[48px] py-3 underline text-brand-deep focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                >
                  {s.title}
                </a>
                <span className="block text-ink-soft">
                  資料番号 {s.catalog} / p.{s.page} / 確認日 {s.checkedAt}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
