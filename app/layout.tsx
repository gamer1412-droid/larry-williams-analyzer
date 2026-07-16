import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "บันทึกวิเคราะห์แบบปู่ Larry Williams — Framework Analyzer",
  description: "ระบบวิเคราะห์การลงทุนตามกรอบแนวคิด Larry Williams (หุ้น, ออปชั่น, ฟิวเจอร์ส, คริปโต, ฟอเร็กซ์)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[#0F1419] text-[#E8E3D8] antialiased selection:bg-[#C9A45C]/30">
        {children}
      </body>
    </html>
  );
}
