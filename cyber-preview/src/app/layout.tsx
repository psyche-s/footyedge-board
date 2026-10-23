import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FootyEdge — Cyber Minimal | Preview",
  description: "Isolated FootyEdge tactical dashboard preview. No production changes."
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">{children}</body></html>;
}