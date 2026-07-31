"use client";

import { cn } from "@/lib/utils";
import { useState, createContext, useContext } from "react";
import { Info } from "lucide-react";

interface TabsContextValue {
  active: string;
  setActive: (v: string) => void;
}
const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// タブ内コンポーネントからタブを切り替えるためのフック（例: ドロップイン→補助金マッチングへの動線）
export function useTabSwitch(): ((v: string) => void) | null {
  const ctx = useContext(TabsContext);
  return ctx ? ctx.setActive : null;
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 mb-5 p-2 bg-night-900 rounded-2xl shadow-soft border border-white/10 no-print",
        className
      )}
    >
      {children}
    </div>
  );
}

/* タブを役割で2段に分けるだけのグループ。折りたたまないのでクリック数は増えない。
   フラットに8個並ぶと選択コストが高く、「どれから触ればいいか」が伝わらないための措置。 */
export function TabGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-2 pb-1 text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

export function TabsTrigger({
  value,
  icon,
  hint,
  children,
}: {
  value: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(TabsContext)!;
  const isActive = ctx.active === value;
  return (
    <div className="relative group flex-shrink-0">
      <button
        onClick={() => ctx.setActive(value)}
        aria-label={hint ? `${typeof children === "string" ? children : ""}: ${hint}` : undefined}
        className={cn(
          "px-4 py-2.5 text-sm cursor-pointer rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 w-full",
          isActive
            ? "bg-gradient-to-r from-ehc-600 to-ehc-500 text-white shadow-glow font-semibold"
            : "text-slate-400 hover:text-white hover:bg-white/5 font-medium"
        )}
      >
        {icon && <span className="w-4 h-4 flex items-center">{icon}</span>}
        {children}
      </button>
      {hint && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-night-900/95 px-3 py-2 text-xs leading-relaxed text-slate-200 shadow-lift opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
        >
          {hint}
        </span>
      )}
    </div>
  );
}

/* 選択中タブの「タブ名＋何をする画面か」を全デバイスで常時表示するパネル。
   タブのツールチップは group-hover のみ＝タッチデバイスでは発火しないうえ、
   極小グレー1行では読み飛ばされる。説明を必ず目に入れるため枠付きパネルに格上げしている。 */
export function TabHint({ hints }: { hints: Record<string, { label: string; hint: string }> }) {
  const ctx = useContext(TabsContext)!;
  const item = hints[ctx.active];
  if (!item) return null;
  return (
    <div className="-mt-2 mb-5 rounded-xl border border-white/10 bg-night-900/70 px-4 py-3 no-print">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-ehc-300" />
        <div>
          <div className="text-sm font-bold text-slate-100">
            {item.label}
            <span className="ml-2 text-[10px] font-medium tracking-wider text-slate-500">このタブでできること</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{item.hint}</p>
        </div>
      </div>
    </div>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.active !== value) return null;
  return <div className="animate-fade-in">{children}</div>;
}
