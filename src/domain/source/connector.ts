export type SourceConnectorContext = Readonly<{
  sourceId: string;
  connectorKey: string;
  allowedData: string[];
  rateLimitPerMinute: number;
}>;

export interface SourceConnector<TDiscovered = unknown, TNormalised = unknown> {
  discover(context: SourceConnectorContext): Promise<TDiscovered[]>;
  healthCheck(context: SourceConnectorContext): Promise<{
    healthy: boolean;
    message: string;
    checkedAt: Date;
  }>;
  normalise(record: TDiscovered): TNormalised;
  rateLimitPolicy(context: SourceConnectorContext): {
    maxRequestsPerMinute: number;
    burst: number;
  };
  provenance(record: TDiscovered): {
    sourceName: string;
    externalId?: string;
    capturedAt: Date;
    note?: string;
  };
}
