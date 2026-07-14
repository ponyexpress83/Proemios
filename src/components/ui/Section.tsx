import { cn } from "@/lib/cn";
import { Container } from "./Container";

/** Sezione con spaziatura verticale generosa e sfondo opzionale. */
export function Section({
  children,
  className,
  tone = "carta",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "carta" | "carta-2" | "inchiostro";
  id?: string;
}) {
  const tones: Record<string, string> = {
    carta: "bg-carta text-inchiostro",
    "carta-2": "bg-carta-2 text-inchiostro",
    inchiostro: "bg-inchiostro text-carta",
  };
  return (
    <section id={id} className={cn("py-16 sm:py-24", tones[tone], className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** Occhiello + titolo + sottotitolo, coerente in tutto il sito. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  tone = "dark",
  as: TitleTag = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
  tone?: "dark" | "light";
  as?: "h1" | "h2" | "h3";
}) {
  const isLight = tone === "light";
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p
          className={cn(
            "mb-3 text-xs font-semibold tracking-[0.18em] uppercase",
            isLight ? "text-bronzo-chiaro" : "text-bronzo",
          )}
        >
          {eyebrow}
        </p>
      )}
      <TitleTag
        className={cn(
          "text-3xl leading-[1.1] font-medium text-balance sm:text-4xl",
          TitleTag === "h1" && "sm:text-5xl",
          isLight ? "text-carta" : "text-inchiostro",
        )}
      >
        {title}
      </TitleTag>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed text-pretty",
            isLight ? "text-carta/75" : "text-inchiostro-60",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
