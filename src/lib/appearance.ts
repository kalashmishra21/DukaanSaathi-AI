export type Appearance = "light" | "dark" | "system";

export const appearanceEvent = "dukaansaathi-appearance-change";

export function readAppearance(): Appearance {
  try {
    const value = localStorage.getItem("dukaansaathi-theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyAppearance(next: Appearance) {
  document.documentElement.dataset.theme = next === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : next;
}

export function saveAppearance(next: Appearance) {
  try { localStorage.setItem("dukaansaathi-theme", next); } catch { /* This session still updates. */ }
  applyAppearance(next);
  window.dispatchEvent(new Event(appearanceEvent));
}
