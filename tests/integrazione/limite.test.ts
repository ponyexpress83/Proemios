/**
 * Il limitatore su database vero.
 *
 * Il caso che conta è quello che un contatore in memoria sbaglia: **richieste
 * contemporanee**. Leggere il conteggio e poi scriverlo lascia una finestra in
 * cui due richieste leggono lo stesso valore e lo incrementano entrambe a
 * partire da lì — e passano tutte e due. Qui si spara un blocco di richieste in
 * parallelo e si conta quante ne sono state ammesse.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { chiudiDatabase, preparaDatabase, svuota } from "./aiuto";
import { conta, ripulisci } from "@/lib/sicurezza/store-limite";
import { chiaveLimite } from "@/lib/sicurezza/limite";
import * as schema from "@/db/schema";

beforeAll(async () => {
  await preparaDatabase();
});

afterAll(async () => {
  await chiudiDatabase();
});

beforeEach(async () => {
  await svuota();
});

const REGOLA = { massimo: 5, finestraSecondi: 60 };

describe("conteggio su database", () => {
  it("ammette esattamente il massimo, poi rifiuta", async () => {
    const chiave = await chiaveLimite("contatto", "203.0.113.10");

    for (let i = 1; i <= 5; i += 1) {
      const esito = await conta(chiave, REGOLA);
      expect(esito.ammessa, `richiesta ${i}`).toBe(true);
      expect(esito.restanti).toBe(5 - i);
    }

    const sesta = await conta(chiave, REGOLA);
    expect(sesta.ammessa).toBe(false);
    expect(sesta.attendiSecondi).toBeGreaterThan(0);
    expect(sesta.attendiSecondi).toBeLessThanOrEqual(60);
  });

  it("regge venti richieste contemporanee senza lasciarne passare una di troppo", async () => {
    // È il caso che un contatore in memoria non ferma: la corsa fra lettura e
    // scrittura. L'aggiornamento qui è una sola istruzione, e Postgres
    // serializza i conflitti sulla stessa riga.
    const chiave = await chiaveLimite("contatto", "203.0.113.20");
    const esiti = await Promise.all(
      Array.from({ length: 20 }, () => conta(chiave, REGOLA)),
    );
    const ammesse = esiti.filter((e) => e.ammessa).length;
    expect(ammesse).toBe(5);
  });

  it("conta separatamente origini diverse", async () => {
    const a = await chiaveLimite("contatto", "203.0.113.30");
    const b = await chiaveLimite("contatto", "203.0.113.31");
    for (let i = 0; i < 5; i += 1) await conta(a, REGOLA);

    expect((await conta(a, REGOLA)).ammessa).toBe(false);
    // L'altra origine non è toccata.
    expect((await conta(b, REGOLA)).ammessa).toBe(true);
  });

  it("riapre la finestra quando scade", async () => {
    const chiave = await chiaveLimite("contatto", "203.0.113.40");
    for (let i = 0; i < 5; i += 1) await conta(chiave, REGOLA);
    expect((await conta(chiave, REGOLA)).ammessa).toBe(false);

    // Si sposta indietro l'inizio della finestra invece di aspettare un minuto.
    const db = await preparaDatabase();
    await db.execute(
      sql`update rate_limits set finestra_inizio = now() - interval '61 seconds' where chiave = ${chiave}`,
    );

    const dopo = await conta(chiave, REGOLA);
    expect(dopo.ammessa).toBe(true);
    expect(dopo.restanti).toBe(4);
  });

  it("non conserva l'indirizzo in chiaro", async () => {
    const chiave = await chiaveLimite("contatto", "203.0.113.50");
    await conta(chiave, REGOLA);

    const db = await preparaDatabase();
    const righe = await db.select().from(schema.rateLimits);
    expect(righe).toHaveLength(1);
    expect(JSON.stringify(righe)).not.toContain("203.0.113.50");
  });

  it("la pulizia rimuove le finestre vecchie e lascia le recenti", async () => {
    const vecchia = await chiaveLimite("contatto", "203.0.113.60");
    const recente = await chiaveLimite("contatto", "203.0.113.61");
    await conta(vecchia, REGOLA);
    await conta(recente, REGOLA);

    const db = await preparaDatabase();
    await db.execute(
      sql`update rate_limits set finestra_inizio = now() - interval '48 hours' where chiave = ${vecchia}`,
    );

    expect(await ripulisci(24)).toBe(1);
    const rimaste = await db.select().from(schema.rateLimits);
    expect(rimaste.map((r) => r.chiave)).toEqual([recente]);
  });
});
