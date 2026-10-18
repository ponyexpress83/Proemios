import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analisi/route";
import { calcolaMetriche } from "@/lib/metrics";
const previous = process.env.DEMO_MODE;
beforeEach(() => {
  process.env.DEMO_MODE = "on";
});
afterEach(() => {
  if (previous === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = previous;
  vi.restoreAllMocks();
});
async function send(file?: File, privacy = true) {
  const form = new FormData();
  form.set("nome", "Autore test");
  form.set("email", "qa@example.test");
  form.set("consensoPrivacy", String(privacy));
  form.set("consensoMarketing", "false");
  if (file) form.set("file", file);
  return POST(
    new Request("https://example.test/api/analisi", {
      method: "POST",
      body: form,
      headers: { "x-forwarded-for": crypto.randomUUID() },
    }),
  );
}
describe("confini dell’analisi con soli dati sintetici", () => {
  it("richiede privacy, file e formato supportato", async () => {
    expect((await send(undefined, false)).status).toBe(422);
    expect((await send()).status).toBe(422);
    expect((await send(new File(["test"], "test.exe"))).status).toBe(415);
  });
  it("rifiuta file oltre 4 MB e testi sotto 100 parole", async () => {
    expect((await send(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "test.txt"))).status).toBe(
      413,
    );
    expect(
      (
        await send(
          new File(["La barca tornò al molo nella luce del mattino. ".repeat(5)], "test.txt"),
        )
      ).status,
    ).toBe(422);
  });
  it("restituisce metriche reali e giudizio esplicitamente demo senza chiamare fornitori", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("External network forbidden in this test"));
    const text = "La barca tornò al molo. Il vento era caduto. ".repeat(25);
    const response = await send(new File([text], "sintetico.txt"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      demo: true,
      report: { metriche: calcolaMetriche(text) },
    });
    expect(network).not.toHaveBeenCalled();
  });
});
