import type {
  EmailProviderAdapter,
  EmailThreadMessage,
  InboxSyncResult,
  ProviderWebhookEvent,
  SendEmailInput,
  SendEmailResult,
} from "./types";

export function createMockEmailProviderAdapter(
  seedMessages: EmailThreadMessage[] = [],
): EmailProviderAdapter {
  const messages = [...seedMessages];
  const threadMapping = new Map<string, { conversationId?: string }>();

  return {
    providerName: "mock-email",

    async send(input: SendEmailInput): Promise<SendEmailResult> {
      const threadId = input.threadId ?? `thr_${messages.length + 1}`;
      const providerMessageId = `mock_msg_${messages.length + 1}`;

      messages.push({
        providerMessageId,
        threadId,
        from: "agent@pqcommand.local",
        to: input.to,
        subject: input.subject,
        bodyText: input.bodyText,
        sentAt: new Date(),
        direction: "outbound",
        status: "queued",
      });

      return {
        providerMessageId,
        threadId,
        status: "queued",
      };
    },

    async syncInbox(): Promise<InboxSyncResult> {
      return {
        synced: messages.length,
        messages: [...messages],
      };
    },

    async mapThread(providerThreadId: string) {
      return threadMapping.get(providerThreadId) ?? {};
    },

    async getMessageStatus(providerMessageId: string) {
      return (
        messages.find((item) => item.providerMessageId === providerMessageId)
          ?.status ?? "failed"
      );
    },

    async pollWebhookEvents(): Promise<ProviderWebhookEvent[]> {
      return [];
    },
  };
}
