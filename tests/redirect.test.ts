import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/**
 * `redirect()` di Next funziona **lanciando** un errore `NEXT_REDIRECT`, che il
 * framework intercetta più in alto. Chiamarlo dentro un `try` con un `catch`
 * che non lo rilancia significa intercettare il proprio salto e trattare un
 * successo come un errore.
 *
 * È già successo una volta, sulla pagina di accettazione dell'invito: chi
 * accettava vedeva la pagina d'errore mentre l'account veniva creato davvero e
 * il token — monouso — risultava consumato. Nessun modo di riprovare.
 *
 * Il controllo è sull'albero sintattico, non su una regex: il conteggio delle
 * graffe si sbaglia sulle stringhe e sui template literal, e un test che sbaglia
 * in silenzio è peggio di nessun test.
 */

const RADICI = ["app", "components", "lib"];

function sorgenti(cartella: string): string[] {
  const trovati: string[] = [];
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) {
      if (voce === "node_modules" || voce === ".next") continue;
      trovati.push(...sorgenti(percorso));
    } else if (percorso.endsWith(".ts") || percorso.endsWith(".tsx")) {
      trovati.push(percorso);
    }
  }
  return trovati;
}

/** Il nome della funzione chiamata, se la chiamata è un `redirect(...)` nudo. */
function eRedirect(nodo: ts.Node): boolean {
  if (!ts.isCallExpression(nodo)) return false;
  // `NextResponse.redirect(...)` restituisce una risposta, non lancia:
  // dentro un try è legittimo.
  return ts.isIdentifier(nodo.expression) && nodo.expression.text === "redirect";
}

function redirectDentroTry(percorso: string): number[] {
  const sorgente = ts.createSourceFile(
    percorso,
    readFileSync(percorso, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    percorso.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const righe: number[] = [];

  function cerca(nodo: ts.Node, dentroTry: boolean) {
    if (ts.isTryStatement(nodo)) {
      // Solo il blocco `try` è pericoloso: nel `catch` e nel `finally` il
      // redirect non viene intercettato da niente.
      cerca(nodo.tryBlock, nodo.catchClause !== undefined);
      if (nodo.catchClause) ts.forEachChild(nodo.catchClause, (f) => cerca(f, dentroTry));
      if (nodo.finallyBlock) cerca(nodo.finallyBlock, dentroTry);
      return;
    }
    if (dentroTry && eRedirect(nodo)) {
      righe.push(sorgente.getLineAndCharacterOfPosition(nodo.getStart()).line + 1);
    }
    ts.forEachChild(nodo, (f) => cerca(f, dentroTry));
  }

  cerca(sorgente, false);
  return righe;
}

describe("redirect() non va chiamato dentro un try", () => {
  it("nessun file lo fa", () => {
    const colpevoli = RADICI.flatMap(sorgenti)
      .map((percorso) => ({ percorso, righe: redirectDentroTry(percorso) }))
      .filter((f) => f.righe.length > 0)
      .map((f) => `${f.percorso}:${f.righe.join(",")}`);

    expect(colpevoli).toEqual([]);
  });

  it("il controllo trova davvero il difetto che deve trovare", () => {
    // Senza questa prova, un errore nel visitatore renderebbe il test sopra
    // verde per sempre e silenzioso.
    const finto = ts.createSourceFile(
      "finto.ts",
      `async function f() { try { await g(); redirect("/ok"); } catch { redirect("/ko"); } }`,
      ts.ScriptTarget.ESNext,
      true,
    );
    let dentro = 0;
    let fuori = 0;
    (function cerca(nodo: ts.Node, dentroTry: boolean) {
      if (ts.isTryStatement(nodo)) {
        cerca(nodo.tryBlock, nodo.catchClause !== undefined);
        if (nodo.catchClause) ts.forEachChild(nodo.catchClause, (f) => cerca(f, dentroTry));
        return;
      }
      if (eRedirect(nodo)) (dentroTry ? dentro++ : fuori++);
      ts.forEachChild(nodo, (f) => cerca(f, dentroTry));
    })(finto, false);

    expect(dentro).toBe(1);
    expect(fuori).toBe(1);
  });
});
