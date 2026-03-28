import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "vietnamese"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "NurseFlow | PhÃƒÂ¢n cÃƒÂ´ng l?ch di?u du?ng",
  description:
    "?ng d?ng l?p l?ch di?u du?ng theo tu?n v?i Google OAuth, Google Sheets vÃƒÂ  xu?t Excel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-slate-900">{children}</body>
    </html>
  );
}

