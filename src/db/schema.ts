import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const jsonObjectDefault = sql`'{}'::jsonb`;

function createdAtColumn() {
  return timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .notNull()
    .defaultNow();
}

function updatedAtColumn() {
  return timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
  })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
}

function archivedAtColumn() {
  return timestamp("archived_at", {
    withTimezone: true,
    mode: "date",
  });
}

function baseColumns() {
  return {
    id: text("id").primaryKey(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  };
}

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "MANAGER", "AGENT"]);
export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "active",
  "suspended",
  "archived",
]);
export const companyStatusEnum = pgEnum("company_status", [
  "prospect",
  "active",
  "inactive",
  "archived",
]);
export const contactStatusEnum = pgEnum("contact_status", [
  "active",
  "inactive",
  "archived",
]);
export const contactSuppressionStatusEnum = pgEnum(
  "contact_suppression_status",
  ["clear", "suppressed", "review"],
);
export const propertyStatusEnum = pgEnum("property_status", [
  "draft",
  "active",
  "off_market",
  "archived",
]);
export const propertyTypeEnum = pgEnum("property_type", [
  "apartment",
  "house",
  "studio",
  "maisonette",
  "townhouse",
  "other",
]);
export const propertyAvailabilityEnum = pgEnum("property_availability", [
  "available_now",
  "available_soon",
  "occupied",
  "let_agreed",
  "unavailable",
]);
export const propertyFitEnum = pgEnum("property_fit", [
  "ideal",
  "strong",
  "review",
  "unsuitable",
]);
export const propertyMediaKindEnum = pgEnum("property_media_kind", [
  "image",
  "video",
  "floorplan",
  "document",
]);
export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "active",
  "archived",
]);
export const documentTypeEnum = pgEnum("document_type", [
  "brochure",
  "compliance",
  "contract",
  "floorplan",
  "photo_pack",
  "other",
]);
export const requirementStatusEnum = pgEnum("requirement_status", [
  "open",
  "matched",
  "on_hold",
  "closed",
  "archived",
]);
export const requirementRelationshipEnum = pgEnum("requirement_relationship", [
  "DIRECT",
  "INTRODUCER",
  "UNKNOWN",
]);
export const requirementUrgencyEnum = pgEnum("requirement_urgency", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "researching",
  "qualified",
  "nurturing",
  "disqualified",
  "archived",
]);
export const leadTypeEnum = pgEnum("lead_type", [
  "supply",
  "demand",
  "ai_discovered",
]);
export const leadOutreachStatusEnum = pgEnum("lead_outreach_status", [
  "not_started",
  "drafted",
  "sent",
  "responded",
  "suppressed",
]);
export const signalStatusEnum = pgEnum("signal_status", [
  "new",
  "reviewed",
  "dismissed",
]);
export const signalTypeEnum = pgEnum("signal_type", [
  "inquiry",
  "engagement",
  "availability",
  "pricing",
  "conversation",
  "PRIVATE_LANDLORD",
  "DEVELOPER",
  "MULTI_UNIT",
  "AVAILABILITY",
  "PORTFOLIO",
  "PROPERTY_OWNER",
  "REACTIVATION",
]);
export const evidenceCollectionMethodEnum = pgEnum(
  "evidence_collection_method",
  ["manual", "connector", "ai_extraction", "ai_inference"],
);
export const aiConclusionStatusEnum = pgEnum("ai_conclusion_status", [
  "advisory",
  "unsupported",
  "promoted",
  "dismissed",
]);
export const sourceKindEnum = pgEnum("source_kind", [
  "portal",
  "manual",
  "referral",
  "partner",
  "website",
  "other",
]);
export const sourceStatusEnum = pgEnum("source_status", [
  "active",
  "paused",
  "archived",
]);
export const sourcePermissionStatusEnum = pgEnum("source_permission_status", [
  "APPROVED",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "DISABLED",
]);
export const sourceHealthEnum = pgEnum("source_health", [
  "healthy",
  "degraded",
  "offline",
  "unknown",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "archived",
]);
export const outreachApprovalModeEnum = pgEnum("outreach_approval_mode", [
  "HUMAN_APPROVAL",
  "AUTO_APPROVAL",
]);
export const autonomyLevelEnum = pgEnum("autonomy_level", [
  "LEVEL_0_DRAFT_ONLY",
  "LEVEL_1_HUMAN_APPROVAL",
  "LEVEL_2_CONTROLLED_AUTO_FOLLOW_UP",
  "LEVEL_3_LIMITED_AUTONOMOUS_CAMPAIGNS",
]);
export const outreachChannelEnum = pgEnum("outreach_channel", [
  "email",
  "sms",
  "whatsapp",
]);
export const inboxCategoryEnum = pgEnum("inbox_category", [
  "HOT",
  "INTERESTED",
  "FUTURE",
  "QUESTION",
  "UNCLEAR",
  "NOT_INTERESTED",
  "OPT_OUT",
]);
export const replyFactTypeEnum = pgEnum("reply_fact_type", [
  "availability",
  "unit_count",
  "bedrooms",
  "location",
  "budget",
  "timing",
  "next_step",
]);
export const outreachMessageStatusEnum = pgEnum("outreach_message_status", [
  "queued",
  "sent",
  "failed",
  "cancelled",
]);
export const outreachDraftTemplateEnum = pgEnum("outreach_draft_template", [
  "PRIVATE_LANDLORD",
  "DEVELOPER",
  "PORTFOLIO_OWNER",
  "DIRECT_COMPANY",
]);
export const outreachDraftStatusEnum = pgEnum("outreach_draft_status", [
  "draft",
  "approved",
  "rejected",
]);
export const sendAttemptStatusEnum = pgEnum("send_attempt_status", [
  "blocked",
  "queued",
  "sent",
  "failed",
]);
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "scheduled",
  "cancelled",
  "sent",
]);
export const shortagePriorityEnum = pgEnum("shortage_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);
export const shortageStatusEnum = pgEnum("shortage_status", [
  "active",
  "converted",
  "archived",
]);
export const economicsSignalStatusEnum = pgEnum("economics_signal_status", [
  "new",
  "informational",
  "reviewed",
  "dismissed",
]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "pending",
  "closed",
  "archived",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "suggested",
  "contacted",
  "viewing_booked",
  "won",
  "lost",
  "archived",
]);
export const viewingStatusEnum = pgEnum("viewing_status", [
  "proposed",
  "scheduled",
  "reminded",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
export const dealStatusEnum = pgEnum("deal_status", [
  "MATCHED",
  "VIEWING",
  "OFFER",
  "NEGOTIATION",
  "AGREED",
  "CONTRACT",
  "LIVE",
  "COMPLETED",
  "LOST",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "unread",
  "read",
  "archived",
]);
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "user",
  "system",
  "job",
]);
export const objectiveStatusEnum = pgEnum("objective_status", [
  "draft",
  "active",
  "completed",
  "cancelled",
  "archived",
]);
export const suppressionReasonEnum = pgEnum("suppression_reason", [
  "bounced",
  "opt_out",
  "manual",
  "legal",
]);
export const suppressionChannelEnum = pgEnum("suppression_channel", [
  "email",
  "sms",
  "whatsapp",
]);
export const jobRunStatusEnum = pgEnum("job_run_status", [
  "queued",
  "running",
  "retrying",
  "succeeded",
  "failed",
  "dead_letter",
  "cancelled",
]);
export const queueItemStatusEnum = pgEnum("queue_item_status", [
  "queued",
  "running",
  "retrying",
  "succeeded",
  "failed",
  "dead_letter",
  "cancelled",
]);
export const questChapterEnum = pgEnum("quest_chapter", [
  "The Scout",
  "The Qualifier",
  "The Outreach Run",
  "The Match",
  "The Viewing",
  "The Deal",
  "The Shortage",
  "The Flywheel",
]);
export const analyticsMetricEnum = pgEnum("analytics_metric", [
  "discovered",
  "researched_prospect",
  "qualified",
  "conversation",
  "positive_reply",
  "requirement",
  "qualified_stock",
  "match",
  "viewing",
  "offer",
  "completed_deal",
  "multi_unit_units",
]);
export const directnessClassificationEnum = pgEnum(
  "directness_classification",
  ["DIRECT", "INTERMEDIARY", "UNKNOWN", "SUPPRESSED"],
);
export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "partially_verified",
  "verified",
  "conflicted",
]);
export const missionStatusEnum = pgEnum("mission_status", [
  "draft",
  "running",
  "paused",
  "satisfied",
  "exhausted",
  "cancelled",
]);
export const missionTypeEnum = pgEnum("mission_type", [
  "SUPPLY",
  "DEMAND",
  "SHORTAGE",
  "RELATIONSHIP",
]);
export const demandHeatStatusEnum = pgEnum("demand_heat_status", [
  "BALANCED",
  "HIGH_DEMAND",
  "SHORTAGE",
  "CRITICAL_SHORTAGE",
  "EMERGING_SHORTAGE",
]);
export const exclusionReasonEnum = pgEnum("exclusion_reason", [
  "INTERMEDIARY",
  "WRONG_PROPERTY",
  "WRONG_AREA",
  "WRONG_BEDROOM_COUNT",
  "UNREALISTIC_RENT",
  "DUPLICATE",
  "SUPPRESSED",
  "INSUFFICIENT_EVIDENCE",
  "LOW_CONFIDENCE",
  "REPEATEDLY_NON_RESPONSIVE",
  "POOR_HISTORICAL_CONVERSION",
]);

export const users = pgTable(
  "users",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }),
    role: userRoleEnum("role").notNull().default("AGENT"),
    status: userStatusEnum("status").notNull().default("invited"),
    authProvider: varchar("auth_provider", { length: 64 })
      .notNull()
      .default("microsoft-entra-id"),
    externalSubject: varchar("external_subject", { length: 191 }),
    lastSignedInAt: timestamp("last_signed_in_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("users_email_uq").on(table.email),
    uniqueIndex("users_external_subject_uq").on(table.externalSubject),
    index("users_role_status_idx").on(table.role, table.status),
  ],
);

export const companies = pgTable(
  "companies",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }),
    tradingName: varchar("trading_name", { length: 200 }),
    companyNumber: varchar("company_number", { length: 64 }),
    slug: varchar("slug", { length: 160 }).notNull(),
    companyType: varchar("company_type", { length: 120 }),
    locations: text("locations"),
    status: companyStatusEnum("status").notNull().default("prospect"),
    website: text("website"),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("companies_slug_uq").on(table.slug),
    uniqueIndex("companies_company_number_uq").on(table.companyNumber),
    index("companies_owner_status_idx").on(table.ownerUserId, table.status),
    index("companies_archived_idx").on(table.archivedAt),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }).notNull(),
    roleTitle: varchar("role_title", { length: 160 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    source: varchar("source", { length: 120 }),
    confidence: integer("confidence").notNull().default(50),
    suppressionStatus: contactSuppressionStatusEnum("suppression_status")
      .notNull()
      .default("clear"),
    decisionMakerEvidence: text("decision_maker_evidence"),
    status: contactStatusEnum("status").notNull().default("active"),
    preferredChannel: outreachChannelEnum("preferred_channel"),
    notes: text("notes"),
  },
  (table) => [
    index("contacts_company_status_idx").on(table.companyId, table.status),
    index("contacts_owner_status_idx").on(table.ownerUserId, table.status),
    index("contacts_email_idx").on(table.email),
    index("contacts_phone_idx").on(table.phone),
  ],
);

export const sources = pgTable(
  "sources",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    kind: sourceKindEnum("kind").notNull(),
    status: sourceStatusEnum("status").notNull().default("active"),
    connectorKey: varchar("connector_key", { length: 160 }),
    permissionStatus: sourcePermissionStatusEnum("permission_status")
      .notNull()
      .default("REVIEW_REQUIRED"),
    allowedData: text("allowed_data"),
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    enabled: boolean("enabled").notNull().default(true),
    lastScannedAt: timestamp("last_scanned_at", {
      withTimezone: true,
      mode: "date",
    }),
    health: sourceHealthEnum("health").notNull().default("unknown"),
    notes: text("notes"),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    lastIngestedAt: timestamp("last_ingested_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("sources_name_uq").on(table.name),
    uniqueIndex("sources_connector_key_uq").on(table.connectorKey),
    index("sources_kind_status_idx").on(table.kind, table.status),
    index("sources_permission_idx").on(table.permissionStatus, table.enabled),
  ],
);

export const properties = pgTable(
  "properties",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    status: propertyStatusEnum("status").notNull().default("draft"),
    borough: varchar("borough", { length: 120 }),
    propertyType: propertyTypeEnum("property_type").notNull().default("other"),
    addressLine1: varchar("address_line_1", { length: 200 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 200 }),
    city: varchar("city", { length: 120 }).notNull(),
    postcode: varchar("postcode", { length: 32 }).notNull(),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    furnished: boolean("furnished").notNull().default(false),
    parking: boolean("parking").notNull().default(false),
    garden: boolean("garden").notNull().default(false),
    monthlyRentCents: integer("monthly_rent_cents"),
    depositCents: integer("deposit_cents"),
    termMonths: integer("term_months"),
    availability: propertyAvailabilityEnum("availability")
      .notNull()
      .default("available_now"),
    availableFrom: date("available_from", { mode: "date" }),
    billsSummary: text("bills_summary"),
    companyLetFit: propertyFitEnum("company_let_fit")
      .notNull()
      .default("review"),
    summary: text("summary"),
  },
  (table) => [
    index("properties_company_status_idx").on(table.companyId, table.status),
    index("properties_source_status_idx").on(table.sourceId, table.status),
    index("properties_postcode_idx").on(table.postcode),
    index("properties_borough_status_idx").on(table.borough, table.status),
    index("properties_bedrooms_idx").on(table.bedrooms),
    index("properties_rent_idx").on(table.monthlyRentCents),
    index("properties_availability_idx").on(table.availability),
    index("properties_fit_status_idx").on(table.companyLetFit, table.status),
    index("properties_fit_status_updated_idx").on(
      table.companyLetFit,
      table.status,
      table.updatedAt,
    ),
    index("properties_archived_idx").on(table.archivedAt),
  ],
);

export const propertyMedia = pgTable(
  "property_media",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: propertyMediaKindEnum("kind").notNull().default("image"),
    storageKey: text("storage_key").notNull(),
    originalFilename: varchar("original_filename", { length: 260 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    altText: varchar("alt_text", { length: 200 }),
    caption: text("caption"),
    isHero: boolean("is_hero").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("property_media_property_kind_idx").on(table.propertyId, table.kind),
    index("property_media_property_hero_idx").on(
      table.propertyId,
      table.isHero,
    ),
    uniqueIndex("property_media_storage_key_uq").on(table.storageKey),
  ],
);

export const documents = pgTable(
  "documents",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    dealId: text("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    documentType: documentTypeEnum("document_type").notNull().default("other"),
    status: documentStatusEnum("status").notNull().default("pending"),
    versionNumber: integer("version_number").notNull().default(1),
    originalFilename: varchar("original_filename", { length: 260 }).notNull(),
    storageKey: text("storage_key").notNull(),
    byteSize: integer("byte_size").notNull(),
    checksum: varchar("checksum", { length: 128 }),
    mimeType: varchar("mime_type", { length: 120 }),
  },
  (table) => [
    uniqueIndex("documents_storage_key_uq").on(table.storageKey),
    index("documents_company_status_idx").on(table.companyId, table.status),
    index("documents_property_status_idx").on(table.propertyId, table.status),
    index("documents_contact_status_idx").on(table.contactId, table.status),
    index("documents_property_type_idx").on(
      table.propertyId,
      table.documentType,
    ),
  ],
);

export const requirements = pgTable(
  "requirements",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: requirementStatusEnum("status").notNull().default("open"),
    budgetMinCents: integer("budget_min_cents"),
    budgetMaxCents: integer("budget_max_cents"),
    bedroomsMin: integer("bedrooms_min"),
    bedroomsMax: integer("bedrooms_max"),
    unitCount: integer("unit_count"),
    acceptableRadiusMiles: integer("acceptable_radius_miles"),
    preferredArea: varchar("preferred_area", { length: 200 }),
    startDate: date("start_date", { mode: "date" }),
    termMonths: integer("term_months"),
    purpose: varchar("purpose", { length: 200 }),
    urgency: requirementUrgencyEnum("urgency").notNull().default("MEDIUM"),
    relationshipType: requirementRelationshipEnum("relationship_type")
      .notNull()
      .default("UNKNOWN"),
    directRelationshipVerified: boolean("direct_relationship_verified")
      .notNull()
      .default(false),
    evidenceIds: jsonb("evidence_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    nextAction: text("next_action"),
    notes: text("notes"),
  },
  (table) => [
    index("requirements_lead_status_idx").on(table.leadId, table.status),
    index("requirements_company_status_idx").on(table.companyId, table.status),
    index("requirements_contact_status_idx").on(table.contactId, table.status),
    index("requirements_owner_status_idx").on(table.ownerUserId, table.status),
  ],
);

export const leads = pgTable(
  "leads",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    leadType: leadTypeEnum("lead_type").notNull().default("supply"),
    status: leadStatusEnum("status").notNull().default("new"),
    score: integer("score").notNull().default(0),
    confidence: integer("confidence").notNull().default(50),
    nextAction: text("next_action"),
    outreachStatus: leadOutreachStatusEnum("outreach_status")
      .notNull()
      .default("not_started"),
    directnessClassification: directnessClassificationEnum(
      "directness_classification",
    )
      .notNull()
      .default("UNKNOWN"),
    directnessConfidence: integer("directness_confidence")
      .notNull()
      .default(0),
    directnessVerified: boolean("directness_verified")
      .notNull()
      .default(false),
    scoreVersion: varchar("score_version", { length: 64 }),
    lastScoredAt: timestamp("last_scored_at", {
      withTimezone: true,
      mode: "date",
    }),
    summary: text("summary"),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("leads_source_status_idx").on(table.sourceId, table.status),
    index("leads_owner_status_idx").on(table.ownerUserId, table.status),
    index("leads_contact_status_idx").on(table.contactId, table.status),
    index("leads_type_status_idx").on(table.leadType, table.status),
    index("leads_type_status_updated_idx").on(
      table.leadType,
      table.status,
      table.updatedAt,
    ),
    index("leads_directness_idx").on(
      table.directnessClassification,
      table.directnessVerified,
    ),
  ],
);

export const signals = pgTable(
  "signals",
  {
    ...baseColumns(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: signalTypeEnum("type").notNull(),
    status: signalStatusEnum("status").notNull().default("new"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    detectedAt: timestamp("detected_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("signals_source_status_idx").on(table.sourceId, table.status),
    index("signals_lead_type_idx").on(table.leadId, table.type),
    index("signals_contact_type_idx").on(table.contactId, table.type),
    index("signals_property_type_idx").on(table.propertyId, table.type),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    signalId: text("signal_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
    sourceReference: varchar("source_reference", { length: 240 }).notNull(),
    sourceUrl: text("source_url"),
    detectedAt: timestamp("detected_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    summary: text("summary").notNull(),
    confidence: integer("confidence").notNull().default(50),
    collectionMethod: evidenceCollectionMethodEnum("collection_method")
      .notNull()
      .default("connector"),
  },
  (table) => [
    index("evidence_signal_detected_idx").on(table.signalId, table.detectedAt),
    index("evidence_source_detected_idx").on(table.sourceId, table.detectedAt),
    index("evidence_lead_detected_idx").on(table.leadId, table.detectedAt),
    uniqueIndex("evidence_signal_reference_uq").on(
      table.signalId,
      table.sourceReference,
    ),
  ],
);

export const aiConclusions = pgTable(
  "ai_conclusions",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    signalId: text("signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    summary: text("summary").notNull(),
    recommendation: varchar("recommendation", { length: 80 }).notNull(),
    confidence: integer("confidence").notNull().default(0),
    evidenceIds: jsonb("evidence_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    supported: boolean("supported").notNull().default(false),
    status: aiConclusionStatusEnum("status").notNull().default("advisory"),
    failureReason: text("failure_reason"),
    latencyMs: integer("latency_ms"),
    tokenUsage: jsonb("token_usage").$type<Record<string, number>>(),
    costUsdMicros: integer("cost_usd_micros"),
  },
  (table) => [
    index("ai_conclusions_lead_status_idx").on(table.leadId, table.status),
    index("ai_conclusions_signal_idx").on(table.signalId),
    index("ai_conclusions_supported_idx").on(table.supported, table.confidence),
  ],
);

export const leadScoringConfigs = pgTable(
  "lead_scoring_configs",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: varchar("version", { length: 64 }).notNull(),
    active: boolean("active").notNull().default(false),
    weights: jsonb("weights")
      .$type<Record<string, number>>()
      .notNull()
      .default(jsonObjectDefault),
    thresholds: jsonb("thresholds")
      .$type<Record<string, number>>()
      .notNull()
      .default(jsonObjectDefault),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("lead_scoring_configs_version_uq").on(table.version),
    index("lead_scoring_configs_active_idx").on(table.active, table.createdAt),
  ],
);

export const outreachCampaigns = pgTable(
  "outreach_campaigns",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    channel: outreachChannelEnum("channel").notNull().default("email"),
    status: campaignStatusEnum("status").notNull().default("draft"),
    objective: text("objective"),
    audience: varchar("audience", { length: 120 }),
    minimumScore: integer("minimum_score").notNull().default(0),
    location: varchar("location", { length: 160 }),
    bedroomsMin: integer("bedrooms_min"),
    bedroomsMax: integer("bedrooms_max"),
    unitCountMin: integer("unit_count_min"),
    startHour: varchar("start_hour", { length: 5 }),
    endHour: varchar("end_hour", { length: 5 }),
    weekdayRules: jsonb("weekday_rules")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dailyLimit: integer("daily_limit").notNull().default(25),
    sequenceSteps: jsonb("sequence_steps")
      .$type<Array<{ dayOffset: number; template: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    approvalMode: outreachApprovalModeEnum("approval_mode")
      .notNull()
      .default("HUMAN_APPROVAL"),
    autonomyLevel: autonomyLevelEnum("autonomy_level")
      .notNull()
      .default("LEVEL_1_HUMAN_APPROVAL"),
    suppressionPolicy: varchar("suppression_policy", { length: 120 })
      .notNull()
      .default("respect_global_suppression"),
    active: boolean("active").notNull().default(false),
    scheduledAt: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "date",
    }),
    launchedAt: timestamp("launched_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("outreach_campaigns_owner_status_idx").on(
      table.ownerUserId,
      table.status,
    ),
    index("outreach_campaigns_source_status_idx").on(
      table.sourceId,
      table.status,
    ),
  ],
);

export const outreachMessages = pgTable(
  "outreach_messages",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    channel: outreachChannelEnum("channel").notNull().default("email"),
    status: outreachMessageStatusEnum("status").notNull().default("queued"),
    externalMessageId: varchar("external_message_id", { length: 191 }),
    subject: varchar("subject", { length: 200 }),
    bodyText: text("body_text").notNull(),
    sentAt: timestamp("sent_at", {
      withTimezone: true,
      mode: "date",
    }),
    failedAt: timestamp("failed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("outreach_messages_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    index("outreach_messages_lead_status_idx").on(table.leadId, table.status),
    index("outreach_messages_contact_status_idx").on(
      table.contactId,
      table.status,
    ),
    uniqueIndex("outreach_messages_external_id_uq").on(table.externalMessageId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    channel: outreachChannelEnum("channel").notNull().default("email"),
    status: conversationStatusEnum("status").notNull().default("open"),
    inboxCategory: inboxCategoryEnum("inbox_category")
      .notNull()
      .default("UNCLEAR"),
    snoozedUntil: timestamp("snoozed_until", {
      withTimezone: true,
      mode: "date",
    }),
    aiSummary: text("ai_summary"),
    subject: varchar("subject", { length: 200 }),
    lastMessageAt: timestamp("last_message_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("conversations_owner_status_idx").on(table.ownerUserId, table.status),
    index("conversations_contact_status_idx").on(table.contactId, table.status),
    index("conversations_lead_status_idx").on(table.leadId, table.status),
    index("conversations_inbox_last_message_idx").on(
      table.inboxCategory,
      table.status,
      table.lastMessageAt,
    ),
  ],
);

export const outreachDrafts = pgTable(
  "outreach_drafts",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => outreachCampaigns.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    templateType: outreachDraftTemplateEnum("template_type").notNull(),
    status: outreachDraftStatusEnum("status").notNull().default("draft"),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    evidenceIds: jsonb("evidence_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    unsupportedClaims: jsonb("unsupported_claims")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    subject: varchar("subject", { length: 220 }).notNull(),
    bodyText: text("body_text").notNull(),
    whyThisLead: text("why_this_lead").notNull(),
  },
  (table) => [
    index("outreach_drafts_lead_status_idx").on(table.leadId, table.status),
    index("outreach_drafts_campaign_idx").on(table.campaignId),
    index("outreach_drafts_conversation_idx").on(table.conversationId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    ...baseColumns(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    outreachMessageId: text("outreach_message_id").references(
      () => outreachMessages.id,
      {
        onDelete: "set null",
      },
    ),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    direction: messageDirectionEnum("direction").notNull(),
    status: messageStatusEnum("status").notNull().default("queued"),
    bodyText: text("body_text").notNull(),
    externalMessageId: varchar("external_message_id", { length: 191 }),
    sentAt: timestamp("sent_at", {
      withTimezone: true,
      mode: "date",
    }),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
      mode: "date",
    }),
    readAt: timestamp("read_at", {
      withTimezone: true,
      mode: "date",
    }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("messages_direction_status_idx").on(table.direction, table.status),
    uniqueIndex("messages_external_id_uq").on(table.externalMessageId),
  ],
);

export const matches = pgTable(
  "matches",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    requirementId: text("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    status: matchStatusEnum("status").notNull().default("suggested"),
    score: integer("score").notNull().default(0),
    confidence: integer("confidence").notNull().default(0),
    matchVersion: varchar("match_version", { length: 64 }).notNull(),
    rationale: jsonb("rationale")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    uniqueIndex("matches_requirement_property_uq").on(
      table.requirementId,
      table.propertyId,
    ),
    index("matches_requirement_status_idx").on(
      table.requirementId,
      table.status,
    ),
    index("matches_property_status_idx").on(table.propertyId, table.status),
    index("matches_lead_status_idx").on(table.leadId, table.status),
  ],
);

export const replyIntelligenceEvents = pgTable(
  "reply_intelligence_events",
  {
    ...baseColumns(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    intent: inboxCategoryEnum("intent").notNull(),
    confidence: integer("confidence").notNull().default(0),
    extractedFacts: jsonb("extracted_facts")
      .$type<
        Array<{
          type: (typeof replyFactTypeEnum.enumValues)[number];
          value: string;
          confidence: number;
          sourceMessageId: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [
    uniqueIndex("reply_intelligence_message_uq").on(table.messageId),
    index("reply_intelligence_conversation_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("reply_intelligence_intent_idx").on(table.intent, table.confidence),
  ],
);

export const outreachSendAttempts = pgTable(
  "outreach_send_attempts",
  {
    ...baseColumns(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    outreachMessageId: text("outreach_message_id").references(
      () => outreachMessages.id,
      {
        onDelete: "set null",
      },
    ),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    dedupeKey: varchar("dedupe_key", { length: 220 }).notNull(),
    status: sendAttemptStatusEnum("status").notNull(),
    reason: text("reason"),
    policySnapshot: jsonb("policy_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    attemptedAt: timestamp("attempted_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("outreach_send_attempts_dedupe_uq").on(table.dedupeKey),
    index("outreach_send_attempts_campaign_idx").on(
      table.campaignId,
      table.attemptedAt,
    ),
    index("outreach_send_attempts_recipient_idx").on(table.recipient),
  ],
);

export const followUpQueue = pgTable(
  "follow_up_queue",
  {
    ...baseColumns(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    stepKey: varchar("step_key", { length: 64 }).notNull(),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    dedupeKey: varchar("dedupe_key", { length: 220 }).notNull(),
    status: followUpStatusEnum("status").notNull().default("scheduled"),
    reason: text("reason"),
  },
  (table) => [
    uniqueIndex("follow_up_queue_dedupe_uq").on(table.dedupeKey),
    index("follow_up_queue_campaign_status_idx").on(
      table.campaignId,
      table.status,
    ),
    index("follow_up_queue_schedule_idx").on(table.scheduledFor, table.status),
  ],
);

export const shortageIntelligenceRows = pgTable(
  "shortage_intelligence_rows",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    borough: varchar("borough", { length: 120 }),
    area: varchar("area", { length: 200 }),
    bedroomsBand: varchar("bedrooms_band", { length: 32 }).notNull(),
    unitCountBand: varchar("unit_count_band", { length: 32 }).notNull(),
    budgetBand: varchar("budget_band", { length: 32 }).notNull(),
    availabilityWindow: varchar("availability_window", { length: 64 }).notNull(),
    activeDemand: integer("active_demand").notNull().default(0),
    suitableStock: integer("suitable_stock").notNull().default(0),
    estimatedGap: integer("estimated_gap").notNull().default(0),
    priority: shortagePriorityEnum("priority").notNull().default("MEDIUM"),
    status: shortageStatusEnum("status").notNull().default("active"),
    trace: jsonb("trace")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    convertedObjectiveId: text("converted_objective_id").references(
      () => objectives.id,
      {
        onDelete: "set null",
      },
    ),
    convertedCampaignId: text("converted_campaign_id").references(
      () => outreachCampaigns.id,
      {
        onDelete: "set null",
      },
    ),
  },
  (table) => [
    uniqueIndex("shortage_intel_bucket_uq").on(
      table.borough,
      table.area,
      table.bedroomsBand,
      table.unitCountBand,
      table.budgetBand,
      table.availabilityWindow,
    ),
    index("shortage_intel_priority_idx").on(table.priority, table.status),
  ],
);

export const lhaRates = pgTable(
  "lha_rates",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    borough: varchar("borough", { length: 120 }),
    area: varchar("area", { length: 200 }),
    bedroomBand: varchar("bedroom_band", { length: 32 }).notNull(),
    monthlyRateCents: integer("monthly_rate_cents").notNull(),
    rateSource: varchar("rate_source", { length: 200 }).notNull(),
    rateReference: text("rate_reference").notNull(),
    rateDate: date("rate_date", { mode: "date" }).notNull(),
    rateVersion: varchar("rate_version", { length: 64 }).notNull(),
    sourceApproved: boolean("source_approved").notNull().default(false),
    notes: text("notes"),
  },
  (table) => [
    index("lha_rates_lookup_idx").on(table.borough, table.area, table.bedroomBand),
    uniqueIndex("lha_rates_version_uq").on(
      table.area,
      table.bedroomBand,
      table.rateDate,
      table.rateVersion,
    ),
  ],
);

export const economicsSignals = pgTable(
  "economics_signals",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    lhaRateId: text("lha_rate_id")
      .notNull()
      .references(() => lhaRates.id, { onDelete: "restrict" }),
    bedroomBand: varchar("bedroom_band", { length: 32 }).notNull(),
    knownRentCents: integer("known_rent_cents").notNull(),
    lhaRateCents: integer("lha_rate_cents").notNull(),
    differenceCents: integer("difference_cents").notNull(),
    signalStatus: economicsSignalStatusEnum("signal_status")
      .notNull()
      .default("new"),
    notifyEnabled: boolean("notify_enabled").notNull().default(false),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("economics_signals_property_rate_uq").on(
      table.propertyId,
      table.lhaRateId,
    ),
    index("economics_signals_status_idx").on(table.signalStatus, table.createdAt),
  ],
);

export const viewings = pgTable(
  "viewings",
  {
    ...baseColumns(),
    matchId: text("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id").references(() => requirements.id, {
      onDelete: "set null",
    }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    scheduledByUserId: text("scheduled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: viewingStatusEnum("status").notNull().default("proposed"),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    attendees: jsonb("attendees")
      .$type<Array<{ name: string; role?: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    outcome: text("outcome"),
    nextAction: text("next_action"),
    commercialNotes: text("commercial_notes"),
    reminderAt: timestamp("reminder_at", {
      withTimezone: true,
      mode: "date",
    }),
    notes: text("notes"),
  },
  (table) => [
    index("viewings_property_schedule_idx").on(
      table.propertyId,
      table.scheduledFor,
    ),
    index("viewings_requirement_schedule_idx").on(
      table.requirementId,
      table.scheduledFor,
    ),
    index("viewings_contact_schedule_idx").on(
      table.contactId,
      table.scheduledFor,
    ),
    index("viewings_match_status_idx").on(table.matchId, table.status),
  ],
);

export const deals = pgTable(
  "deals",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    propertyId: text("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    requirementId: text("requirement_id").references(() => requirements.id, {
      onDelete: "set null",
    }),
    matchId: text("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: dealStatusEnum("status").notNull().default("MATCHED"),
    nextAction: text("next_action"),
    commercialSummary: text("commercial_summary"),
    blockers: jsonb("blockers")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    valueCents: integer("value_cents"),
    expectedCloseAt: date("expected_close_at", { mode: "date" }),
    closedAt: timestamp("closed_at", {
      withTimezone: true,
      mode: "date",
    }),
    summary: text("summary"),
  },
  (table) => [
    index("deals_owner_status_idx").on(table.ownerUserId, table.status),
    index("deals_company_status_idx").on(table.companyId, table.status),
    index("deals_property_status_idx").on(table.propertyId, table.status),
    index("deals_requirement_status_idx").on(table.requirementId, table.status),
    index("deals_lead_status_idx").on(table.leadId, table.status),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    dealId: text("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    viewingId: text("viewing_id").references(() => viewings.id, {
      onDelete: "set null",
    }),
    objectiveId: text("objective_id").references(() => objectives.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    dueAt: timestamp("due_at", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("tasks_assignee_status_idx").on(table.assignedToUserId, table.status),
    index("tasks_creator_status_idx").on(table.createdByUserId, table.status),
    index("tasks_deal_status_idx").on(table.dealId, table.status),
    index("tasks_lead_status_idx").on(table.leadId, table.status),
    index("tasks_due_idx").on(table.dueAt),
  ],
);

export const objectives = pgTable(
  "objectives",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: objectiveStatusEnum("status").notNull().default("draft"),
    targetValue: integer("target_value"),
    currentValue: integer("current_value"),
    dueAt: date("due_at", { mode: "date" }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("objectives_owner_status_idx").on(table.ownerUserId, table.status),
    index("objectives_due_idx").on(table.dueAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    linkHref: text("link_href"),
    status: notificationStatusEnum("status").notNull().default("unread"),
    readAt: timestamp("read_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("notifications_user_status_idx").on(table.userId, table.status),
    index("notifications_task_status_idx").on(table.taskId, table.status),
    index("notifications_created_idx").on(table.createdAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    ...baseColumns(),
    actorType: auditActorTypeEnum("actor_type").notNull().default("user"),
    actorId: text("actor_id").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: text("entity_id").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
    afterState: jsonb("after_state").$type<Record<string, unknown>>(),
    requestId: varchar("request_id", { length: 120 }),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_occurred_idx").on(table.occurredAt),
    index("audit_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("audit_events_actor_type_id_idx").on(table.actorType, table.actorId),
    index("audit_events_action_created_idx").on(table.action, table.createdAt),
  ],
);

export const suppressionList = pgTable(
  "suppression_list",
  {
    ...baseColumns(),
    archivedAt: archivedAtColumn(),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    channel: suppressionChannelEnum("channel").notNull(),
    value: varchar("value", { length: 320 }).notNull(),
    reason: suppressionReasonEnum("reason").notNull().default("manual"),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("suppression_list_channel_value_uq").on(
      table.channel,
      table.value,
    ),
    index("suppression_list_contact_idx").on(table.contactId),
    index("suppression_list_reason_idx").on(table.reason),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    ...baseColumns(),
    workerName: varchar("worker_name", { length: 120 }).notNull(),
    queueName: varchar("queue_name", { length: 80 }).notNull().default("default"),
    idempotencyKey: varchar("idempotency_key", { length: 220 }),
    triggeredByUserId: text("triggered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    jobName: varchar("job_name", { length: 160 }).notNull(),
    status: jobRunStatusEnum("status").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    }),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    startedBy: varchar("started_by", { length: 120 }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", {
      withTimezone: true,
      mode: "date",
    }),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "date",
    }),
    durationMs: integer("duration_ms"),
    itemsProcessed: integer("items_processed").notNull().default(0),
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: text("error_message"),
    deadLettered: boolean("dead_lettered").notNull().default(false),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    result: jsonb("result")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    index("job_runs_name_status_idx").on(table.jobName, table.status),
    index("job_runs_worker_status_idx").on(table.workerName, table.status),
    index("job_runs_triggered_by_idx").on(table.triggeredByUserId),
    index("job_runs_source_idx").on(table.sourceId),
    uniqueIndex("job_runs_idempotency_uq").on(table.idempotencyKey),
    index("job_runs_started_at_idx").on(table.startedAt),
  ],
);

export const workerControls = pgTable(
  "worker_controls",
  {
    ...baseColumns(),
    workerName: varchar("worker_name", { length: 120 }).notNull(),
    paused: boolean("paused").notNull().default(false),
    concurrencyLimit: integer("concurrency_limit").notNull().default(1),
    notes: text("notes"),
  },
  (table) => [uniqueIndex("worker_controls_worker_uq").on(table.workerName)],
);

export const queueItems = pgTable(
  "queue_items",
  {
    ...baseColumns(),
    workerName: varchar("worker_name", { length: 120 }).notNull(),
    queueName: varchar("queue_name", { length: 80 }).notNull().default("default"),
    idempotencyKey: varchar("idempotency_key", { length: 220 }),
    status: queueItemStatusEnum("status").notNull().default("queued"),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lockedBy: varchar("locked_by", { length: 120 }),
    lockedAt: timestamp("locked_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastError: text("last_error"),
    deadLetterReason: text("dead_letter_reason"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    index("queue_items_worker_status_idx").on(table.workerName, table.status),
    index("queue_items_schedule_idx").on(table.scheduledFor, table.status),
    uniqueIndex("queue_items_idempotency_uq").on(table.idempotencyKey),
  ],
);

export const workerHealthSnapshots = pgTable(
  "worker_health_snapshots",
  {
    ...baseColumns(),
    workerName: varchar("worker_name", { length: 120 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    queueDepth: integer("queue_depth").notNull().default(0),
    runningCount: integer("running_count").notNull().default(0),
    recentFailures: integer("recent_failures").notNull().default(0),
    lastRunAt: timestamp("last_run_at", {
      withTimezone: true,
      mode: "date",
    }),
    notes: text("notes"),
  },
  (table) => [index("worker_health_worker_created_idx").on(table.workerName, table.createdAt)],
);

export const pqQuestProfiles = pgTable(
  "pq_quest_profiles",
  {
    ...baseColumns(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    totalXp: integer("total_xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    streakDays: integer("streak_days").notNull().default(0),
    lastXpAt: timestamp("last_xp_at", {
      withTimezone: true,
      mode: "date",
    }),
    unlockedChapters: jsonb("unlocked_chapters")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (table) => [uniqueIndex("pq_quest_profiles_user_uq").on(table.userId)],
);

export const pqQuestXpEvents = pgTable(
  "pq_quest_xp_events",
  {
    ...baseColumns(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceEventId: text("source_event_id").notNull(),
    sourceAction: varchar("source_action", { length: 120 }).notNull(),
    chapter: questChapterEnum("chapter").notNull(),
    xpAwarded: integer("xp_awarded").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    uniqueIndex("pq_quest_xp_source_event_uq").on(table.sourceEventId),
    index("pq_quest_xp_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const pqQuestObjectives = pgTable(
  "pq_quest_objectives",
  {
    ...baseColumns(),
    chapter: questChapterEnum("chapter").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    objectiveType: varchar("objective_type", { length: 40 }).notNull(),
    targetCount: integer("target_count").notNull().default(1),
    currentCount: integer("current_count").notNull().default(0),
    bossObjective: boolean("boss_objective").notNull().default(false),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    linkedObjectiveId: text("linked_objective_id").references(() => objectives.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [index("pq_quest_objectives_chapter_idx").on(table.chapter, table.createdAt)],
);

export const analyticsFunnelSnapshots = pgTable(
  "analytics_funnel_snapshots",
  {
    ...baseColumns(),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    campaignId: text("campaign_id").references(() => outreachCampaigns.id, {
      onDelete: "set null",
    }),
    leadType: leadTypeEnum("lead_type"),
    area: varchar("area", { length: 200 }),
    bedroomsBand: varchar("bedrooms_band", { length: 32 }),
    agentUserId: text("agent_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    periodStart: date("period_start", { mode: "date" }).notNull(),
    periodEnd: date("period_end", { mode: "date" }).notNull(),
    metric: analyticsMetricEnum("metric").notNull(),
    value: integer("value").notNull().default(0),
    trace: jsonb("trace")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    index("analytics_funnel_metric_period_idx").on(table.metric, table.periodStart),
    index("analytics_funnel_source_campaign_idx").on(table.sourceId, table.campaignId),
  ],
);

export const directnessAssessments = pgTable(
  "directness_assessments",
  {
    ...baseColumns(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    entityName: varchar("entity_name", { length: 200 }).notNull(),
    personName: varchar("person_name", { length: 200 }),
    roleTitle: varchar("role_title", { length: 160 }),
    relationshipToPropertyOrCompany: text("relationship_to_property_or_company")
      .notNull(),
    evidenceSource: varchar("evidence_source", { length: 160 }).notNull(),
    evidenceReference: text("evidence_reference").notNull(),
    evidenceType: varchar("evidence_type", { length: 80 }).notNull(),
    evidenceDate: date("evidence_date", { mode: "date" }).notNull(),
    explanation: text("explanation").notNull(),
    confidence: integer("confidence").notNull().default(0),
    classification: directnessClassificationEnum("classification")
      .notNull()
      .default("UNKNOWN"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    conflictDetected: boolean("conflict_detected").notNull().default(false),
  },
  (table) => [
    index("directness_assessments_lead_idx").on(table.leadId, table.createdAt),
    index("directness_assessments_classification_idx").on(
      table.classification,
      table.verificationStatus,
    ),
  ],
);

export const acquisitionMissions = pgTable(
  "acquisition_missions",
  {
    ...baseColumns(),
    objectiveId: text("objective_id").references(() => objectives.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    missionType: missionTypeEnum("mission_type").notNull(),
    status: missionStatusEnum("status").notNull().default("draft"),
    title: varchar("title", { length: 220 }).notNull(),
    missionObjective: text("mission_objective").notNull(),
    scope: jsonb("scope")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
    targetQualifiedProspects: integer("target_qualified_prospects")
      .notNull()
      .default(0),
    targetOutreachReadyProspects: integer("target_outreach_ready_prospects")
      .notNull()
      .default(0),
    candidatesDiscovered: integer("candidates_discovered").notNull().default(0),
    candidatesRejected: integer("candidates_rejected").notNull().default(0),
    candidatesAwaitingVerification: integer("candidates_awaiting_verification")
      .notNull()
      .default(0),
    qualifiedProspects: integer("qualified_prospects").notNull().default(0),
    outreachReadyProspects: integer("outreach_ready_prospects").notNull().default(0),
    responses: integer("responses").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    stopReason: text("stop_reason"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }),
    endedAt: timestamp("ended_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("acquisition_missions_status_idx").on(table.status, table.createdAt),
    index("acquisition_missions_type_idx").on(table.missionType, table.status),
  ],
);

export const acquisitionMissionRuns = pgTable(
  "acquisition_mission_runs",
  {
    ...baseColumns(),
    missionId: text("mission_id")
      .notNull()
      .references(() => acquisitionMissions.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("running"),
    cycleStartedAt: timestamp("cycle_started_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    cycleEndedAt: timestamp("cycle_ended_at", {
      withTimezone: true,
      mode: "date",
    }),
    discovered: integer("discovered").notNull().default(0),
    qualified: integer("qualified").notNull().default(0),
    outreachReady: integer("outreach_ready").notNull().default(0),
    awaitingVerification: integer("awaiting_verification").notNull().default(0),
    targetReached: boolean("target_reached").notNull().default(false),
    errorMessage: text("error_message"),
    trace: jsonb("trace")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    index("acquisition_mission_runs_mission_idx").on(
      table.missionId,
      table.createdAt,
    ),
    index("acquisition_mission_runs_status_idx").on(table.status, table.createdAt),
  ],
);

export const demandHeatmapCells = pgTable(
  "demand_heatmap_cells",
  {
    ...baseColumns(),
    area: varchar("area", { length: 200 }),
    borough: varchar("borough", { length: 120 }),
    town: varchar("town", { length: 120 }),
    postcode: varchar("postcode", { length: 32 }),
    bedroomsBand: varchar("bedrooms_band", { length: 32 }).notNull(),
    propertyType: propertyTypeEnum("property_type").notNull().default("other"),
    budgetBand: varchar("budget_band", { length: 32 }).notNull(),
    corporateRequirementLabel: varchar("corporate_requirement_label", {
      length: 220,
    }),
    requirementsCount: integer("requirements_count").notNull().default(0),
    suitablePropertiesCount: integer("suitable_properties_count")
      .notNull()
      .default(0),
    shortageRatio: integer("shortage_ratio").notNull().default(0),
    demandTrendScore: integer("demand_trend_score").notNull().default(0),
    status: demandHeatStatusEnum("status").notNull().default("BALANCED"),
    trace: jsonb("trace")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObjectDefault),
  },
  (table) => [
    uniqueIndex("demand_heatmap_cell_uq").on(
      table.area,
      table.borough,
      table.town,
      table.postcode,
      table.bedroomsBand,
      table.propertyType,
      table.budgetBand,
    ),
    index("demand_heatmap_status_idx").on(table.status, table.shortageRatio),
  ],
);

export const acquisitionExclusions = pgTable(
  "acquisition_exclusions",
  {
    ...baseColumns(),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    missionId: text("mission_id").references(() => acquisitionMissions.id, {
      onDelete: "set null",
    }),
    reason: exclusionReasonEnum("reason").notNull(),
    explanation: text("explanation").notNull(),
    confidence: integer("confidence").notNull().default(0),
  },
  (table) => [index("acquisition_exclusions_reason_idx").on(table.reason, table.createdAt)],
);

export const relationshipGraphEdges = pgTable(
  "relationship_graph_edges",
  {
    ...baseColumns(),
    fromEntityType: varchar("from_entity_type", { length: 80 }).notNull(),
    fromEntityId: text("from_entity_id").notNull(),
    toEntityType: varchar("to_entity_type", { length: 80 }).notNull(),
    toEntityId: text("to_entity_id").notNull(),
    relationshipLabel: varchar("relationship_label", { length: 120 }).notNull(),
    confidence: integer("confidence").notNull().default(0),
    evidenceId: text("evidence_id").references(() => evidence.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("relationship_graph_edge_uq").on(
      table.fromEntityType,
      table.fromEntityId,
      table.toEntityType,
      table.toEntityId,
      table.relationshipLabel,
    ),
    index("relationship_graph_from_idx").on(table.fromEntityType, table.fromEntityId),
    index("relationship_graph_to_idx").on(table.toEntityType, table.toEntityId),
  ],
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    ...baseColumns(),
    type: varchar("type", { length: 80 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    body: text("body").notNull(),
    severity: varchar("severity", { length: 24 }).notNull().default("info"),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    missionId: text("mission_id").references(() => acquisitionMissions.id, {
      onDelete: "set null",
    }),
    acknowledgedByUserId: text("acknowledged_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acknowledgedAt: timestamp("acknowledged_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [index("agent_messages_type_created_idx").on(table.type, table.createdAt)],
);

export const pilotFeedbackLabelEnum = pgEnum("pilot_feedback_label", [
  "GOOD_AI",
  "WRONG",
  "MISSING",
  "NEEDS_HUMAN",
]);

export const pilotFeedback = pgTable(
  "pilot_feedback",
  {
    ...baseColumns(),
    workflowKey: varchar("workflow_key", { length: 80 }).notNull(),
    feedbackLabel: pilotFeedbackLabelEnum("feedback_label").notNull(),
    notes: text("notes"),
    entityType: varchar("entity_type", { length: 80 }),
    entityId: text("entity_id"),
    submittedByUserId: text("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("pilot_feedback_workflow_created_idx").on(
      table.workflowKey,
      table.createdAt,
    ),
    index("pilot_feedback_label_created_idx").on(
      table.feedbackLabel,
      table.createdAt,
    ),
    index("pilot_feedback_user_created_idx").on(
      table.submittedByUserId,
      table.createdAt,
    ),
  ],
);
