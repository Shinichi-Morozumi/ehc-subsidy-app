import { cn } from "@/lib/utils";

/* 2026-09-10 EHC-0032 LIGHT-01
   カードの型をメインページ（HomeV17）の .qcard に合わせる。
     HomeV17: border:1px solid var(--line); border-radius:30px; box-shadow:none
   ダーク時代は「黒い面＋強い影」で階層を作っていたが、紙の上では
   影を重ねるほど濁るだけなので、面の白と1本の罫線だけで区切る。
   角丸は 2xl(16px) から 3xl(24px) へ上げて HomeV17 の丸みに寄せる。 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-paper-card rounded-3xl border border-ink-line p-6 animate-fade-in",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  icon,
  iconTone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  icon?: React.ReactNode;
  /* 2026-09-10 EHC-0031 UI-02:
     アイコン色を固定していたため、シミュレーション系のカードだけ
     ブランド緑に寄せることができなかった。
     2026-09-10 EHC-0032 LIGHT-01: 既定値の名前を "cobalt" から "neutral" へ改める。
     実際の色が青でなくなったので、名前が青のままだと次に触る人が誤解する。
     呼び出し側で "cobalt" を渡している箇所は無い（"ehc" 指定が4箇所のみ）。 */
  iconTone?: "neutral" | "ehc";
}) {
  return (
    <h2
      className={cn(
        "text-base font-semibold text-ink border-b border-ink-line pb-3 mb-5 flex items-center gap-2",
        className
      )}
      {...props}
    >
      {/* 2026-09-10 EHC-0032 LIGHT-01
          白地の上では ehc-400/cobalt-300 は薄すぎて沈む（コントラスト2〜3）。
          さらに、寄せる先の HomeV17 の紙面には**青が1色も無い**。
          ここで cobalt を残すと、メインページから来た人には
          「別のサイトに移った」ように見えるので、既定はインクの淡色にする。
          緑を出すのは「そのカードが試算・結論を持っているとき」だけに限定する。 */}
      {icon && <span className={iconTone === "ehc" ? "text-brand" : "text-ink-soft"}>{icon}</span>}
      {children}
    </h2>
  );
}

/* ───────────────────────────────────────────────────────────
   2026-09-10 EHC-0031 UI-02
   メインページ（HomeV17）の .section-label と同じ見出しの型。

   HomeV17 側の定義（app/home-v17.css）:
     font-size:12px; font-weight:700; letter-spacing:.08em;
     :before で 7px の丸を currentColor で描く
   形（丸＋小さい太字＋字間）をメインページと揃える。
   アクセントは緑1色に限定する。青・紫・水色を各カードで足すと、
   同じ画面の中で色の意味が読めなくなる。

   2026-09-10 EHC-0032 LIGHT-01: 地が白になったので緑を1段濃くする。
   ehc-400(#2bba6c) は白地ではコントラスト比が 2.3 程度しかなく、
   11px の小さな太字では読めない。HomeV17 の .section-label は
   color:var(--green)＝#286644（brand）で、白地で 6.6 出る。同じ色を使う。
   ─────────────────────────────────────────────────────────── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.14em] text-brand mb-2.5">
      <span className="w-[7px] h-[7px] rounded-full bg-brand flex-none" aria-hidden="true" />
      {children}
    </p>
  );
}
