import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-card border border-slate-100 p-6 animate-fade-in",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { icon?: React.ReactNode }) {
  return (
    <h2
      className={cn(
        "text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2",
        className
      )}
      {...props}
    >
      {icon && <span className="text-ehc-600">{icon}</span>}
      {children}
    </h2>
  );
}
