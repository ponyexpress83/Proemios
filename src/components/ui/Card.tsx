import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  highlighted = false,
}: {
  children: React.ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-carta rounded-lg border p-6 sm:p-8",
        highlighted
          ? "border-bronzo ring-bronzo/30 shadow-[0_1px_0_0_var(--color-bronzo)] ring-1"
          : "border-linea",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("text-bronzo text-xs font-semibold tracking-[0.18em] uppercase", className)}
    >
      {children}
    </span>
  );
}
