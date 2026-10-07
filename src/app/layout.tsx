import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "DukaanSaathi AI — Your store, understood by voice",
  description: "A multilingual AI copilot for Indian retailers to manage inventory, khata and sales through natural conversation. Explore the offline mock experience.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
