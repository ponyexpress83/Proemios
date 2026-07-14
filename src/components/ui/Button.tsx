import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium tracking-tight lift select-none disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-inchiostro text-carta hover:bg-bronzo-scuro border border-inchiostro hover:border-bronzo-scuro",
  secondary:
    "bg-transparent text-inchiostro border border-inchiostro/25 hover:border-bronzo hover:text-bronzo-scuro",
  ghost:
    "bg-transparent text-inchiostro hover:text-bronzo-scuro underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  md: "text-sm px-5 py-2.5 rounded-md",
  lg: "text-base px-7 py-3.5 rounded-md",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & { href: Route | string } & Omit<
    React.ComponentProps<typeof Link>,
    "href" | "className" | "children"
  >) {
  return (
    <Link
      href={href as Route}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}
