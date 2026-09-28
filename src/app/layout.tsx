import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s — Logements vacants", default: "Logements vacants" },
  description: "Gestion des logements vacants",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1d4e89",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
