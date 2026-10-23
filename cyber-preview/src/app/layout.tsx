import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FootyEdge Command — Match Intelligence | Design Preview",
  description: "FootyEdge Command: premium match intelligence, researched selections, tactical views and verified data. Isolated design preview."
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body className="min-h-screen bg-[#090d0c] text-zinc-100 antialiased">{children}</body></html>;
}
