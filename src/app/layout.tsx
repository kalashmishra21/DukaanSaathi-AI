import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DukaanSaathi AI — Your store, understood by voice",
  description: "A voice-first AI copilot for Indian kirana stores and small retailers. Phase 1 foundation runs in offline mock mode.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
