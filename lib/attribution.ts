export const ATTRIBUTION_COOKIE = "proemios_attribution";

export type LeadAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  landingPath?: string;
  referrer?: string;
  firstSeenAt?: string;
};

const MAX_VALUE = 500;

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, MAX_VALUE);
  return normalized || undefined;
}

export function sanitizeAttribution(input: unknown): LeadAttribution | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const result: LeadAttribution = {
    utmSource: clean(raw.utmSource),
    utmMedium: clean(raw.utmMedium),
    utmCampaign: clean(raw.utmCampaign),
    utmContent: clean(raw.utmContent),
    utmTerm: clean(raw.utmTerm),
    gclid: clean(raw.gclid),
    fbclid: clean(raw.fbclid),
    landingPath: clean(raw.landingPath),
    referrer: clean(raw.referrer),
    firstSeenAt: clean(raw.firstSeenAt),
  };

  return Object.values(result).some(Boolean) ? result : null;
}

export function attributionFromRequest(req: Request): LeadAttribution | null {
  const cookie = req.headers.get("cookie") ?? "";
  const encoded = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`))
    ?.slice(ATTRIBUTION_COOKIE.length + 1);

  if (!encoded) return null;

  try {
    const decoded = decodeURIComponent(encoded);
    return sanitizeAttribution(JSON.parse(decoded));
  } catch {
    return null;
  }
}

/**
 * Score operativo, non predittivo: serve solo a dare priorita alle call.
 * Il commerciale puo sempre ignorarlo o sovrascriverlo.
 */
export function scoreLead(params: {
  hasPhone?: boolean;
  wordCount?: number;
  projectType?: string;
  urgency?: string;
  requestedServices?: number;
  noteLength?: number;
}): number {
  let score = 20;
  if (params.hasPhone) score += 15;
  if ((params.wordCount ?? 0) >= 20_000) score += 15;
  if ((params.wordCount ?? 0) >= 60_000) score += 10;
  if (params.projectType === "memoir" || params.projectType === "libro-professionale") score += 15;
  if (params.urgency === "prioritaria") score += 10;
  if ((params.requestedServices ?? 0) >= 3) score += 10;
  if ((params.noteLength ?? 0) >= 120) score += 5;
  return Math.min(100, score);
}
