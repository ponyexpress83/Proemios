import Link from "./link";
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 38V8h14c11 0 18 6 18 15S33 38 22 38H8Z" fill="currentColor" />
      <path d="M15 15v16h7c6 0 10-3 10-8s-4-8-10-8h-7Z" fill="#FAF8F5" />
      <path d="m8 38 7-7v11l-7 4v-8Z" fill="currentColor" />
      <path d="m19 19 7 4-7 4v-8Z" fill="#F16650" />
      <path d="m36 6 6 6" stroke="#F16650" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Proemios, homepage">
      <BrandMark />
      <span>
        proemios<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
