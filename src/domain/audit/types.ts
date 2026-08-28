export const auditActorTypes = ["user", "system", "job"] as const;

export type AuditActorType = (typeof auditActorTypes)[number];

export interface AuditActor {
  type: AuditActorType;
  id: string;
  userId?: string;
}

export interface AuditEventInput {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  requestId?: string;
}
