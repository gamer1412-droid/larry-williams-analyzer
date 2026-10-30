import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Larry Williams Analyzer — Investment Framework Tool",
  description: "Analyze stocks, options, futures, crypto, and forex using the Larry Williams investment framework. Real-time data powered by Yahoo Finance.",
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
