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
        "rounded-lg border bg-carta p-6 sm:p-8",
        highlighted
          ? "border-bronzo shadow-[0_1px_0_0_var(--color-bronzo)] ring-1 ring-bronzo/30"
          : "border-linea",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.18em] text-bronzo",
        className,
      )}
    >
      {children}
    </span>
  );
}
