import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./workspace.css";
import "./assistant.css";
import "./business.css";

export const metadata: Metadata = {
  title: "DukaanSaathi AI — Your store, understood by voice",
  description: "A multilingual AI copilot for Indian retailers to manage inventory, khata and sales through natural conversation and trusted store tools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
