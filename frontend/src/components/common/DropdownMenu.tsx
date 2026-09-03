import { useEffect, useRef, useState, type ReactNode } from "react";

export function DropdownMenu({
  trigger,
  label = "More actions",
  children,
}: {
  trigger: ReactNode;
  label?: string;
  children: ReactNode;
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="icon-btn"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(false);
          }}
          className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-edge bg-surface py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  onClick,
  danger = false,
  icon,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-surface2 ${
        danger ? "text-danger" : "text-text"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
