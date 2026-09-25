"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────────────────
   診断の段階ナビ（EHC-0039 第4片 / 2026-09-14 v1）

   ■ なぜ要るか
   　　いまの診断は、入力欄・結果・PDFが1枚のページに縦に積まれている。
   　　作っている側は構造を知っているので迷わないが、初めて開いた人には
   　　「これは何段あって、自分はいまどこにいて、あと何をすると終わるのか」が
   　　どこにも書かれていない。終わりが見えない入力は途中で閉じられる。

   ■ 出す情報は2つだけ
   　　(1) 全体で5段あること
   　　(2) いま何段目か（「2 / 5 設備を入力」）
   　　所要時間・進捗率（%）は出さない。所要時間は人によって外れるし、
   　　入力量が可変（設備を何群足すか）な画面で%を出すと、
   　　進めたのに数字が下がることがある。数えられる段数だけを出す。

   ■ このファイルが持たないもの
   　　段の遷移条件（次へ進めるか）は持たない。
   　　「入力が足りているか」の判定は入力状態を持つ側（lib/diagnosisProjection.ts）と
   　　その画面の責務で、ここに書くと同じ判定が2か所に分かれる。
   　　ここは渡された current と reached を描くだけ。
   ─────────────────────────────────────────────────────────── */

export type DiagnosisStage = "find" | "equip" | "result" | "estimate" | "docs";

/* 2026-09-14 EHC-0039: 段の名前を、こちらの作業名から相手の目的語へ入れ替えた。
   「制度を探す」「結果を確認」「資料を受け取る」は、こちら側が何をする段かを
   書いたもので、押した先に何があるかを言っていない。
   「候補を見る」「結果と根拠」「診断書を受け取って相談」なら、
   その段で手に入るものが名前になっている。
   ここは表示名だけの変更で、id（遷移の識別子）は変えていない。 */
export const DIAGNOSIS_STAGES: { id: DiagnosisStage; label: string }[] = [
  { id: "find", label: "候補を見る" },
  { id: "equip", label: "設備を入力" },
  { id: "result", label: "結果と根拠" },
  { id: "estimate", label: "概算費用と工事" },
  { id: "docs", label: "診断書を受け取って相談" },
];

const SHORT_STAGE_LABELS: Record<DiagnosisStage, string> = {
  find: "候補", equip: "設備", result: "結果", estimate: "概算", docs: "相談",
};

export const stageIndex = (stage: DiagnosisStage): number =>
  DIAGNOSIS_STAGES.findIndex((s) => s.id === stage);

export interface StageNavProps {
  current: DiagnosisStage;
  /** 到達済みの段。戻れる段を決めるのは呼び出し側。既定は「現在より前はすべて到達済み」 */
  reached?: DiagnosisStage[];
  /** 渡されたときだけ段を押して移動できる。渡さなければ表示のみ */
  onSelect?: (stage: DiagnosisStage) => void;
}

export function StageNav({ current, reached, onSelect }: StageNavProps) {
  const currentIdx = Math.max(0, stageIndex(current));
  const isReached = (i: number, id: DiagnosisStage) =>
    reached ? reached.includes(id) : i <= currentIdx;

  return (
    <nav aria-label="診断の進み方" className="no-print mb-6">
      {/* 「2 / 5 設備を入力」。
          図を読まなくても、ここ1行で現在地が分かるようにしておく。
          読み上げでも最初にこの行が読まれる位置に置く。 */}
      {/* 2026-09-14 EHC-0039: 12px → 14px
          v3§7の下限は14px。ここは「自分がいまどこにいるか」を1行で伝える、
          この段で最初に読まれる行なので、装飾扱いで12pxに落とさない。 */}
      <p className="mb-3 flex items-center gap-3 text-[16px] leading-relaxed text-ink" aria-live="polite">
        <span className="shrink-0 rounded-full bg-[#e7efcf] px-3 py-1 text-[14px] font-bold text-brand-deep">
          {currentIdx + 1} / {DIAGNOSIS_STAGES.length}
        </span>
        <span className="min-w-0 font-bold">{DIAGNOSIS_STAGES[currentIdx]?.label}</span>
      </p>

      {/* 狭幅では短い段名を使い、現在の段の正式名は上に表示する。 */}
      <ol className="grid grid-cols-5 gap-1 md:gap-2">
        {DIAGNOSIS_STAGES.map((s, i) => {
          const isCurrent = s.id === current;
          const done = !isCurrent && i < currentIdx;
          const reachedHere = isReached(i, s.id);
          const clickable = Boolean(onSelect) && reachedHere && !isCurrent;

          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                  isCurrent
                    ? "bg-[#d7e7ae] text-brand-deep"
                    : done
                    ? "bg-[#d7e7ae] text-ink"
                    : "bg-paper-card text-ink-soft border border-ink-line"
                )}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              {/* 2026-09-14 EHC-0039: 13px → 14px。
                  行高だけは 1.7 ではなく 1.5 にしている。
                  §7の「行高約1.7」は読ませる文章（本文・根拠・不足理由）の基準で、
                  ここは2行までの短い段名である。1.7にすると
                  「診断書を受け取って相談」の2行で高さが約48pxになり、
                  同じ行の他の段の箱まで一緒に伸びて、5段の一覧が
                  1画面に収まらなくなる。文字の大きさは下限14pxを満たす。 */}
              <span
                className={cn(
                  "min-w-0 text-center text-[14px] leading-[1.5] md:text-left",
                  isCurrent ? "font-bold text-ink" : "text-ink-soft"
                )}
              >
                <span className="md:hidden" aria-hidden="true">{SHORT_STAGE_LABELS[s.id]}</span>
                <span className="hidden md:inline" aria-hidden="true">{s.label}</span>
                <span className="sr-only">{i + 1}. {s.label}</span>
              </span>
            </>
          );

          /* 現在地は色だけで示さない。
             緑の面と淡い面の差は、色覚型によっては明度差しか残らず、
             白黒で印刷すればどちらも同じ灰色になる。
             aria-current="step" と、上の「2 / 5」の行を必ず併記する。 */
          const boxClass = cn(
            /* 44px ではなく 48px。ここは Field.tsx の CONTROL_BASE と同じ理由で、
               現場で手袋のまま触られることを想定している。 */
            "min-h-[72px] min-w-[48px] w-full flex flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition-colors md:min-h-[64px] md:flex-row md:justify-start md:gap-2 md:px-3",
            isCurrent
              ? "border-brand bg-[#edf6e8] ring-1 ring-brand"
              : "border-ink-line bg-paper-card",
            clickable && "hover:border-brand cursor-pointer",
            !clickable && !isCurrent && "cursor-default"
          );

          return (
            <li key={s.id} className="min-w-0">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(s.id)}
                  className={cn(
                    boxClass,
                    "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                  )}
                >
                  {body}
                </button>
              ) : (
                <div className={boxClass} aria-current={isCurrent ? "step" : undefined}>
                  {body}
                  {/* 未到達の段は「まだ押せない」ことを読み上げにも伝える。
                      見た目では薄さで示しているが、薄さは読み上げに乗らない。 */}
                  {!reachedHere && <span className="sr-only">（未到達）</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
