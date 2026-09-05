import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/** A custom-themed replacement for a native <select> -- a native select's
 * trigger box can be styled, but its open popup is drawn by the browser/OS
 * and doesn't follow the app's palette (`color-scheme` gets it into the
 * right ballpark for dark/light, but not the exact surface/accent tokens
 * every other menu in the app uses). Same open/close mechanics as
 * DropdownMenu -- click the trigger, click outside or Escape to close --
 * just with a single selected value and a visible current-value label
 * instead of an icon-only trigger. */
export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`input-base flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-10 mt-1 max-h-60 w-full min-w-max overflow-auto rounded-lg border border-edge bg-surface py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface2 ${
                  isSelected ? "text-accent" : "text-text"
                }`}
              >
                <Check size={14} className={`shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
