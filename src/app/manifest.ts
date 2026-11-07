import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NurseFlow - Phân công lịch điều dưỡng",
    short_name: "NurseFlow",
    description: "Ứng dụng phân công và quản lý ca trực điều dưỡng thông minh",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    shortcuts: [
      {
        name: "Lịch trực của tôi",
        short_name: "Lịch của tôi",
        description: "Xem vị trí phân công và ca trực cá nhân hôm nay & trong tuần",
        url: "/dang-ky-phep?tab=my-schedule",
        icons: [{ src: "/favicon.ico", sizes: "any" }],
      },
      {
        name: "Đăng ký nghỉ phép",
        short_name: "Đăng ký phép",
        description: "Gửi đơn xin nghỉ phép nhanh chóng trực tiếp từ di động",
        url: "/dang-ky-phep?tab=register",
        icons: [{ src: "/favicon.ico", sizes: "any" }],
      },
    ],
  };
}
