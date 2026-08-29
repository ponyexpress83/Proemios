"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE, type LeadAttribution } from "@/lib/attribution";

const PARAMS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
  gclid: "gclid",
  fbclid: "fbclid",
} as const;

function readExisting(): LeadAttribution {
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ATTRIBUTION_COOKIE}=`))
    ?.slice(ATTRIBUTION_COOKIE.length + 1);

  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw)) as LeadAttribution;
  } catch {
    return {};
  }
}

export function AttributionCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const existing = readExisting();
    const referrer = document.referrer.slice(0, 500) || undefined;
    const next: LeadAttribution = {
      ...existing,
      landingPath: existing.landingPath ?? `${url.pathname}${url.search}`.slice(0, 500),
      referrer: existing.referrer ?? referrer,
      firstSeenAt: existing.firstSeenAt ?? new Date().toISOString(),
    };

    let hasCampaignData = false;
    for (const [queryKey, targetKey] of Object.entries(PARAMS)) {
      const value = url.searchParams.get(queryKey)?.trim();
      if (value) {
        next[targetKey as keyof LeadAttribution] = value.slice(0, 500);
        hasCampaignData = true;
      }
    }

    if (!hasCampaignData && Object.keys(existing).length > 0) return;

    const encoded = encodeURIComponent(JSON.stringify(next));
    document.cookie = `${ATTRIBUTION_COOKIE}=${encoded}; Path=/; Max-Age=7776000; SameSite=Lax; Secure`;
  }, []);

  return null;
}
