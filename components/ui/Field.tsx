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

/* 2026-09-14 EHC-0039: 項目名の文字サイズを呼び出し側から選べるようにする
   ───────────────────────────────────────────────────────────
   この Field は新規5段（EquipInputStage）と、既存の
   DropinSimulator / SubsidyMatcher / UpdateEstimator / DropinRoiWizard の
   両方から使われている共有部品である。

   v3の§7は「本文16pxを基本、根拠・不足理由14px以上」と決めているが、
   これは新規5段に対する基準であって、既存チャット側は
   「既存チャットの44pxは改修しない」と同じ理由で今回の改修対象外。
   ここで text-xs(12px) を全体に引き上げると、こちらが確認していない
   既存4画面の欄が一斉に広がり、横に並べている欄が折り返す恐れがある。
   確認していない画面を、確認しないまま動かさない。

   そこで既定は今までどおり 12px のままにし、新規5段だけが
   labelSize="md" を明示して 14px を選ぶ。既存4画面のマークアップは
   1文字も変わらない。 */
export function Field({
  label,
  help,
  children,
  labelSize = "sm",
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  /** "sm"=12px（既存画面の既定） / "md"=14px（新規5段の§7基準） */
  labelSize?: "sm" | "md";
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col">
      {/* 対応する control を持たない <label> は支援技術側で「孤立ラベル」と警告される。
          役割は aria-labelledby が担うので、要素自体は div にする（見た目は同一）。 */}
      {/* 2026-09-10 EHC-0032 LIGHT-01: 項目名は白地では ink。
          ヘルプの ? は ink-soft、ホバーで brand。青(cobalt)は使わない
          — 寄せる先の HomeV17 の紙面に青が1色も無いため。 */}
      <div
        className={cn(
          "text-ink mb-1.5 font-semibold flex items-center gap-1.5",
          labelSize === "md" ? "text-[14px] leading-[1.7]" : "text-xs"
        )}
      >
        <span id={labelId}>{label}</span>
        {help && (
          <span
            className="tooltip-trigger relative inline-flex items-center cursor-help"
            tabIndex={0}
            role="note"
            aria-label={`補足: ${help}`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-ink-soft hover:text-brand transition-colors" aria-hidden="true" />
            {/* 2026-09-14 EHC-0039 §7: 吹き出しの中身は「根拠・補足」で、利用者が実際に読む文。
                .tooltip の既定は 11px だが、既存4画面と共有しているクラスなので
                .tooltip 自体は動かさず、新規5段(labelSize="md")だけ .tooltip-md を重ねて
                14px / 行高1.7 にする。項目名の 12px→14px と同じ opt-in の形。 */}
            <span className={cn("tooltip", labelSize === "md" && "tooltip-md")}>{help}</span>
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
   Select / Input / Button の3つで同じ枠線・同じ角丸・同じフォーカス色を使う。

   ───────── 2026-09-11 EHC-0038 第2便 4-H / 4-J ─────────
   (1) 枠線を #859f8c から #57685e へ。#859f8c は白地でのコントラスト比が
       2.863 しかなく、1.5px の線では「枠がある」ことが見えない人がいる。
       入力欄の枠は装飾ではなく「ここに書く」という指示なので、
       見えないと欄の存在自体が伝わらない。#57685e は 5.920 出る。
       （HomeV17 側の .field input は 18px の大きな欄で、こちらは 14px。
         小さいほど線の視認性は落ちるため、同じ色を流用しない。）
   (2) フォーカスは半透明リング(ring-brand/30)から【不透明2px outline＋2px offset】へ。
       半透明 30% のリングは、白地・淡色地・緑地のどこに重なるかで濃さが変わり、
       背景が淡いと「光っているだけ」で枠と区別できない。
       outline は要素の外側に描かれて枠線と混ざらず、offset で1段離すので、
       どの地色でも「いまここにカーソルがある」が一定の濃さで分かる。
       :focus ではなく :focus-visible にして、マウスで押しただけの欄に
       枠が出ないようにする（キーボード操作のときだけ出る）。 */
/* (3) 高さ 44px → 48px。44px は iOS のガイドライン値だが、この画面は
       作業着や手袋のまま現場で触られることを想定しており、
       WCAG 2.5.8 の AAA 相当（44px）ではなく実務側の余裕を取る。
       Select / Input / Button の3つが同じ CONTROL_BASE を共有しているので、
       ここを1行変えれば入力欄・ボタンの高さが揃ったまま上がる。 */
const CONTROL_BASE =
  "min-h-[48px] px-3 py-2.5 border-[1.5px] border-[#57685e] rounded-xl text-sm bg-paper-card text-ink transition-all " +
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-brand focus:border-brand hover:border-brand";

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
        /* 2026-09-11 EHC-0038 第2便 4-J: 主ボタンにフォーカス表示が無かった。
           濃い緑の面の上に薄いリングを重ねても見えないので、
           入力欄と同じ【不透明2px outline＋2px offset】にする。
           offset があるので outline は白い紙の上に描かれ、緑の面に埋もれない。 */
        "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
        "hover:-translate-y-0.5 active:translate-y-0",
        "flex items-center justify-center gap-2",
        className
      )}
      {...props}
    />
  );
}
