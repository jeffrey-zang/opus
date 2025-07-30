import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opus",
  description: "On-device computer use agent that runs fully in the background"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
