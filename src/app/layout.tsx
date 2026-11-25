import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF 요약",
  description: "강의 자료와 논문 PDF를 한국어로 요약해 드려요",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
