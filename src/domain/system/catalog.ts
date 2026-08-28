export interface ArchitectureArea {
  name: string;
  path: string;
  purpose: string;
}

export interface PlatformPrinciple {
  title: string;
  description: string;
}

export const platformPrinciples: PlatformPrinciple[] = [
  {
    title: "Strict by default",
    description:
      "TypeScript, linting, formatting, and environment validation are part of the baseline, not add-ons.",
  },
  {
    title: "Thin delivery layers",
    description:
      "App routes render and respond, while orchestration and domain concerns live in dedicated modules.",
  },
  {
    title: "Optional integrations",
    description:
      "Database, AI, and external systems remain explicit and unconfigured until real providers are selected.",
  },
];

export const architectureAreas: ArchitectureArea[] = [
  {
    name: "Routes",
    path: "src/app",
    purpose: "App Router entrypoints, layouts, pages, and HTTP handlers.",
  },
  {
    name: "UI primitives",
    path: "src/components/ui",
    purpose: "Reusable presentation components with no domain assumptions.",
  },
  {
    name: "Layout",
    path: "src/components/layout",
    purpose: "Page shells and composition helpers used across app routes.",
  },
  {
    name: "Domain",
    path: "src/domain",
    purpose: "Framework-agnostic models and repository architecture metadata.",
  },
  {
    name: "Server services",
    path: "src/server/services",
    purpose:
      "Server-side orchestration that composes domain and infrastructure boundaries.",
  },
  {
    name: "Database",
    path: "src/db",
    purpose:
      "Database bootstrapping and migration entrypoints without binding to a vendor yet.",
  },
  {
    name: "Shared library",
    path: "src/lib",
    purpose: "Environment validation and other cross-cutting runtime helpers.",
  },
  {
    name: "Jobs",
    path: "src/jobs",
    purpose: "Background job registration surface for future scheduled work.",
  },
  {
    name: "Integrations",
    path: "src/integrations",
    purpose:
      "External system registration surface with no hard-coded providers.",
  },
  {
    name: "AI",
    path: "src/ai",
    purpose:
      "AI provider registration surface with environment-gated configuration only.",
  },
  {
    name: "Tests",
    path: "tests",
    purpose:
      "Executable validation for runtime configuration and service behavior.",
  },
  {
    name: "Docs",
    path: "docs",
    purpose:
      "Architecture and operational guidance for future implementation work.",
  },
];
