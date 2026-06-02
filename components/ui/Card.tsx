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
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { icon?: React.ReactNode }) {
  return (
    <h2
      className={cn(
        "text-base font-semibold text-white border-b border-white/10 pb-3 mb-5 flex items-center gap-2",
        className
      )}
      {...props}
    >
      {icon && <span className="text-cobalt-300">{icon}</span>}
      {children}
    </h2>
  );
}
