"use client";

import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-slate-300 mb-1.5 font-semibold flex items-center gap-1.5">
        <span>{label}</span>
        {help && (
          <span className="tooltip-trigger relative inline-flex items-center cursor-help" tabIndex={0}>
            <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-cobalt-300 transition-colors" />
            <span className="tooltip">{help}</span>
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "px-3 py-2.5 border border-white/15 rounded-lg text-sm bg-night-800 text-white shadow-soft transition-all",
        "focus:outline-none focus:ring-2 focus:ring-cobalt-500/40 focus:border-cobalt-500 hover:border-white/30",
        "appearance-none bg-no-repeat bg-[right_0.7rem_center] pr-8",
        className
      )}
      style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%2394a3b8'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E\")", backgroundSize: "16px" }}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "px-3 py-2.5 border border-white/15 rounded-lg text-sm bg-night-800 text-white placeholder:text-slate-500 shadow-soft transition-all",
        "focus:outline-none focus:ring-2 focus:ring-cobalt-500/40 focus:border-cobalt-500 hover:border-white/30",
        className
      )}
      {...props}
    />
  );
}

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "bg-gradient-to-r from-cobalt-600 to-cobalt-500 hover:from-cobalt-700 hover:to-cobalt-600",
        "text-white font-semibold px-6 py-3.5 rounded-xl w-full transition-all",
        "shadow-card hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0",
        "flex items-center justify-center gap-2",
        className
      )}
      {...props}
    />
  );
}
