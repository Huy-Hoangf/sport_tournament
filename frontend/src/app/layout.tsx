import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sport Tournament",
  description: "Tournament management, match schedules, and predictions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
