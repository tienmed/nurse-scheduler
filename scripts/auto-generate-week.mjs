import { startOfWeek, format, addDays } from "date-fns";

async function main() {
  console.log("--- Bắt đầu tiến trình tự động sinh lịch tuần ---");

  // Nếu chạy vào Chủ nhật, chúng ta muốn sinh lịch cho tuần TỚI (bắt đầu từ Thứ 2 ngày mai)
  // Nếu chạy vào Thứ 2-Thứ 7, sinh lịch cho tuần HIỆN TẠI
  const now = new Date();
  
  // Tính ngày cần xem xét (nếu là CN thì lấy ngày mai, nếu không thì lấy hôm nay)
  const targetDate = now.getDay() === 0 ? addDays(now, 1) : now;
  
  const weekStart = format(startOfWeek(targetDate, { weekStartsOn: 1 }), "yyyy-MM-dd");

  console.log(`Đang gọi API sinh lịch cho tuần: ${weekStart}...`);

  try {
    const res = await fetch(`http://localhost:3000/api/schedule/generate?week=${weekStart}`);
    const data = await res.json();
    
    if (data.success) {
      if (data.count > 0) {
        console.log(`✅ Thành công! Đã tự động sinh ${data.count} ca cho tuần ${weekStart}.`);
      } else {
        console.log(`✅ Lịch tuần ${weekStart} đã tồn tại (hoặc không có ca nào được sinh). Bỏ qua.`);
      }
    } else {
      console.error(`❌ Lỗi từ API:`, data.error);
    }
  } catch (error) {
    console.error("❌ Không thể kết nối tới server Next.js. Vui lòng đảm bảo ứng dụng đang chạy ở port 3000.");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Lỗi script:", err);
  process.exit(1);
});
