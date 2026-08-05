import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { z } from "zod";

/**
 * Blog in MDX: i file vivono in `content/blog/*.mdx` con frontmatter completo.
 * In Fase 1 gli articoli sono outline di lavoro (`pubblicato: false`): la
 * struttura è pronta, i testi si scrivono uno alla volta.
 */

const CARTELLA = join(process.cwd(), "content", "blog");

const frontmatterSchema = z.object({
  titolo: z.string().min(3),
  descrizione: z.string().min(10),
  categoria: z.string().min(2),
  slug: z.string().min(3),
  servizioCollegato: z.string().optional(),
  pubblicato: z.boolean().default(false),
  dataPubblicazione: z.string().nullable().optional(),
  autore: z.string().default("Proemios"),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
export type Articolo = Frontmatter & { corpo: string };

function leggi(slug: string): Articolo | null {
  try {
    const grezzo = readFileSync(join(CARTELLA, `${slug}.mdx`), "utf8");
    const { data, content } = matter(grezzo);
    const esito = frontmatterSchema.safeParse(data);
    if (!esito.success) {
      console.error(
        JSON.stringify({ evt: "blog.frontmatter-non-valido", slug, err: esito.error.issues }),
      );
      return null;
    }
    return { ...esito.data, corpo: content };
  } catch {
    return null;
  }
}

export function tuttiGliArticoli(): Articolo[] {
  let files: string[];
  try {
    files = readdirSync(CARTELLA).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
  return files
    .map((f) => leggi(f.replace(/\.mdx$/, "")))
    .filter((a): a is Articolo => a !== null)
    .sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
}

export function getArticolo(slug: string): Articolo | null {
  return leggi(slug);
}

export function slugArticoli(): string[] {
  return tuttiGliArticoli().map((a) => a.slug);
}

/** Categorie nell'ordine in cui compaiono. */
export function categorie(articoli: Articolo[]): string[] {
  return Array.from(new Set(articoli.map((a) => a.categoria)));
}
