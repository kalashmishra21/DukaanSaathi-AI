import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./landing.css";
import "./workspace.css";
import "./assistant.css";
import "./business.css";
import "./phase9.css";

const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
});
const newsreader = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2", style: "normal", weight: "200 800" },
    { path: "../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2", style: "italic", weight: "200 800" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DukaanSaathi AI — Your store, understood by voice",
  description: "A multilingual AI copilot for Indian retailers to manage inventory, khata and sales through natural conversation and trusted store tools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${manrope.variable} ${newsreader.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('dukaansaathi-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
