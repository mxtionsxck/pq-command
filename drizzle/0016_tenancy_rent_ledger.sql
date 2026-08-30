CREATE TYPE "public"."tenancy_status" AS ENUM('draft', 'active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rent_frequency" AS ENUM('weekly', 'monthly', 'quarterly');--> statement-breakpoint
CREATE TYPE "public"."rent_ledger_type" AS ENUM('tenant_due', 'tenant_received', 'landlord_payable', 'landlord_paid');--> statement-breakpoint
CREATE TYPE "public"."rent_ledger_status" AS ENUM('UPCOMING', 'DUE_SOON', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED', 'PAYABLE', 'PAID_TO_LANDLORD', 'CANCELLED');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tenancies" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  "deal_id" text,
  "property_id" text,
  "landlord_company_id" text,
  "tenant_company_id" text,
  "owner_user_id" text,
  "status" "tenancy_status" DEFAULT 'draft' NOT NULL,
  "rent_frequency" "rent_frequency" DEFAULT 'monthly' NOT NULL,
  "rent_amount_cents" integer,
  "rent_due_day_of_month" integer,
  "tenancy_start_date" date,
  "tenancy_end_date" date,
  "landlord_payment_lead_days" integer DEFAULT 2 NOT NULL,
  "payment_reference" varchar(120),
  "notes" text
);--> statement-breakpoint

ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_landlord_company_id_companies_id_fk" FOREIGN KEY ("landlord_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_company_id_companies_id_fk" FOREIGN KEY ("tenant_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tenancies_status_idx" ON "tenancies" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenancies_property_idx" ON "tenancies" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenancies_deal_idx" ON "tenancies" USING btree ("deal_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "rent_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  "tenancy_id" text NOT NULL,
  "deal_id" text,
  "property_id" text,
  "entry_type" "rent_ledger_type" NOT NULL,
  "status" "rent_ledger_status" NOT NULL,
  "due_date" date,
  "payment_date" date,
  "amount_due_cents" integer DEFAULT 0 NOT NULL,
  "amount_received_cents" integer DEFAULT 0 NOT NULL,
  "amount_outstanding_cents" integer DEFAULT 0 NOT NULL,
  "payment_reference" varchar(120),
  "external_reference" varchar(191),
  "notes" text
);--> statement-breakpoint

ALTER TABLE "rent_ledger_entries" ADD CONSTRAINT "rent_ledger_entries_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_ledger_entries" ADD CONSTRAINT "rent_ledger_entries_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_ledger_entries" ADD CONSTRAINT "rent_ledger_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rent_ledger_tenancy_type_idx" ON "rent_ledger_entries" USING btree ("tenancy_id","entry_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rent_ledger_status_due_idx" ON "rent_ledger_entries" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rent_ledger_payment_date_idx" ON "rent_ledger_entries" USING btree ("payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rent_ledger_external_ref_uq" ON "rent_ledger_entries" USING btree ("external_reference");--> statement-breakpoint

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tenancy_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_tenancy_status_idx" ON "documents" USING btree ("tenancy_id","status");