DROP INDEX IF EXISTS "sources_connector_key_uq";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_connector_key_idx" ON "sources" USING btree ("connector_key");