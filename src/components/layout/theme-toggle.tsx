"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      try { if (localStorage.getItem("dukaansaathi-theme")) return; } catch { /* Use system preference. */ }
      root.dataset.theme = media.matches ? "dark" : "light";
    };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("dukaansaathi-theme", next); } catch { /* Private browsing still permits this session. */ }
  }

  return <button className="workspace-theme-toggle" type="button" onClick={toggle} aria-label="Toggle light or dark theme" title="Toggle color theme">
    <Moon className="theme-light-icon" size={17} aria-hidden="true" />
    <Sun className="theme-dark-icon" size={17} aria-hidden="true" />
    <span className="theme-light-label">Dark</span>
    <span className="theme-dark-label">Light</span>
  </button>;
}
