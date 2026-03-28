import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/env";
import type { Role, SessionUser } from "@/lib/types";

interface RequiredUserContext {
  authEnabled: boolean;
  user: SessionUser;
}

interface OptionalUserContext {
  authEnabled: boolean;
  user: SessionUser | null;
}

export async function getUserContext(options?: { required?: true }): Promise<RequiredUserContext>;
export async function getUserContext(options: { required: false }): Promise<OptionalUserContext>;
export async function getUserContext(options: { required?: boolean } = {}) {
  if (!isAuthConfigured()) {
    return {
      authEnabled: false,
      user: {
        name: "Điều phối demo",
        email: "admin@nurseflow.local",
        role: "admin" as Role,
        image: null,
        demo: true,
      },
    };
  }

  const session = await auth();
  if (!session?.user) {
    if (options.required ?? true) {
      redirect("/sign-in");
    }

    return {
      authEnabled: true,
      user: null,
    };
  }

  const user: SessionUser = {
    name: session.user.name ?? session.user.email ?? "Người dùng",
    email: session.user.email ?? "",
    role: session.user.role ?? "viewer",
    image: session.user.image,
    demo: false,
  };

  return {
    authEnabled: true,
    user,
  };
}

export function canEdit(role: Role) {
  return role === "admin" || role === "coordinator";
}
