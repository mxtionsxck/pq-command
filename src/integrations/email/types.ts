export interface EmailThreadMessage {
  providerMessageId: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  bodyText: string;
  sentAt: Date;
  direction: "inbound" | "outbound";
  status: "queued" | "sent" | "delivered" | "read" | "failed";
}

export interface SendEmailInput {
  threadId?: string;
  to: string[];
  subject: string;
  bodyText: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  providerMessageId: string;
  threadId: string;
  status: "queued" | "sent";
}

export interface InboxSyncResult {
  synced: number;
  messages: EmailThreadMessage[];
}

export interface ProviderWebhookEvent {
  type: "delivery" | "read" | "bounce" | "inbound";
  providerMessageId: string;
  threadId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface EmailProviderAdapter {
  providerName: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
  syncInbox(cursor?: string): Promise<InboxSyncResult>;
  mapThread(providerThreadId: string): Promise<{ conversationId?: string }>;
  getMessageStatus(
    providerMessageId: string,
  ): Promise<EmailThreadMessage["status"]>;
  pollWebhookEvents(cursor?: string): Promise<ProviderWebhookEvent[]>;
}
