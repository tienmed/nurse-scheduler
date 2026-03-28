import { z } from "zod";

const envSchema = z.object({
  AUTH_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_ENFORCE_ALLOWLIST: z
    .enum(["true", "false"])
    .optional()
    .default("true"),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  AUTHORIZED_ADMIN_EMAILS: z.string().optional(),
  AUTHORIZED_COORDINATOR_EMAILS: z.string().optional(),
  AUTHORIZED_VIEWER_EMAILS: z.string().optional(),
});

const parsed = envSchema.parse({
  AUTH_URL: process.env.AUTH_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  AUTH_ENFORCE_ALLOWLIST: process.env.AUTH_ENFORCE_ALLOWLIST,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  AUTHORIZED_ADMIN_EMAILS: process.env.AUTHORIZED_ADMIN_EMAILS,
  AUTHORIZED_COORDINATOR_EMAILS: process.env.AUTHORIZED_COORDINATOR_EMAILS,
  AUTHORIZED_VIEWER_EMAILS: process.env.AUTHORIZED_VIEWER_EMAILS,
});

const splitEmails = (value?: string) =>
  value
    ?.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? [];

export const env = {
  ...parsed,
  AUTHORIZED_ADMIN_EMAILS: splitEmails(parsed.AUTHORIZED_ADMIN_EMAILS),
  AUTHORIZED_COORDINATOR_EMAILS: splitEmails(
    parsed.AUTHORIZED_COORDINATOR_EMAILS,
  ),
  AUTHORIZED_VIEWER_EMAILS: splitEmails(parsed.AUTHORIZED_VIEWER_EMAILS),
};

export function isAuthConfigured() {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

export function getCanonicalAuthUrl() {
  return env.AUTH_URL?.replace(/\/$/, "");
}

export function isSheetsConfigured() {
  return Boolean(
    env.GOOGLE_SHEET_ID &&
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

export function getServiceAccountPrivateKey() {
  return env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

