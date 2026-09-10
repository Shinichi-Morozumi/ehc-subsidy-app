import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-night-900 rounded-2xl shadow-card border border-white/10 p-6 animate-fade-in",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  icon,
  iconTone = "cobalt",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  icon?: React.ReactNode;
  /* 2026-09-10 EHC-0031 UI-02:
     アイコン色を固定していたため、シミュレーション系のカードだけ
     ブランド緑に寄せることができなかった。既定は従来のコバルトのまま。 */
  iconTone?: "cobalt" | "ehc";
}) {
  return (
    <h2
      className={cn(
        "text-base font-semibold text-white border-b border-white/10 pb-3 mb-5 flex items-center gap-2",
        className
      )}
      {...props}
    >
      {icon && <span className={iconTone === "ehc" ? "text-ehc-400" : "text-cobalt-300"}>{icon}</span>}
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
   診断ツールはダークテーマなので、色だけブランド緑（ehc-400）に置き換え、
   形（丸＋小さい太字＋字間）はメインページと揃える。
   アクセントは緑1色に限定する。青・紫・水色を各カードで足すと、
   同じ画面の中で色の意味が読めなくなる。
   ─────────────────────────────────────────────────────────── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.14em] text-ehc-400 mb-2.5">
      <span className="w-[7px] h-[7px] rounded-full bg-ehc-500 flex-none" aria-hidden="true" />
      {children}
    </p>
  );
}
