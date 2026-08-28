import type {
  sourceHealthEnum,
  sourceKindEnum,
  sourcePermissionStatusEnum,
} from "@/db/schema";

export type SourceKind = (typeof sourceKindEnum.enumValues)[number];
export type SourcePermissionStatus =
  (typeof sourcePermissionStatusEnum.enumValues)[number];
export type SourceHealth = (typeof sourceHealthEnum.enumValues)[number];

export interface SourceRegistryMutationInput {
  name: string;
  kind: SourceKind;
  connectorKey?: string;
  permissionStatus: SourcePermissionStatus;
  allowedData?: string;
  rateLimitPerMinute?: number;
  enabled: boolean;
  health: SourceHealth;
  notes?: string;
  config?: Record<string, unknown>;
}
