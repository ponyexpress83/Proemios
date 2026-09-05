import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * I test unitari girano sempre e non toccano nulla di esterno.
 *
 * I test di integrazione (`tests/integrazione/`) hanno bisogno di un Postgres
 * vero e vengono eseguiti solo con `TEST_DATABASE_URL` impostata:
 *
 *   npm run db:up && npm run test:integrazione
 *
 * Non usano mock del database. Un mock che accetta qualunque query non prova
 * che l'isolamento fra tenant funzioni — e l'isolamento fra tenant è
 * esattamente ciò che quei test devono dimostrare.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: process.env.TEST_DATABASE_URL
      ? ["node_modules/**"]
      : ["node_modules/**", "tests/integrazione/**"],
    // I test di integrazione condividono un database: eseguirli in parallelo
    // significherebbe farli inciampare l'uno nei dati dell'altro.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    testTimeout: 20_000,
  },
});
