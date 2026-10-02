import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가을의 온도 · 오늘의 진짜 정보판",
  description: "대전 관측소의 최신 실측 기온과 실제 일별 기록, 실패와 복구를 보여 주는 정보판.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
