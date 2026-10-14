import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Reminder",
  description: "A personal study companion for students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
