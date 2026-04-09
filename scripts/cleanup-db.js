import { env, getServiceAccountPrivateKey } from "../src/lib/env";
import { google } from "googleapis";
import { SHEET_NAMES } from "../src/lib/constants";

async function cleanupSheets() {
    console.log("🧹 Đang khởi động dọn dẹp các hàng trống trong DB Google Sheets...");

    const auth = new google.auth.JWT({
        email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: getServiceAccountPrivateKey(),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
        console.error("Thiếu GOOGLE_SHEET_ID");
        return;
    }

    // Lấy toàn bộ dữ liệu từ tất cả các sheet
    const ranges = Object.values(SHEET_NAMES).map(name => `${name}!A:Z`);
    const res = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
    });

    const valueRanges = res.data.valueRanges || [];

    const spreadsheetMeta = await sheets.spreadsheets.get({
        spreadsheetId,
    });

    const sheetMetadataMap = new Map();
    spreadsheetMeta.data.sheets?.forEach((s) => {
        if (s.properties?.title && s.properties?.sheetId !== undefined) {
            sheetMetadataMap.set(s.properties.title, s.properties.sheetId);
        }
    });

    const updateData = [];
    const gridRequests = [];

    for (let i = 0; i < ranges.length; i++) {
        const sheetName = Object.values(SHEET_NAMES)[i];
        const sheetId = sheetMetadataMap.get(sheetName);
        if (sheetId === undefined) continue;

        const values = valueRanges[i]?.values || [];
        if (values.length <= 1) continue; // Chỉ có header hoặc trống

        const header = values[0];
        const dataRows = values.slice(1);

        // Lọc ra các dòng hợp lệ (có dữ liệu)
        const validRows = dataRows.filter(row => row.some(cell => String(cell).trim() !== ""));

        // Nếu số dòng hợp lệ ít hơn tổng số dòng, ta có dòng trống cần dọn dẹp
        if (validRows.length < dataRows.length) {
            console.log(`- Sheet "${sheetName}": Tìm thấy ${dataRows.length - validRows.length} hàng trống. Đang nén dữ liệu...`);

            const newValues = [header, ...validRows];

            // Update lại từ A1
            updateData.push({
                range: `${sheetName}!A1`,
                values: newValues,
            });

            // Clear phần còn lại (từ cuối mảng dữ liệu mới đến cuối sheet cũ)
            gridRequests.push({
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: "ROWS",
                        startIndex: newValues.length, // Xoá từ sau dòng cuối cùng
                        endIndex: Math.max(newValues.length + 1, values.length + 50),
                    },
                },
            });
        } else {
            console.log(`- Sheet "${sheetName}": Sạch sẽ!`);
        }
    }

    if (updateData.length > 0) {
        // Ghi đè lại dữ liệu nén
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "RAW",
                data: updateData,
            },
        });

        // Cắt bỏ dòng rác
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: gridRequests,
            },
        });

        console.log("✅ Dọn dẹp hoàn tất!");
    } else {
        console.log("✅ Hệ thống DB đã tối ưu, không có hàng trống dư thừa nào được tìm thấy.");
    }
}

// polyfill cho dotenv nếu chạy trực tiếp
require('dotenv').config({ path: '.env.local' });

cleanupSheets().catch(console.error);
