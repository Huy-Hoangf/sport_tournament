import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TWENTY-TECH Auth",
  description: "Authentication UI",
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
