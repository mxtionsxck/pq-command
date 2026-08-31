import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  AuditTimeline,
  Badge,
  Button,
  Card,
  EmptyState,
  StatusPill,
} from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { createCompanyContactService } from "@/server/services/company-contact-service";

import {
  archiveCompanyAction,
  archiveContactAction,
  createCompanyAction,
  createContactAction,
  updateCompanyAction,
  updateContactAction,
} from "./actions";

type CompaniesPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

export default async function CompaniesPage({
  searchParams,
}: CompaniesPageProps) {
  const databaseConfigured = getDatabaseConfig(appEnv).configured;

  if (!databaseConfigured) {
    return (
      <AppShell>
        <EmptyState
          title="CRM unavailable"
          description="Configure DATABASE_URL to manage companies and contacts."
        />
      </AppShell>
    );
  }

  try {
    const params = await searchParams;
    const search = readParam(params, "search") ?? "";
    const service = createCompanyContactService();
    const [companies, contacts, activity] = await Promise.all([
      service.listCompanies(search),
      service.listContacts({ search }),
      service.listActivityTimeline(),
    ]);

    return (
      <AppShell>
        <div className="space-y-8">
        <PageHeader
          eyebrow="CRM"
          title="Companies and Contacts"
          description="Separate company and contact entities with relationship mapping, suppression visibility, duplicate warnings, and auditable CRUD."
        />

        <Card title="Search">
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" method="get">
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={search}
              name="search"
              placeholder="Search company, company number, person, phone, or email"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Create company" eyebrow="Company CRUD">
            <form
              action={createCompanyAction}
              className="grid gap-3 md:grid-cols-2"
            >
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Legal name</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="legalName"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Trading name</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="tradingName"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Company number</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="companyNumber"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Website</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="website"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Type</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="companyType"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs pq-copy-subtle">Locations</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="locations"
                  placeholder="London, Manchester"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Status</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="prospect"
                  name="status"
                >
                  <option value="prospect">prospect</option>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
              <div>
                <Button type="submit">Create company</Button>
              </div>
            </form>
          </Card>

          <Card title="Create contact" eyebrow="Contact CRUD">
            <form
              action={createContactAction}
              className="grid gap-3 md:grid-cols-2"
            >
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">First name</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="firstName"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Last name</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="lastName"
                  required
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs pq-copy-subtle">
                  Company relationship
                </span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="companyId"
                >
                  <option value="">No linked company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.legalName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Role</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="roleTitle"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Source</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="manual"
                  name="source"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Email</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="email"
                  type="email"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Phone</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  name="phone"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Confidence 0-100</span>
                <input
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="50"
                  max="100"
                  min="0"
                  name="confidence"
                  type="number"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">
                  Suppression status
                </span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="clear"
                  name="suppressionStatus"
                >
                  <option value="clear">clear</option>
                  <option value="review">review</option>
                  <option value="suppressed">suppressed</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs pq-copy-subtle">Contact status</span>
                <select
                  className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                  defaultValue="active"
                  name="status"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs pq-copy-subtle">
                  Decision maker evidence
                </span>
                <textarea
                  className="min-h-24 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                  name="decisionMakerEvidence"
                  placeholder="Leave blank if unknown. Do not assume authority without evidence."
                />
              </label>
              <div>
                <Button type="submit">Create contact</Button>
              </div>
            </form>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Companies" eyebrow={`${companies.length} results`}>
            <div className="space-y-4">
              {companies.length === 0 ? (
                <EmptyState
                  title="No companies"
                  description="Create a company to start relationship mapping."
                />
              ) : (
                companies.map((company) => (
                  <article
                    className="rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] p-4"
                    key={company.id}
                  >
                    <form
                      action={updateCompanyAction}
                      className="grid gap-3 md:grid-cols-2"
                    >
                      <input
                        name="companyId"
                        type="hidden"
                        value={company.id}
                      />
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs pq-copy-subtle">
                          Legal name
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.legalName}
                          name="legalName"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">
                          Trading name
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.tradingName ?? ""}
                          name="tradingName"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">
                          Company number
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.companyNumber ?? ""}
                          name="companyNumber"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Website</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.website ?? ""}
                          name="website"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Type</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.companyType ?? ""}
                          name="companyType"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Status</span>
                        <select
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.status}
                          name="status"
                        >
                          <option value="prospect">prospect</option>
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                          <option value="archived">archived</option>
                        </select>
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs pq-copy-subtle">
                          Locations
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={company.locations ?? ""}
                          name="locations"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                        <Badge tone="info">{company.status}</Badge>
                        <Badge tone="success">
                          Contacts: {company.contactCount}
                        </Badge>
                        {company.duplicateWarning ? (
                          <Badge tone="warning">Potential duplicate</Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3 md:col-span-2">
                        <Button type="submit" variant="secondary">
                          Save company
                        </Button>
                      </div>
                    </form>
                    <form action={archiveCompanyAction} className="mt-3">
                      <input
                        name="companyId"
                        type="hidden"
                        value={company.id}
                      />
                      <Button type="submit" variant="ghost">
                        Archive company
                      </Button>
                    </form>
                  </article>
                ))
              )}
            </div>
          </Card>

          <Card title="Contacts" eyebrow={`${contacts.length} results`}>
            <div className="space-y-4">
              {contacts.length === 0 ? (
                <EmptyState
                  title="No contacts"
                  description="Create contacts and link them to companies."
                />
              ) : (
                contacts.map((contact) => (
                  <article
                    className="rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] p-4"
                    key={contact.id}
                  >
                    <form
                      action={updateContactAction}
                      className="grid gap-3 md:grid-cols-2"
                    >
                      <input
                        name="contactId"
                        type="hidden"
                        value={contact.id}
                      />
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">
                          First name
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.firstName}
                          name="firstName"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">
                          Last name
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.lastName}
                          name="lastName"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs pq-copy-subtle">
                          Linked company
                        </span>
                        <select
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.companyId ?? ""}
                          name="companyId"
                        >
                          <option value="">No linked company</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.legalName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Role</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.roleTitle ?? ""}
                          name="roleTitle"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Source</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.source ?? ""}
                          name="source"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Email</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.email ?? ""}
                          name="email"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Phone</span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.phone ?? ""}
                          name="phone"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">
                          Confidence
                        </span>
                        <input
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.confidence}
                          max="100"
                          min="0"
                          name="confidence"
                          type="number"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">
                          Suppression
                        </span>
                        <select
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.suppressionStatus}
                          name="suppressionStatus"
                        >
                          <option value="clear">clear</option>
                          <option value="review">review</option>
                          <option value="suppressed">suppressed</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs pq-copy-subtle">Status</span>
                        <select
                          className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                          defaultValue={contact.status}
                          name="status"
                        >
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                          <option value="archived">archived</option>
                        </select>
                      </label>
                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs pq-copy-subtle">
                          Decision maker evidence
                        </span>
                        <textarea
                          className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                          defaultValue={contact.decisionMakerEvidence ?? ""}
                          name="decisionMakerEvidence"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                        <StatusPill
                          tone={
                            contact.contactability === "contactable"
                              ? "success"
                              : contact.contactability === "suppressed"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {contact.contactability}
                        </StatusPill>
                        <Badge
                          tone={
                            contact.suppressionStatus === "suppressed"
                              ? "warning"
                              : "info"
                          }
                        >
                          Suppression: {contact.suppressionStatus}
                        </Badge>
                        {contact.duplicateWarning ? (
                          <Badge tone="warning">Potential duplicate</Badge>
                        ) : null}
                        {contact.companyName ? (
                          <Badge tone="success">
                            Linked: {contact.companyName}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Unlinked</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 md:col-span-2">
                        <Button type="submit" variant="secondary">
                          Save contact
                        </Button>
                      </div>
                    </form>
                    <form action={archiveContactAction} className="mt-3">
                      <input
                        name="contactId"
                        type="hidden"
                        value={contact.id}
                      />
                      <Button type="submit" variant="ghost">
                        Archive contact
                      </Button>
                    </form>
                  </article>
                ))
              )}
            </div>
          </Card>
        </section>

        <Card
          title="Activity timeline"
          eyebrow="Audited company and contact mutations"
        >
          {activity.length > 0 ? (
            <AuditTimeline events={activity} />
          ) : (
            <EmptyState
              title="No activity"
              description="Create or update companies and contacts to see timeline events."
            />
          )}
        </Card>
      </div>
    </AppShell>
    );
  } catch {
    return (
      <AppShell>
        <EmptyState
          title="CRM temporarily unavailable"
          description="The live CRM data layer is re-syncing or unavailable right now. Please try again shortly."
        />
      </AppShell>
    );
  }
}
