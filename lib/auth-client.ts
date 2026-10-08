"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { getAuth } from "./auth";
export const authClient = createAuthClient({ plugins: [inferAdditionalFields<ReturnType<typeof getAuth>>(), twoFactorClient({ onTwoFactorRedirect() { window.location.assign("/verifica-accesso"); } })] });
