import { defineConfig, presetWind4 } from "unocss";

// Design tokens live as CSS variables in src/styles/theme.css (single source
// of truth for the dark, technical/observability palette described in the
// spec) and are exposed here as named UnoCSS colors so utilities like
// `bg-surface` / `text-muted` / `border-edge` stay readable instead of
// reaching for raw hex values or `var(--...)` everywhere.
export default defineConfig({
  presets: [presetWind4({ dark: "class" })],
  theme: {
    colors: {
      bg: "var(--aw-bg)",
      surface: "var(--aw-surface)",
      surface2: "var(--aw-surface-2)",
      edge: "var(--aw-border)",
      text: "var(--aw-text)",
      muted: "var(--aw-muted)",
      accent: "var(--aw-accent)",
      "accent-dim": "var(--aw-accent-dim)",
      success: "var(--aw-success)",
      "success-dim": "var(--aw-success-dim)",
      danger: "var(--aw-danger)",
      "danger-dim": "var(--aw-danger-dim)",
      warning: "var(--aw-warning)",
      "warning-dim": "var(--aw-warning-dim)",
    },
    fontFamily: {
      sans: [
        "ui-sans-serif",
        "system-ui",
        "-apple-system",
        "Segoe UI",
        "Roboto",
        "Helvetica Neue",
        "Arial",
        "sans-serif",
      ].join(","),
      mono: [
        "ui-monospace",
        "SF Mono",
        "Cascadia Code",
        "Roboto Mono",
        "Menlo",
        "Consolas",
        "Liberation Mono",
        "monospace",
      ].join(","),
    },
  },
  shortcuts: {
    // Surfaces
    "card-base": "rounded-xl border border-edge bg-surface",
    "card-interactive": "card-base transition-colors hover:border-accent/40 hover:bg-surface2",

    // Buttons
    "btn-base":
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
    "btn-primary": "btn-base bg-accent text-bg hover:opacity-90",
    "btn-secondary": "btn-base border border-edge text-text hover:bg-surface2",
    "btn-danger": "btn-base bg-danger text-white hover:opacity-90",
    "btn-ghost": "btn-base text-muted hover:bg-surface2 hover:text-text",
    "icon-btn":
      "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",

    // Form controls
    "input-base":
      "w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-text outline-none transition placeholder:text-muted focus:border-accent",
    "label-base": "mb-1.5 block text-sm font-medium text-text",
    "field-hint": "mt-1.5 text-xs text-muted",

    // Typography helpers
    "mono-value": "font-mono tabular-nums",
    "section-title": "text-lg font-semibold text-text",
    "page-title": "text-2xl font-semibold text-text",

    // Status colors (never the only signal -- always paired with text/icon)
    "status-up": "text-success",
    "status-down": "text-danger",
    "status-paused": "text-muted",
    "status-unknown": "text-warning",
  },
});
