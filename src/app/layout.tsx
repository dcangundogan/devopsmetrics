import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevOps Metrikleri Dashboard",
  description:
    "Ekip DevOps sağlığı — DORA metrikleri (Jira + Jenkins) kurum içi panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
