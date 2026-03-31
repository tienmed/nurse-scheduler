import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env, getCanonicalAuthUrl, isAuthConfigured } from "@/lib/env";
import { getAppData } from "@/lib/repository";
import type { Role } from "@/lib/types";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_UPDATE_AGE = 60 * 60 * 24;
const canonicalAuthUrl = getCanonicalAuthUrl();

function resolveRedirectUrl(url: string, baseUrl: string) {
  const targetBaseUrl = canonicalAuthUrl || baseUrl;

  if (url.startsWith("/")) {
    return `${targetBaseUrl}${url}`;
  }

  try {
    const parsedUrl = new URL(url);
    const allowedOrigins = [baseUrl, canonicalAuthUrl].filter(Boolean);

    if (allowedOrigins.includes(parsedUrl.origin)) {
      return `${targetBaseUrl}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }
  } catch {
    return targetBaseUrl;
  }

  return targetBaseUrl;
}

function resolveRoleFromEnv(email: string): Role | null {
  if (env.AUTHORIZED_ADMIN_EMAILS.includes(email)) {
    return "admin";
  }

  if (env.AUTHORIZED_COORDINATOR_EMAILS.includes(email)) {
    return "coordinator";
  }

  if (env.AUTHORIZED_VIEWER_EMAILS.includes(email)) {
    return "viewer";
  }

  return null;
}

async function resolveRole(email: string): Promise<Role | null> {
  const normalized = email.toLowerCase();
  const fromEnv = resolveRoleFromEnv(normalized);
  if (fromEnv) {
    return fromEnv;
  }

  const data = await getAppData();
  const access = data.accessControl.find(
    (entry) => entry.email.toLowerCase() === normalized,
  );
  return access?.role ?? null;
}

const providers = isAuthConfigured()
  ? [
    Google({
      allowDangerousEmailAccountLinking: false,
    }),
  ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  providers,
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) {
        return false;
      }

      const resolvedRole = await resolveRole(email);
      if (resolvedRole) {
        return true;
      }

      if (env.AUTH_ENFORCE_ALLOWLIST === "false") {
        return true;
      }

      const data = await getAppData();
      return data.accessControl.length === 0;
    },
    async jwt({ token, profile }) {
      const email = profile?.email?.toLowerCase() ?? token.email?.toLowerCase();
      if (email) {
        token.role = (await resolveRole(email)) ?? "viewer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as Role | undefined) ?? "viewer";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return resolveRedirectUrl(url, baseUrl);
    },
  },
});

