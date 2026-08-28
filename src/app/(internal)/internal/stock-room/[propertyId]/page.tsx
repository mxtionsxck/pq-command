import { notFound } from "next/navigation";
import Image from "next/image";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  AuditTimeline,
  Badge,
  Button,
  Card,
  EmptyState,
  Tabs,
} from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { createPropertyRoomService } from "@/server/services/property-room-service";

import {
  archivePropertyDocumentAction,
  archivePropertyMediaAction,
  transitionPropertyStatusAction,
  updatePropertyMediaAction,
  updatePropertyRoomAction,
  uploadPropertyDocumentAction,
  uploadPropertyMediaAction,
} from "./actions";

type PropertyRoomPageProps = Readonly<{
  params: Promise<{
    propertyId: string;
  }>;
}>;

function pounds(value: number | null) {
  if (value === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("en-GB") : "Not set";
}

export default async function PropertyRoomPage({
  params,
}: PropertyRoomPageProps) {
  const { propertyId } = await params;

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          description="Configure DATABASE_URL to view and manage a real Property Room."
          title="Property Room unavailable"
        />
      </AppShell>
    );
  }

  const propertyRoomService = createPropertyRoomService();
  const room = await propertyRoomService.getPropertyRoom(propertyId);

  if (!room) {
    notFound();
  }

  const activity = await propertyRoomService.listPropertyActivity(propertyId);
  const heroMedia =
    room.media.find((item) => item.isHero) ?? room.media[0] ?? null;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Property Room"
          title={room.property.title}
          description={`${room.property.addressLine1}, ${room.property.city}, ${room.property.postcode}`}
        />

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card title="Quick actions">
            <div className="space-y-4">
              <div
                className="relative h-64 overflow-hidden rounded-[var(--pq-radius-lg)] border border-[color:var(--pq-border)] bg-[color:var(--pq-surface)]"
              >
                {heroMedia ? (
                  <Image
                    alt={heroMedia.altText ?? `${room.property.title} hero image`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 70vw"
                    src={heroMedia.publicUrl}
                    style={{ objectFit: "cover" }}
                  />
                ) : null}
                {!heroMedia ? (
                  <div className="flex h-full items-center justify-center text-sm pq-copy-subtle">
                    No hero image selected
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge tone="success">{room.property.status}</Badge>
                <Badge tone="info">{room.property.propertyType}</Badge>
                <Badge tone="warning">
                  PQ Fit: {room.property.companyLetFit}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Set draft", status: "draft" },
                  { label: "Activate", status: "active" },
                  { label: "Off market", status: "off_market" },
                  { label: "Archive", status: "archived" },
                ].map((option) => (
                  <form
                    action={transitionPropertyStatusAction}
                    key={option.status}
                  >
                    <input
                      name="propertyId"
                      type="hidden"
                      value={room.property.id}
                    />
                    <input name="status" type="hidden" value={option.status} />
                    <Button
                      type="submit"
                      variant={
                        option.status === room.property.status
                          ? "primary"
                          : "secondary"
                      }
                    >
                      {option.label}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Commercial summary">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="pq-copy-subtle">Rent</dt>
                <dd>{pounds(room.property.monthlyRentCents)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="pq-copy-subtle">Deposit</dt>
                <dd>{pounds(room.property.depositCents)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="pq-copy-subtle">Term</dt>
                <dd>
                  {room.property.termMonths
                    ? `${room.property.termMonths} months`
                    : "Not set"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="pq-copy-subtle">Availability</dt>
                <dd>{room.property.availability}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="pq-copy-subtle">Available from</dt>
                <dd>{formatDate(room.property.availableFrom)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="pq-copy-subtle">Bills</dt>
                <dd>{room.property.billsSummary ?? "Not set"}</dd>
              </div>
            </dl>
          </Card>
        </section>

        <Tabs
          defaultValue="overview"
          label="Property room tabs"
          items={[
            {
              value: "overview",
              label: "Overview",
              content: (
                <Card title="Overview">
                  <form
                    action={updatePropertyRoomAction}
                    className="grid gap-3 md:grid-cols-2"
                  >
                    <input
                      name="propertyId"
                      type="hidden"
                      value={room.property.id}
                    />
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">Title</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.title}
                        name="title"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">Borough</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.borough ?? ""}
                        name="borough"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">
                        Address line 1
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.addressLine1}
                        name="addressLine1"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">
                        Address line 2
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.addressLine2 ?? ""}
                        name="addressLine2"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">City</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.city}
                        name="city"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">Postcode</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.postcode}
                        name="postcode"
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-xs pq-copy-subtle">Summary</span>
                      <textarea
                        className="min-h-28 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-3 text-white"
                        defaultValue={room.property.summary ?? ""}
                        name="summary"
                      />
                    </label>
                    <div>
                      <Button type="submit">Save overview</Button>
                    </div>
                  </form>
                </Card>
              ),
            },
            {
              value: "commercial",
              label: "Commercial",
              content: (
                <Card title="Commercial details">
                  <form
                    action={updatePropertyRoomAction}
                    className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
                  >
                    <input
                      name="propertyId"
                      type="hidden"
                      value={room.property.id}
                    />
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">Rent GBP</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={
                          room.property.monthlyRentCents
                            ? String(room.property.monthlyRentCents / 100)
                            : ""
                        }
                        name="monthlyRent"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">
                        Deposit GBP
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={
                          room.property.depositCents
                            ? String(room.property.depositCents / 100)
                            : ""
                        }
                        name="deposit"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">
                        Term months
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.termMonths ?? ""}
                        name="termMonths"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">
                        Availability
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.availability}
                        name="availability"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">
                        Available from
                      </span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={
                          room.property.availableFrom
                            ? room.property.availableFrom
                                .toISOString()
                                .slice(0, 10)
                            : ""
                        }
                        name="availableFrom"
                        type="date"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs pq-copy-subtle">PQ Fit</span>
                      <input
                        className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                        defaultValue={room.property.companyLetFit}
                        name="companyLetFit"
                      />
                    </label>
                    <label className="space-y-2 lg:col-span-3">
                      <span className="text-xs pq-copy-subtle">
                        Bills summary
                      </span>
                      <textarea
                        className="min-h-28 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-3 text-white"
                        defaultValue={room.property.billsSummary ?? ""}
                        name="billsSummary"
                      />
                    </label>
                    <div>
                      <Button type="submit">Save commercial</Button>
                    </div>
                  </form>
                </Card>
              ),
            },
            {
              value: "gallery",
              label: "Gallery",
              content: (
                <div className="space-y-4">
                  <Card title="Upload media">
                    <form
                      action={uploadPropertyMediaAction}
                      className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
                    >
                      <input
                        name="propertyId"
                        type="hidden"
                        value={room.property.id}
                      />
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-xs pq-copy-subtle">
                          Media file
                        </span>
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                          name="mediaFile"
                          type="file"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs pq-copy-subtle">Caption</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          name="caption"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs pq-copy-subtle">Alt text</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          name="altText"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs pq-copy-subtle">Order</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue="0"
                          name="sortOrder"
                          type="number"
                        />
                      </label>
                      <div>
                        <Button type="submit">Upload media</Button>
                      </div>
                    </form>
                  </Card>
                  {room.media.length === 0 ? (
                    <EmptyState
                      title="No gallery media"
                      description="No property media has been uploaded yet."
                    />
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {room.media.map((item) => (
                        <Card
                          key={item.id}
                          title={item.originalFilename}
                          eyebrow={item.isHero ? "Hero image" : "Media"}
                        >
                          <div className="space-y-4 text-sm">
                            <div
                              className="relative h-56 overflow-hidden rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)]"
                            >
                              <Image
                                alt={item.altText ?? item.originalFilename}
                                fill
                                sizes="(max-width: 1280px) 100vw, 50vw"
                                src={item.publicUrl}
                                style={{ objectFit: "cover" }}
                              />
                            </div>
                            <p className="pq-copy-muted">
                              {item.caption ?? "No caption set."}
                            </p>
                            <form
                              action={updatePropertyMediaAction}
                              className="grid gap-3 md:grid-cols-2"
                            >
                              <input
                                name="propertyId"
                                type="hidden"
                                value={room.property.id}
                              />
                              <input
                                name="mediaId"
                                type="hidden"
                                value={item.id}
                              />
                              <label className="space-y-2">
                                <span className="text-xs pq-copy-subtle">
                                  Caption
                                </span>
                                <input
                                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                                  defaultValue={item.caption ?? ""}
                                  name="caption"
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-xs pq-copy-subtle">
                                  Alt text
                                </span>
                                <input
                                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                                  defaultValue={item.altText ?? ""}
                                  name="altText"
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-xs pq-copy-subtle">
                                  Order
                                </span>
                                <input
                                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                                  defaultValue={item.sortOrder}
                                  name="sortOrder"
                                  type="number"
                                />
                              </label>
                              <label className="flex items-center gap-3 text-sm text-white">
                                <input
                                  defaultChecked={item.isHero}
                                  name="isHero"
                                  type="checkbox"
                                />{" "}
                                Hero image
                              </label>
                              <div className="flex flex-wrap gap-3 md:col-span-2">
                                <Button type="submit" variant="secondary">
                                  Save media
                                </Button>
                              </div>
                            </form>
                            <form action={archivePropertyMediaAction}>
                              <input
                                name="propertyId"
                                type="hidden"
                                value={room.property.id}
                              />
                              <input
                                name="mediaId"
                                type="hidden"
                                value={item.id}
                              />
                              <Button type="submit" variant="ghost">
                                Archive media
                              </Button>
                            </form>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              value: "documents",
              label: "Documents",
              content: (
                <div className="space-y-4">
                  <Card title="Upload document">
                    <form
                      action={uploadPropertyDocumentAction}
                      className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
                    >
                      <input
                        name="propertyId"
                        type="hidden"
                        value={room.property.id}
                      />
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-xs pq-copy-subtle">
                          Document file
                        </span>
                        <input
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                          name="documentFile"
                          type="file"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs pq-copy-subtle">Title</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          name="title"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs pq-copy-subtle">Type</span>
                        <select
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue="other"
                          name="documentType"
                        >
                          <option value="brochure">brochure</option>
                          <option value="compliance">compliance</option>
                          <option value="contract">contract</option>
                          <option value="floorplan">floorplan</option>
                          <option value="photo_pack">photo_pack</option>
                          <option value="other">other</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs pq-copy-subtle">Version</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue="1"
                          name="versionNumber"
                          type="number"
                        />
                      </label>
                      <div>
                        <Button type="submit">Upload document</Button>
                      </div>
                    </form>
                  </Card>
                  {room.documents.length === 0 ? (
                    <EmptyState
                      title="No documents"
                      description="No property documents have been uploaded yet."
                    />
                  ) : (
                    <div className="grid gap-4">
                      {room.documents.map((item) => (
                        <Card
                          key={item.id}
                          title={item.title}
                          eyebrow={item.documentType}
                        >
                          <div className="flex flex-col gap-4 text-sm md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <p className="pq-copy-muted">
                                Version {item.versionNumber}
                              </p>
                              <p className="pq-copy-muted">
                                Uploaded by:{" "}
                                {item.uploadedByUserId ?? "Unknown"}
                              </p>
                              <p className="pq-copy-muted">
                                Status: {item.status}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <a
                                className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                                href={item.viewUrl}
                                target="_blank"
                              >
                                View
                              </a>
                              <a
                                className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                                href={item.downloadUrl}
                              >
                                Download
                              </a>
                              <form action={archivePropertyDocumentAction}>
                                <input
                                  name="propertyId"
                                  type="hidden"
                                  value={room.property.id}
                                />
                                <input
                                  name="documentId"
                                  type="hidden"
                                  value={item.id}
                                />
                                <Button type="submit" variant="ghost">
                                  Archive
                                </Button>
                              </form>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              value: "owner",
              label: "Owner",
              content: room.company ? (
                <Card title={room.company.name} eyebrow="Owner / developer">
                  <div className="space-y-2 text-sm">
                    <p className="pq-copy-muted">
                      Status: {room.company.status}
                    </p>
                    <p className="pq-copy-muted">
                      Website: {room.company.website ?? "Not set"}
                    </p>
                    <p className="pq-copy-muted">
                      Notes: {room.company.notes ?? "No notes recorded."}
                    </p>
                  </div>
                </Card>
              ) : (
                <EmptyState
                  title="No owner linked"
                  description="This property is not currently linked to a company or developer record."
                />
              ),
            },
            {
              value: "ai",
              label: "AI Analysis",
              content: (
                <EmptyState
                  title="Not yet analysed"
                  description="AI analysis is intentionally not implemented in this phase. The current PQ Fit value is a manual placeholder until analysis is introduced."
                />
              ),
            },
            {
              value: "matches",
              label: "Matches",
              content: (
                <EmptyState
                  title="No matches loaded"
                  description="Property-match workflows are not populated here unless real database records exist."
                />
              ),
            },
            {
              value: "activity",
              label: "Activity",
              content:
                activity.length > 0 ? (
                  <Card title="Property timeline">
                    <AuditTimeline events={activity} />
                  </Card>
                ) : (
                  <EmptyState
                    title="No activity yet"
                    description="No audit events are currently recorded for this property."
                  />
                ),
            },
          ]}
        />
      </div>
    </AppShell>
  );
}
