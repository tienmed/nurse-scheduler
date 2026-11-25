import { NextResponse } from "next/server";
import { getUserContext } from "@/lib/session";
import { getAppData } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, authEnabled } = await getUserContext({ required: false });
    const data = await getAppData();

    let staff = null;
    if (user?.email) {
      staff = data.staff.find((s) => s.email.toLowerCase() === user.email.toLowerCase());
    }

    return NextResponse.json({
      authEnabled,
      user,
      staff,
      accessControl: data.accessControl.map((a) => ({ email: a.email, role: a.role })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
