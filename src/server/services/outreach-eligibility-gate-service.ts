type DirectnessClassification =
  | "DIRECT"
  | "INTERMEDIARY"
  | "UNKNOWN"
  | "SUPPRESSED";

export type OutreachEligibilityInput = {
  globalKillSwitchOff: boolean;
  directnessClassification: DirectnessClassification;
  directnessVerified: boolean;
  directnessConfidence: number;
  directnessEvidenceCount: number;
  suppressed: boolean;
  optedOut: boolean;
  sourceAllowed: boolean;
  connectorHealthy: boolean;
  campaignStatusAllowed: boolean;
  campaignActive: boolean;
  scoreThresholdMet: boolean;
  hasEvidence: boolean;
  messageApproved: boolean;
  withinWindow: boolean;
  respects0830WeekdayRule: boolean;
  dailyLimitNotExceeded: boolean;
  frequencyLimitNotExceeded: boolean;
  noRecentDuplicateSend: boolean;
  recipientValid: boolean;
  approvalModeAllowed: boolean;
  autonomyLevelAllowsSend: boolean;
  level3GlobalEnabledForCampaign: boolean;
  level2AutoFollowUpSatisfied: boolean;
};

export function createOutreachEligibilityGateService() {
  return {
    evaluate(input: OutreachEligibilityInput) {
      const checks = {
        globalKillSwitchOff: input.globalKillSwitchOff,
        directnessIsDirect: input.directnessClassification === "DIRECT",
        directnessVerified: input.directnessVerified,
        sufficientDirectnessEvidence:
          input.directnessEvidenceCount >= 1 && input.directnessConfidence >= 70,
        notSuppressed: !input.suppressed,
        notOptedOut: !input.optedOut,
        sourceAllowed: input.sourceAllowed,
        connectorHealthy: input.connectorHealthy,
        campaignStatusAllowed: input.campaignStatusAllowed,
        campaignActive: input.campaignActive,
        scoreThresholdMet: input.scoreThresholdMet,
        hasEvidence: input.hasEvidence,
        messageApproved: input.messageApproved,
        withinWindow: input.withinWindow,
        respects0830WeekdayRule: input.respects0830WeekdayRule,
        dailyLimitNotExceeded: input.dailyLimitNotExceeded,
        frequencyLimitNotExceeded: input.frequencyLimitNotExceeded,
        noRecentDuplicateSend: input.noRecentDuplicateSend,
        recipientValid: input.recipientValid,
        approvalModeAllowed: input.approvalModeAllowed,
        autonomyLevelAllowsSend: input.autonomyLevelAllowsSend,
        level3GlobalEnabledForCampaign: input.level3GlobalEnabledForCampaign,
        level2AutoFollowUpSatisfied: input.level2AutoFollowUpSatisfied,
      };

      const failedReasons = Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([reason]) => reason);

      return {
        eligible: failedReasons.length === 0,
        checks,
        failedReasons,
      };
    },
  };
}
