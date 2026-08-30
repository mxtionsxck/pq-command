import { listIntegrations } from "@/integrations";
import { appEnv } from "@/lib/env";

type ProviderState = "connected" | "configuration_required" | "not_enabled";

export function createProviderReadinessService() {
  return {
    getOutreachReadiness() {
      const integrations = listIntegrations(appEnv);
      const emailState = integrations.find((item) => item.name === "email.delivery")?.status;

      const resolvedEmail: ProviderState =
        emailState === "connected"
          ? "connected"
          : emailState === "not_enabled"
            ? "not_enabled"
            : "configuration_required";

      return {
        email: {
          status: resolvedEmail,
          detail:
            resolvedEmail === "connected"
              ? "Email delivery provider is connected."
              : "Email delivery provider is not fully configured yet.",
        },
        sms: {
          status: "not_enabled" as const,
          detail: "SMS channel is not enabled in this environment.",
        },
        whatsapp: {
          status: "not_enabled" as const,
          detail: "WhatsApp channel is not enabled in this environment.",
        },
      };
    },
  };
}
