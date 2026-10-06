import Link from "./link";
import { BRAND_MARK } from "@/lib/brand-mark";
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <path d={BRAND_MARK.body} fill="currentColor" />
      <path d={BRAND_MARK.counter} fill="#FAF8F5" />
      <path d={BRAND_MARK.fold} fill="#F16650" />
    </svg>
  );
}
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Proemios, homepage">
      <BrandMark />
      <span>Proemios</span>
    </Link>
  );
}
