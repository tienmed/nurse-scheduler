import { NextResponse } from "next/server";
import { generateWeekIfEmpty } from "@/lib/repository";
import { getWeekStart } from "@/lib/date";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const forceWeek = url.searchParams.get("week");
        const weekStart = forceWeek || getWeekStart();
        
        console.log(`🚀 [API] Yêu cầu tự động sinh lịch tuần cho: ${weekStart}`);
        const generated = await generateWeekIfEmpty(weekStart);

        if (generated.length > 0) {
            revalidatePath("/");
            revalidatePath("/schedule");
        }

        return NextResponse.json({ success: true, count: generated.length, weekStart });
    } catch (error: any) {
        console.error("🚨 [API] Lỗi sinh lịch tự động:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
