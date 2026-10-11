"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { appearanceEvent, applyAppearance, readAppearance, saveAppearance, type Appearance } from "@/lib/appearance";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceControl({ placement }: { placement: "public" | "workspace" | "auth" }) {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>("system");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => { const next = readAppearance(); applyAppearance(next); setAppearance(next); };
    const media = matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => { if (readAppearance() === "system") applyAppearance("system"); };
    const frame = requestAnimationFrame(sync);
    window.addEventListener(appearanceEvent, sync);
    window.addEventListener("storage", sync);
    media.addEventListener("change", syncSystem);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(appearanceEvent, sync);
      window.removeEventListener("storage", sync);
      media.removeEventListener("change", syncSystem);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      } else if (event instanceof MouseEvent && !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const Icon = options.find((option) => option.value === appearance)?.icon || Monitor;
  return <div className={`appearance-control appearance-control-${placement}`} ref={root}>
    <button ref={trigger} type="button" className="appearance-trigger" aria-label={`Appearance: ${appearance}. Choose light, dark or system theme`} aria-expanded={open} aria-controls={open ? "appearance-options" : undefined} onClick={() => setOpen((value) => !value)}>
      <Icon size={17} aria-hidden="true" /><span>Appearance</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div id="appearance-options" className="appearance-menu" role="group" aria-label="Appearance">
      {options.map(({ value, label, icon: OptionIcon }) => <button key={value} type="button" aria-pressed={appearance === value} onClick={() => { saveAppearance(value); setAppearance(value); setOpen(false); trigger.current?.focus(); }}>
        <OptionIcon size={17} aria-hidden="true" /><span>{label}</span>{appearance === value && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
