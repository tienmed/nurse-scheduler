import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "NurseFlow | Phân công lịch điều dưỡng",
  description:
    "Ứng dụng lập lịch điều dưỡng theo tuần với Google OAuth, Google Sheets và xuất Excel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-slate-900">{children}</body>
    </html>
  );
}
