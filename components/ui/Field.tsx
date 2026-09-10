"use client";

import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { createContext, useContext, useId } from "react";

/* 2026-08-24 監査での修正:
     Field の <label> は htmlFor を持たず、入力欄は label の「兄弟」だった。
     つまり見た目の上では項目名が付いているのに、支援技術からは
     「名前のない入力欄」に見えていた（27個中25個が該当）。
     Field が項目名テキストに id を振り、その id を配下の Input / Select が
     aria-labelledby で参照する。aria-labelledby は複数の入力欄が
     同じラベルを指してよいので、1つの Field に入力欄が2つあっても壊れない。
     見た目とマークアップは一切変わらない。 */
const FieldLabelContext = createContext<string | null>(null);

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col">
      {/* 対応する control を持たない <label> は支援技術側で「孤立ラベル」と警告される。
          役割は aria-labelledby が担うので、要素自体は div にする（見た目は同一）。 */}
      {/* 2026-09-10 EHC-0032 LIGHT-01: 項目名は白地では ink。
          ヘルプの ? は ink-soft、ホバーで brand。青(cobalt)は使わない
          — 寄せる先の HomeV17 の紙面に青が1色も無いため。 */}
      <div className="text-xs text-ink mb-1.5 font-semibold flex items-center gap-1.5">
        <span id={labelId}>{label}</span>
        {help && (
          <span
            className="tooltip-trigger relative inline-flex items-center cursor-help"
            tabIndex={0}
            role="note"
            aria-label={`補足: ${help}`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-ink-soft hover:text-brand transition-colors" aria-hidden="true" />
            <span className="tooltip">{help}</span>
          </span>
        )}
      </div>
      <FieldLabelContext.Provider value={labelId}>{children}</FieldLabelContext.Provider>
    </div>
  );
}

/** Field の項目名を aria-labelledby で参照させる。明示指定があればそちらを優先。 */
function useFieldLabelledBy(explicitLabel?: string, explicitLabelledBy?: string) {
  const ctx = useContext(FieldLabelContext);
  if (explicitLabel || explicitLabelledBy) return explicitLabelledBy;
  return ctx ?? undefined;
}

/* 2026-09-10 EHC-0032 LIGHT-01
   HomeV17 の入力欄: border:1.5px solid #859f8c / radius:12px / 背景白 / 文字 ink。
   枠線を 1px の薄い罫線ではなく 1.5px の中間色にしているのは、
   入力欄だけは「触れる場所」だと分かる必要があるため（カードの罫線と同じ濃さだと
   ただの区切り線に見えて、クリックできることが伝わらない）。
   フォーカスリングは青(cobalt)ではなく緑。寄せる先の紙面に青は1色も無い。
   Select / Input / Button の3つで同じ枠線・同じ角丸・同じフォーカス色を使う。 */
const CONTROL_BASE =
  "min-h-[44px] px-3 py-2.5 border-[1.5px] border-[#859f8c] rounded-xl text-sm bg-paper-card text-ink transition-all " +
  "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand hover:border-brand/60";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const labelledBy = useFieldLabelledBy(props["aria-label"], props["aria-labelledby"]);
  return (
    <select
      aria-labelledby={labelledBy}
      className={cn(
        CONTROL_BASE,
        "appearance-none bg-no-repeat bg-[right_0.7rem_center] pr-8",
        className
      )}
      style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%2357685e'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E\")", backgroundSize: "16px" }}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const labelledBy = useFieldLabelledBy(props["aria-label"], props["aria-labelledby"]);
  return (
    <input
      aria-labelledby={labelledBy}
      className={cn(
        CONTROL_BASE,
        "placeholder:text-ink-soft/70",
        className
      )}
      {...props}
    />
  );
}

/* 2026-09-10 EHC-0032 LIGHT-01
   主ボタンを HomeV17 の「質問フォームの送信ボタン」に合わせる。
     .ehc17 .question-foot .primary{background:#254d39;color:white}
     .ehc17 .primary{border-radius:100px;box-shadow:none}
   青のグラデーション＋発光影は、ダークの上で押せる場所を目立たせるための作りだった。
   紙面では単色の濃い緑＋丸い形だけで十分に押せると分かる。影は消す（紙が濁る）。
   浮き上がり（-translate-y）は残す。押せることが動きで伝わるのは白地でも同じ。 */
export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "bg-brand-deep hover:bg-brand",
        "text-white font-bold px-6 py-3.5 rounded-full w-full transition-all",
        "hover:-translate-y-0.5 active:translate-y-0",
        "flex items-center justify-center gap-2",
        className
      )}
      {...props}
    />
  );
}
