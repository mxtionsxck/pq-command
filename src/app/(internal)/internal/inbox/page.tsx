import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Button, Card, EmptyState, StatusPill } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import {
  createInboxService,
  type InboxCategory,
} from "@/server/services/inbox-service";
import Link from "next/link";

import {
  assignConversationAction,
  createRequirementAction,
  createTaskAction,
  linkCompanyAction,
  linkPropertyAction,
  processReplyIntelligenceAction,
  saveReplyDraftAction,
  setCategoryAction,
  snoozeConversationAction,
  suppressContactAction,
} from "./actions";

type InboxPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const inboxCategories: InboxCategory[] = [
  "HOT",
  "INTERESTED",
  "FUTURE",
  "QUESTION",
  "UNCLEAR",
  "NOT_INTERESTED",
  "OPT_OUT",
];

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

function asCategory(value: string | undefined): InboxCategory | undefined {
  if (value && inboxCategories.includes(value as InboxCategory)) {
    return value as InboxCategory;
  }

  return undefined;
}

function asPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Inbox unavailable"
          description="Configure DATABASE_URL to load inbox conversations and actions."
        />
      </AppShell>
    );
  }

  const params = await searchParams;
  const selectedCategory =
    asCategory(readParam(params, "category")) ?? "UNCLEAR";
  const selectedConversationId = readParam(params, "conversationId");
  const search = readParam(params, "search");
  const page = asPositiveInt(readParam(params, "page"), 1);
  const pageSize = Math.min(50, asPositiveInt(readParam(params, "pageSize"), 25));

  const service = createInboxService();
  const conversations = await service.listConversations({
    category: selectedCategory,
    ...(search ? { search } : {}),
    page,
    pageSize,
  });
  const selectedConversation = selectedConversationId
    ? await service.getThread(selectedConversationId)
    : null;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Inbox"
          title="Response Operations"
          description="Three-pane inbox for demand response with categorization, assignment, snoozing, draft replies, linking, tasking, requirement capture, and suppression."
        />

        <Card title="Filters">
          <form
            className="grid gap-3 md:grid-cols-[1fr_auto_auto]"
            method="get"
          >
            <input name="page" type="hidden" value="1" />
            <input name="pageSize" type="hidden" value={pageSize} />
            <input
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={search ?? ""}
              name="search"
              placeholder="Search subject, company, email"
            />
            <select
              className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
              defaultValue={selectedCategory}
              name="category"
            >
              {inboxCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
          <Card title={`Conversations (${conversations.length})`}>
            {conversations.length === 0 ? (
              <EmptyState
                title="No conversations"
                description="No threads match the current inbox filters."
              />
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <Link
                    className={`block rounded-[var(--pq-radius-sm)] border p-3 ${selectedConversationId === conversation.id ? "border-[color:var(--pq-accent)]" : "border-[color:var(--pq-border)]"}`}
                    href={`/internal/inbox?category=${selectedCategory}&conversationId=${conversation.id}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                    key={conversation.id}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{conversation.category}</Badge>
                      <StatusPill
                        tone={
                          conversation.status === "open"
                            ? "success"
                            : conversation.status === "pending"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {conversation.status}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {conversation.subject ?? "No subject"}
                    </p>
                    <p className="text-xs pq-copy-muted">
                      {conversation.contactName ||
                        conversation.contactEmail ||
                        "Unknown contact"}
                    </p>
                    <p className="text-xs pq-copy-subtle">
                      {conversation.companyName ?? "No company"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--pq-border)] pt-3">
              <div className="text-xs pq-copy-subtle">Page {page} • {pageSize} per page</div>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                    href={`/internal/inbox?category=${selectedCategory}&page=${page - 1}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm pq-copy-subtle">
                    Previous
                  </span>
                )}
                {conversations.length === pageSize ? (
                  <Link
                    className="inline-flex min-h-11 items-center rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] px-4 text-sm text-white"
                    href={`/internal/inbox?category=${selectedCategory}&page=${page + 1}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
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

          <Card title="Thread">
            {selectedConversation ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedConversation.conversation.conversation.subject ??
                      "No subject"}
                  </p>
                  <p className="text-xs pq-copy-muted">
                    {selectedConversation.conversation.contact?.email ??
                      "No contact email"}
                  </p>
                </div>
                <div className="space-y-2">
                  {selectedConversation.messages.map((message) => (
                    <article
                      className={`rounded-[var(--pq-radius-sm)] border p-3 ${message.direction === "inbound" ? "border-[color:var(--pq-border)] bg-black/10" : "border-[color:var(--pq-accent)] bg-[color:var(--pq-accent)]/15"}`}
                      key={message.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            message.direction === "inbound"
                              ? "warning"
                              : "success"
                          }
                        >
                          {message.direction}
                        </Badge>
                        <Badge tone="neutral">{message.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-white">
                        {message.bodyText}
                      </p>
                      {message.direction === "inbound" ? (
                        <form
                          action={processReplyIntelligenceAction}
                          className="mt-3"
                        >
                          <input
                            name="messageId"
                            type="hidden"
                            value={message.id}
                          />
                          <Button type="submit" variant="secondary">
                            Process reply intelligence
                          </Button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No thread selected"
                description="Select a conversation from the left pane to view messages."
              />
            )}
          </Card>

          <Card title="Actions">
            {selectedConversation ? (
              <div className="space-y-4 text-sm">
                <form action={setCategoryAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <label className="space-y-1">
                    <span className="text-xs pq-copy-subtle">Category</span>
                    <select
                      className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                      defaultValue={
                        selectedConversation.conversation.conversation
                          .inboxCategory
                      }
                      name="category"
                    >
                      {inboxCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="secondary">
                    Save category
                  </Button>
                </form>

                <form action={assignConversationAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <input
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    name="ownerUserId"
                    placeholder="Owner user ID"
                    required
                  />
                  <Button type="submit" variant="ghost">
                    Assign
                  </Button>
                </form>

                <form action={snoozeConversationAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <input
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    name="snoozedUntil"
                    required
                    type="datetime-local"
                  />
                  <Button type="submit" variant="ghost">
                    Snooze
                  </Button>
                </form>

                <form action={saveReplyDraftAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <textarea
                    className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                    name="bodyText"
                    placeholder="Draft reply text"
                    required
                  />
                  <Button type="submit">Save reply draft</Button>
                </form>

                <form action={linkPropertyAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <input
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    name="propertyId"
                    placeholder="Property ID"
                    required
                  />
                  <Button type="submit" variant="ghost">
                    Link property
                  </Button>
                </form>

                <form action={linkCompanyAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <input
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    name="companyId"
                    placeholder="Company ID"
                    required
                  />
                  <Button type="submit" variant="ghost">
                    Link company
                  </Button>
                </form>

                <form action={createRequirementAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <input
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    name="notes"
                    placeholder="Requirement notes"
                  />
                  <Button type="submit" variant="ghost">
                    Create requirement
                  </Button>
                </form>

                <form action={createTaskAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <input
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    name="title"
                    placeholder="Task title"
                    required
                  />
                  <textarea
                    className="min-h-20 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 py-2 text-white"
                    name="description"
                    placeholder="Task description"
                  />
                  <Button type="submit" variant="ghost">
                    Create task
                  </Button>
                </form>

                <form action={suppressContactAction} className="grid gap-2">
                  <input
                    name="conversationId"
                    type="hidden"
                    value={selectedConversation.conversation.conversation.id}
                  />
                  <select
                    className="min-h-11 rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/20 px-3 text-white"
                    defaultValue="opt_out"
                    name="reason"
                  >
                    <option value="opt_out">opt_out</option>
                    <option value="bounced">bounced</option>
                    <option value="manual">manual</option>
                    <option value="legal">legal</option>
                  </select>
                  <Button type="submit" variant="ghost">
                    Suppress contact
                  </Button>
                </form>
              </div>
            ) : (
              <EmptyState
                title="No actions"
                description="Select a thread to apply assignment, snooze, linking, and suppression actions."
              />
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
