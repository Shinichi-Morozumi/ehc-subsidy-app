"use client";

import { cn } from "@/lib/utils";
import { useState, createContext, useContext } from "react";

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
        "flex gap-1 mb-5 p-1.5 bg-night-900 rounded-2xl shadow-soft border border-white/10 overflow-x-auto md:overflow-visible no-print",
        className
      )}
    >
      {children}
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

// スマホ（hoverなし）向け: 選択中タブの説明を常時表示するキャプション
export function TabHint({ hints }: { hints: Record<string, string> }) {
  const ctx = useContext(TabsContext)!;
  const text = hints[ctx.active];
  if (!text) return null;
  return (
    <div className="md:hidden -mt-2 mb-4 px-1 text-xs leading-relaxed text-slate-400 no-print">
      {text}
    </div>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.active !== value) return null;
  return <div className="animate-fade-in">{children}</div>;
}
