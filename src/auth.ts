import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env, isAuthConfigured } from "@/lib/env";
import { getAppData } from "@/lib/repository";
import type { Role } from "@/lib/types";

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
  session: { strategy: "jwt" },
  providers,
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
  },
});

