export const designTokens = {
  color: {
    obsidian: "#050505",
    champagne: "#bca067",
    ivory: "#f7f2e8",
    white: "#ffffff",
  },
  radius: {
    sm: "0.875rem",
    md: "1.25rem",
    lg: "1.75rem",
    xl: "2.25rem",
  },
  motion: {
    fast: "160ms ease",
    base: "220ms ease",
    reduced: "0.01ms",
  },
} as const;

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const statusToneMap: Record<StatusTone, string> = {
  neutral: "rgba(247, 242, 232, 0.16)",
  info: "rgba(111, 143, 181, 0.22)",
  success: "rgba(59, 167, 118, 0.22)",
  warning: "rgba(176, 137, 63, 0.22)",
  danger: "rgba(183, 92, 92, 0.22)",
};
