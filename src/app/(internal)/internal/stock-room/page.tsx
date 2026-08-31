import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import type {
  PropertyFilters,
  StockRoomPropertyCard,
} from "@/domain/property/types";
import { appEnv } from "@/lib/env";
import { createPropertyService } from "@/server/services/property-service";

import {
  archivePropertyAction,
  createPropertyAction,
  updatePropertyAction,
} from "./actions";

type StockRoomPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const propertyTypeOptions = [
  "apartment",
  "house",
  "studio",
  "maisonette",
  "townhouse",
  "other",
] as const;

const availabilityOptions = [
  "available_now",
  "available_soon",
  "occupied",
  "let_agreed",
  "unavailable",
] as const;

const fitOptions = ["ideal", "strong", "review", "unsuitable"] as const;
const statusOptions = ["draft", "active", "off_market", "archived"] as const;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseFilters(
  params: Record<string, string | string[] | undefined>,
): PropertyFilters {
  const search = readParam(params, "search");
  const area = readParam(params, "area");
  const bedrooms = readParam(params, "bedrooms");
  const rentMin = readParam(params, "rentMin");
  const rentMax = readParam(params, "rentMax");
  const availability = readParam(
    params,
    "availability",
  ) as PropertyFilters["availability"];
  const status = readParam(params, "status") as PropertyFilters["status"];
  const companyLetFit = readParam(
    params,
    "fit",
  ) as PropertyFilters["companyLetFit"];

  return {
    ...(search ? { search } : {}),
    ...(area ? { area } : {}),
    ...(bedrooms ? { minBedrooms: Number.parseInt(bedrooms, 10) } : {}),
    ...(rentMin
      ? { minRentCents: Math.round(Number.parseFloat(rentMin) * 100) }
      : {}),
    ...(rentMax
      ? { maxRentCents: Math.round(Number.parseFloat(rentMax) * 100) }
      : {}),
    ...(availability ? { availability } : {}),
    ...(status ? { status } : {}),
    ...(companyLetFit ? { companyLetFit } : {}),
  };
}

function asPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function pounds(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function renderHero(property: StockRoomPropertyCard) {
  const hasVisual = Boolean(property.heroMediaKey);

  return (
    <div className="relative mb-4 h-40 overflow-hidden rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] bg-[color:var(--pq-surface)]">
      {hasVisual ? (
        <Image
          alt={property.heroAltText ?? `${property.title} preview image`}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          src={property.heroMediaKey!}
          style={{ objectFit: "cover" }}
        />
      ) : null}
      {!hasVisual ? (
        <div className="flex h-full items-center justify-center text-sm pq-copy-subtle">
          No hero image
        </div>
      ) : null}
    </div>
  );
}

function PropertyCard({
  property,
}: Readonly<{
  property: StockRoomPropertyCard;
}>) {
  return (
    <Card eyebrow={property.borough ?? property.city} title={property.title}>
      {renderHero(property)}
      <div className="space-y-4 text-sm">
        <div className="flex justify-end">
          <a
            className="text-sm text-[color:var(--pq-accent-strong)]"
            href={`/internal/stock-room/${property.id}`}
          >
            Open Property Room
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{property.propertyType}</Badge>
          <Badge tone="success">{property.status}</Badge>
          <Badge tone="warning">PQ Fit: {property.companyLetFit}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="pq-copy-subtle">Address</p>
            <p className="mt-1 text-white">{property.addressLine1}</p>
            {property.addressLine2 ? (
              <p className="text-white">{property.addressLine2}</p>
            ) : null}
            <p className="text-white">{property.city}</p>
            <p className="text-white">{property.postcode}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="pq-copy-subtle">Rent</dt>
              <dd className="text-white">
                {pounds(property.monthlyRentCents)}
              </dd>
            </div>
            <div>
              <dt className="pq-copy-subtle">Deposit</dt>
              <dd className="text-white">{pounds(property.depositCents)}</dd>
            </div>
            <div>
              <dt className="pq-copy-subtle">Beds / Baths</dt>
              <dd className="text-white">
                {property.bedrooms ?? "-"} / {property.bathrooms ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="pq-copy-subtle">Availability</dt>
              <dd className="text-white">{property.availability}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill tone={property.furnished ? "success" : "neutral"}>
            Furnished
          </StatusPill>
          <StatusPill tone={property.parking ? "success" : "neutral"}>
            Parking
          </StatusPill>
          <StatusPill tone={property.garden ? "success" : "neutral"}>
            Garden
          </StatusPill>
        </div>

        <form
          action={updatePropertyAction}
          className="grid gap-3 border-t border-[color:var(--pq-border)] pt-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <input name="propertyId" type="hidden" value={property.id} />
          <label className="space-y-2 xl:col-span-2">
            <span className="text-xs pq-copy-subtle">Title</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.title}
              name="title"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Address line 1</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.addressLine1}
              name="addressLine1"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Address line 2</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.addressLine2 ?? ""}
              name="addressLine2"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">City</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.city}
              name="city"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Borough</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.borough ?? ""}
              name="borough"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Postcode</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.postcode}
              name="postcode"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Type</span>
            <select
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.propertyType}
              name="propertyType"
            >
              {propertyTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Bedrooms</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.bedrooms ?? ""}
              name="bedrooms"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Bathrooms</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.bathrooms ?? ""}
              name="bathrooms"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Rent GBP</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={
                property.monthlyRentCents
                  ? String(property.monthlyRentCents / 100)
                  : ""
              }
              name="monthlyRent"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Deposit GBP</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={
                property.depositCents ? String(property.depositCents / 100) : ""
              }
              name="deposit"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Term months</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.termMonths ?? ""}
              name="termMonths"
              type="number"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Availability</span>
            <select
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.availability}
              name="availability"
            >
              {availabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Available from</span>
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={
                property.availableFrom
                  ? property.availableFrom.toISOString().slice(0, 10)
                  : ""
              }
              name="availableFrom"
              type="date"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">PQ Fit</span>
            <select
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.companyLetFit}
              name="companyLetFit"
            >
              {fitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs pq-copy-subtle">Status</span>
            <select
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={property.status}
              name="status"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm text-white">
            <input
              defaultChecked={property.furnished}
              name="furnished"
              type="checkbox"
            />{" "}
            Furnished
          </label>
          <label className="flex items-center gap-3 text-sm text-white">
            <input
              defaultChecked={property.parking}
              name="parking"
              type="checkbox"
            />{" "}
            Parking
          </label>
          <label className="flex items-center gap-3 text-sm text-white">
            <input
              defaultChecked={property.garden}
              name="garden"
              type="checkbox"
            />{" "}
            Garden
          </label>
          <label className="space-y-2 sm:col-span-2 xl:col-span-2">
            <span className="text-xs pq-copy-subtle">Bills</span>
            <textarea
              className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-3 text-white"
              defaultValue={property.billsSummary ?? ""}
              name="billsSummary"
            />
          </label>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs pq-copy-subtle">Summary</span>
            <textarea
              className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-3 text-white"
              defaultValue={property.summary ?? ""}
              name="summary"
            />
          </label>
          {property.companyId ? (
            <input name="companyId" type="hidden" value={property.companyId} />
          ) : null}
          {property.sourceId ? (
            <input name="sourceId" type="hidden" value={property.sourceId} />
          ) : null}
          <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-4">
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </div>
        </form>

        <form
          action={archivePropertyAction}
          className="border-t border-[color:var(--pq-border)] pt-4"
        >
          <input name="propertyId" type="hidden" value={property.id} />
          <Button type="submit" variant="ghost">
            Archive property
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default async function StockRoomPage({
  searchParams,
}: StockRoomPageProps) {
  const databaseConfigured = getDatabaseConfig(appEnv).configured;

  if (!databaseConfigured) {
    return (
      <AppShell>
        <EmptyState
          title="Stock Room unavailable"
          description="Configure DATABASE_URL to browse the live company-let property inventory."
        />
      </AppShell>
    );
  }

  try {
    const params = await searchParams;
    const propertyService = createPropertyService();
    const filters = parseFilters(params);
    const page = asPositiveInt(readParam(params, "page"), 1);
    const pageSize = Math.min(48, asPositiveInt(readParam(params, "pageSize"), 24));
    const properties = await propertyService.listStockRoom(filters, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const view = readParam(params, "view") === "list" ? "list" : "grid";

    return (
      <AppShell>
        <div className="space-y-8">
        <PageHeader
          eyebrow="Stock Room"
          title="Property inventory"
          description="Server-filtered inventory for PQ company-let stock. Records come only from the database; no seeded placeholder properties are rendered."
        />

        <div className="flex flex-wrap gap-3">
          <Badge tone={databaseConfigured ? "success" : "warning"}>
            {databaseConfigured
              ? "Database connected"
              : "Database not configured"}
          </Badge>
          <Badge tone="info">{properties.length} result(s)</Badge>
          <Badge tone="warning">View: {view}</Badge>
        </div>

        <Card eyebrow="Filters" title="Search and refine stock">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input name="page" type="hidden" value="1" />
            <input name="pageSize" type="hidden" value={pageSize} />
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Search</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filters.search ?? ""}
                name="search"
                placeholder="Address, title, postcode"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Area / Postcode</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filters.area ?? ""}
                name="area"
                placeholder="Borough or postcode"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Bedrooms</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filters.minBedrooms ?? ""}
                min="0"
                name="bedrooms"
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Min rent GBP</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={
                  filters.minRentCents ? String(filters.minRentCents / 100) : ""
                }
                name="rentMin"
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Max rent GBP</span>
              <input
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={
                  filters.maxRentCents ? String(filters.maxRentCents / 100) : ""
                }
                name="rentMax"
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Availability</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filters.availability ?? ""}
                name="availability"
              >
                <option value="">All</option>
                {availabilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">Status</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filters.status ?? ""}
                name="status"
              >
                <option value="">Active records</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">PQ Fit</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={filters.companyLetFit ?? ""}
                name="fit"
              >
                <option value="">All</option>
                {fitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs pq-copy-subtle">View</span>
              <select
                className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                defaultValue={view}
                name="view"
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-3 xl:col-span-3">
              <Button type="submit" variant="secondary">
                Apply filters
              </Button>
              <Link
                className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                href={`/internal/stock-room?page=1&pageSize=${pageSize}`}
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <Card eyebrow="Create" title="Add property">
          {databaseConfigured ? (
            <form
              action={createPropertyAction}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              <label className="space-y-2 xl:col-span-2">
                <span className="text-xs pq-copy-subtle">Title</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="title"
                  required
                />
              </label>
              <label className="space-y-2 xl:col-span-2">
                <span className="text-xs pq-copy-subtle">Address line 1</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="addressLine1"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Address line 2</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="addressLine2"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">City</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="London"
                  name="city"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Borough</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="borough"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Postcode</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="postcode"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Type</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="other"
                  name="propertyType"
                >
                  {propertyTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Bedrooms</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  min="0"
                  name="bedrooms"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Bathrooms</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  min="0"
                  name="bathrooms"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Rent GBP</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  min="0"
                  name="monthlyRent"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Deposit GBP</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  min="0"
                  name="deposit"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Term months</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  min="1"
                  name="termMonths"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Availability</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="available_now"
                  name="availability"
                >
                  {availabilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Available from</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="availableFrom"
                  type="date"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">PQ Fit</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="review"
                  name="companyLetFit"
                >
                  {fitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Status</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="draft"
                  name="status"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm text-white">
                <input name="furnished" type="checkbox" /> Furnished
              </label>
              <label className="flex items-center gap-3 text-sm text-white">
                <input name="parking" type="checkbox" /> Parking
              </label>
              <label className="flex items-center gap-3 text-sm text-white">
                <input name="garden" type="checkbox" /> Garden
              </label>
              <label className="space-y-2 xl:col-span-2">
                <span className="text-xs pq-copy-subtle">Bills</span>
                <textarea
                  className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-3 text-white"
                  name="billsSummary"
                />
              </label>
              <label className="space-y-2 xl:col-span-2">
                <span className="text-xs pq-copy-subtle">Summary</span>
                <textarea
                  className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-3 text-white"
                  name="summary"
                />
              </label>
              <div className="flex items-end xl:col-span-4">
                <Button type="submit">Create property</Button>
              </div>
            </form>
          ) : (
            <EmptyState
              description="Property creation is implemented through the service layer but disabled until DATABASE_URL is configured."
              title="Database required for CRUD"
            />
          )}
        </Card>

        {properties.length === 0 ? (
          <EmptyState
            description={
              databaseConfigured
                ? "No properties matched the current filters."
                : "No database records are available because DATABASE_URL is not configured."
            }
            title="No properties to display"
          />
        ) : (
          <section
            className={
              view === "list" ? "space-y-4" : "grid gap-4 xl:grid-cols-2"
            }
          >
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </section>
        )}

        <Card title="Pagination" eyebrow="Large lists">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs pq-copy-subtle">Page {page} • {pageSize} per page</p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                  href={`/internal/stock-room?page=${page - 1}&pageSize=${pageSize}`}
                >
                  Previous
                </Link>
              ) : (
                <span className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm pq-copy-subtle">
                  Previous
                </span>
              )}
              {properties.length === pageSize ? (
                <Link
                  className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                  href={`/internal/stock-room?page=${page + 1}&pageSize=${pageSize}`}
                >
                  Next
                </Link>
              ) : (
                <span className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm pq-copy-subtle">
                  Next
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <EmptyState
          title="Stock Room temporarily unavailable"
          description="The live stock database is re-syncing or unavailable right now. Please try again shortly."
        />
      </AppShell>
    );
  }
}
