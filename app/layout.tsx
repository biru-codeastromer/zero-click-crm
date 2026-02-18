import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zero-Click CRM | Hack-Nation",
  description: "Enterprise-Grade AI CRM with Vertex AI, Speech-to-Text, and BigQuery",
  openGraph: {
    title: "Zero-Click CRM",
    description: "AI voice ingestion → structured CRM entries in BigQuery, plus natural-language search.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zero-Click CRM",
    description: "AI voice ingestion → structured CRM entries in BigQuery, plus natural-language search.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
