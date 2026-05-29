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
      <label className="text-xs text-slate-700 mb-1.5 font-semibold flex items-center gap-1.5">
        <span>{label}</span>
        {help && (
          <span className="tooltip-trigger relative inline-flex items-center cursor-help" tabIndex={0}>
            <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-ehc-600 transition-colors" />
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
        "px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white shadow-soft transition-all",
        "focus:outline-none focus:ring-2 focus:ring-ehc-500/30 focus:border-ehc-500 hover:border-slate-300",
        "appearance-none bg-no-repeat bg-[right_0.7rem_center] pr-8",
        className
      )}
      style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%2364748b'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E\")", backgroundSize: "16px" }}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white shadow-soft transition-all",
        "focus:outline-none focus:ring-2 focus:ring-ehc-500/30 focus:border-ehc-500 hover:border-slate-300",
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
        "bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700",
        "text-white font-semibold px-6 py-3.5 rounded-xl w-full transition-all",
        "shadow-card hover:shadow-lift hover:-translate-y-0.5 active:translate-y-0",
        "flex items-center justify-center gap-2",
        className
      )}
      {...props}
    />
  );
}
