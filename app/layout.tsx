import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOS — Pick up where you left off",
  description: "A workspace for continuous project, code, and learning context.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#080b10]">{children}</body>
    </html>
  );
}
