"use client";

import { useState } from "react";

import {
  Badge,
  BellIcon,
  Button,
  Card,
  CommandBar,
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconButton,
  Input,
  LayersIcon,
  Modal,
  SearchIcon,
  Select,
  Skeleton,
  SparkIcon,
  StatCard,
  StatusPill,
  Table,
  Tabs,
  Timeline,
  useToast,
} from "./index";

const portfolioRows = [
  {
    asset: "North End Portfolio",
    phase: "Review",
    owner: "Operations",
    priority: "High",
  },
  {
    asset: "Chelsea Houses",
    phase: "Ready",
    owner: "Demand",
    priority: "Medium",
  },
  {
    asset: "Mayfair Lets",
    phase: "Queued",
    owner: "Stock Room",
    priority: "Low",
  },
] as const;

export function DesignSystemDemo() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const { pushToast } = useToast();

  return (
    <div className="space-y-10">
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card
          actions={<Badge tone="info">Design system</Badge>}
          eyebrow="Tokens"
          footer={
            <div className="flex flex-wrap gap-3">
              <Button
                leadingIcon={<SparkIcon className="size-4" />}
                onClick={() => setModalOpen(true)}
              >
                Open modal
              </Button>
              <Button onClick={() => setDrawerOpen(true)} variant="secondary">
                Open drawer
              </Button>
              <Button onClick={() => setConfirmOpen(true)} variant="ghost">
                Confirm action
              </Button>
            </div>
          }
          title="Premium operational surfaces"
        >
          <p className="pq-copy-muted max-w-2xl text-sm leading-7">
            Obsidian surfaces, ivory typography, and champagne-gold accents are
            centralized so future screens inherit the same calm hierarchy
            without duplicating style decisions.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StatusPill tone="success">Readable contrast</StatusPill>
            <StatusPill tone="info">Visible focus</StatusPill>
            <StatusPill tone="warning">Reduced motion safe</StatusPill>
          </div>
        </Card>
        <StatCard
          change="Phase 2 ready"
          detail="Core primitives are reusable and token-driven."
          label="System status"
          tone="success"
          value="18 components"
        />
      </section>

      <CommandBar
        actions={[
          <IconButton
            icon={<SearchIcon className="size-4" />}
            key="search"
            label="Search shortcuts"
          />,
          <IconButton
            icon={<BellIcon className="size-4" />}
            key="alerts"
            label="Open notifications"
          />,
        ]}
        hint="Search command patterns, components, and tokens"
        title="Global command preview"
      />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card eyebrow="Actions" title="Buttons, badges, and status">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary action</Button>
              <Button variant="ghost">Ghost action</Button>
              <IconButton
                icon={<LayersIcon className="size-4" />}
                label="Layered action"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge>Neutral</Badge>
              <Badge tone="warning">Attention</Badge>
              <Badge tone="success">Ready</Badge>
              <StatusPill tone="danger">Escalated</StatusPill>
            </div>
          </div>
        </Card>

        <Card eyebrow="Forms" title="Input and select fields">
          <div className="space-y-4">
            <Input
              hint="Used for names, identifiers, and search patterns."
              label="Reference name"
              placeholder="PQ command token"
            />
            <Select
              hint="Native select keeps keyboard support simple and strong."
              label="Surface mode"
              options={[
                { label: "Default", value: "default" },
                { label: "Compact", value: "compact" },
                { label: "Expanded", value: "expanded" },
              ]}
            />
          </div>
        </Card>

        <Card eyebrow="Loading" title="Skeleton and empty state">
          <div className="space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-[var(--pq-radius-sm)]" />
              <Skeleton className="h-10 w-2/3 rounded-[var(--pq-radius-sm)]" />
            </div>
            <EmptyState
              actionLabel="Trigger toast"
              description="Use this when a workflow has no data yet instead of leaving a blank surface."
              icon={<SparkIcon className="size-5" />}
              onAction={() =>
                pushToast({
                  title: "Toast preview",
                  description:
                    "The toast system inherits the same tone and focus treatment.",
                  tone: "info",
                })
              }
              title="Nothing here yet"
            />
          </div>
        </Card>
      </section>

      <Tabs
        defaultValue="data"
        items={[
          {
            value: "data",
            label: "Data table",
            content: (
              <Card eyebrow="Tables" title="Structured operational data">
                <Table
                  caption="Portfolio readiness"
                  columns={[
                    { key: "asset", header: "Asset" },
                    { key: "phase", header: "Phase" },
                    { key: "owner", header: "Owner" },
                    { key: "priority", header: "Priority", align: "right" },
                  ]}
                  rows={portfolioRows}
                />
              </Card>
            ),
          },
          {
            value: "timeline",
            label: "Timeline",
            content: (
              <Card eyebrow="Timeline" title="Premium progress rhythm">
                <Timeline
                  items={[
                    {
                      id: "1",
                      title: "Token foundation",
                      description:
                        "Global palette, radii, focus states, motion defaults, and surface treatments established.",
                      meta: "Completed",
                      tone: "success",
                      aside: "Today",
                    },
                    {
                      id: "2",
                      title: "Accessible primitives",
                      description:
                        "Buttons, forms, overlays, feedback components, and display surfaces implemented without external UI kits.",
                      meta: "In review",
                      tone: "info",
                      aside: "This phase",
                    },
                    {
                      id: "3",
                      title: "Shell integration",
                      description:
                        "The next phase can consume this system without redefining color, spacing, or state patterns.",
                      meta: "Next",
                      tone: "warning",
                      aside: "Phase 3",
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
        label="Design system component previews"
      />

      <Modal
        description="The modal uses semantic dialog markup, consistent surface treatment, and a visible keyboard focus ring."
        footer={
          <Button onClick={() => setModalOpen(false)}>Close preview</Button>
        }
        onClose={() => setModalOpen(false)}
        open={isModalOpen}
        title="Modal primitive"
      >
        <p className="pq-copy-muted text-sm leading-6">
          Use this primitive for confirmations, detailed forms, and interruption
          moments that need explicit user attention.
        </p>
      </Modal>

      <Drawer
        description="The drawer shares the same token system while preserving a side-panel interaction model for mobile and secondary tasks."
        onClose={() => setDrawerOpen(false)}
        open={isDrawerOpen}
        title="Drawer primitive"
      >
        <div className="space-y-4">
          <Input label="Drawer input" placeholder="Context-specific value" />
          <Select
            label="Drawer select"
            options={[
              { label: "Option A", value: "a" },
              { label: "Option B", value: "b" },
            ]}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        confirmLabel="Approve pattern"
        description="This confirm dialog is intentionally minimal and inherits the modal primitive rather than introducing a separate styling system."
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          pushToast({
            title: "Confirmed",
            description:
              "The reusable confirm dialog triggered a shared toast.",
            tone: "success",
          });
        }}
        open={isConfirmOpen}
        title="Confirm design action"
      />
    </div>
  );
}
