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
  // Nếu chưa cấu hình Google OAuth trong biến môi trường, dùng tài khoản admin@nurseflow.local mặc định để phát triển
  if (!isAuthConfigured()) {
    return {
      authEnabled: false,
      user: {
        name: "Quản trị viên NurseFlow",
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

  const email = (session.user.email ?? "").trim().toLowerCase();
  const isAdminSpecial = email === "admin@nurseflow.local";

  const user: SessionUser = {
    name: session.user.name ?? session.user.email ?? "Người dùng",
    email: session.user.email ?? "",
    role: isAdminSpecial ? "admin" : (session.user.role ?? "viewer"),
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
