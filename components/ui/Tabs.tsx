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
        "flex gap-1 mb-5 p-1.5 bg-night-900 rounded-2xl shadow-soft border border-white/10 overflow-x-auto no-print",
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
  children,
}: {
  value: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ctx = useContext(TabsContext)!;
  const isActive = ctx.active === value;
  return (
    <button
      onClick={() => ctx.setActive(value)}
      className={cn(
        "px-4 py-2.5 text-sm cursor-pointer rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0",
        isActive
          ? "bg-gradient-to-r from-ehc-600 to-ehc-500 text-white shadow-glow font-semibold"
          : "text-slate-400 hover:text-white hover:bg-white/5 font-medium"
      )}
    >
      {icon && <span className="w-4 h-4 flex items-center">{icon}</span>}
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.active !== value) return null;
  return <div className="animate-fade-in">{children}</div>;
}
