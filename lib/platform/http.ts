import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { applicationOrigins } from "./config";

export class PlatformError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export const unavailable = () =>
  new PlatformError(
    503,
    "SERVICE_UNAVAILABLE",
    "Il servizio non è disponibile al momento. Riprova più tardi o contattaci.",
  );
export const notFound = () => new PlatformError(404, "NOT_FOUND", "Contenuto non trovato.");
export const forbidden = () =>
  new PlatformError(403, "FORBIDDEN", "Non hai il permesso di eseguire questa operazione.");
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof PlatformError)
        return json(
          { errore: error.message, code: error.code, fields: error.fields },
          error.status,
        );
      const requestId = randomUUID();
      console.error(
        JSON.stringify({
          evt: "platform.request.failed",
          requestId,
          error: error instanceof Error ? error.name : "Unknown",
        }),
      );
      return json(
        { errore: "Non è stato possibile completare l'operazione. Riprova.", requestId },
        500,
      );
    }
  };
}
export function checkMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !applicationOrigins().includes(origin))
    throw new PlatformError(403, "INVALID_ORIGIN", "Richiesta non autorizzata.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw forbidden();
}
export async function readBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const raw = await request.text();
  if (raw.length > 100_000)
    throw new PlatformError(413, "TOO_LARGE", "La richiesta è troppo grande.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlatformError(400, "INVALID_BODY", "Richiesta non leggibile.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) fields[issue.path.join(".")] ??= issue.message;
    throw new PlatformError(422, "VALIDATION_ERROR", "Controlla i campi indicati.", fields);
  }
  return result.data;
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function pathId(request: Request, marker: string): string {
  const parts = new URL(request.url).pathname.split("/");
  const id = parts[parts.indexOf(marker) + 1];
  if (!z.string().uuid().safeParse(id).success) throw notFound();
  return id!;
}
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
