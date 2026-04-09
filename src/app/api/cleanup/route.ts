import { NextResponse } from "next/server";
import { readAppDataFromSheets, writeAppDataToSheets } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        console.log("🧹 Đang thực hiện Clean-up Data (Xoá dòng trống)...");

        // 1. Phục hồi và load lại toàn bộ App Data 
        // Cơ chế của readAppDataFromSheets ĐÃ lọc ra validRows và tự xoá lỗ hổng trong bộ nhớ
        const data = await readAppDataFromSheets();

        // 2. Gọi hàm ghi đè. Hàm ghi đè (writeAppDataToSheets) có logic xoá dòng thừa phía dưới (`deleteDimension`)
        // VÀ xoá các holes bên trong mảng (`clearRanges`)
        await writeAppDataToSheets(data);

        return NextResponse.json({ success: true, message: "Xóa rác và nén dòng thành công!" });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
