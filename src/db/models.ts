import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import {
  auditEvents,
  companies,
  contacts,
  conversations,
  deals,
  documents,
  evidence,
  jobRuns,
  leadScoringConfigs,
  leads,
  aiConclusions,
  matches,
  messages,
  notifications,
  objectives,
  outreachDrafts,
  outreachCampaigns,
  outreachMessages,
  properties,
  propertyMedia,
  replyIntelligenceEvents,
  requirements,
  signals,
  sources,
  suppressionList,
  tasks,
  followUpQueue,
  shortageIntelligenceRows,
  lhaRates,
  economicsSignals,
  outreachSendAttempts,
  pqQuestObjectives,
  pqQuestProfiles,
  pqQuestXpEvents,
  users,
  viewings,
  workerControls,
  queueItems,
  workerHealthSnapshots,
  analyticsFunnelSnapshots,
  acquisitionExclusions,
  acquisitionMissions,
  acquisitionMissionRuns,
  agentMessages,
  demandHeatmapCells,
  directnessAssessments,
  relationshipGraphEdges,
  pilotFeedback,
} from "./schema";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Company = InferSelectModel<typeof companies>;
export type NewCompany = InferInsertModel<typeof companies>;
export type Contact = InferSelectModel<typeof contacts>;
export type NewContact = InferInsertModel<typeof contacts>;
export type Property = InferSelectModel<typeof properties>;
export type NewProperty = InferInsertModel<typeof properties>;
export type PropertyMedium = InferSelectModel<typeof propertyMedia>;
export type NewPropertyMedium = InferInsertModel<typeof propertyMedia>;
export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;
export type Requirement = InferSelectModel<typeof requirements>;
export type NewRequirement = InferInsertModel<typeof requirements>;
export type Lead = InferSelectModel<typeof leads>;
export type NewLead = InferInsertModel<typeof leads>;
export type Signal = InferSelectModel<typeof signals>;
export type NewSignal = InferInsertModel<typeof signals>;
export type Evidence = InferSelectModel<typeof evidence>;
export type NewEvidence = InferInsertModel<typeof evidence>;
export type AiConclusion = InferSelectModel<typeof aiConclusions>;
export type NewAiConclusion = InferInsertModel<typeof aiConclusions>;
export type Source = InferSelectModel<typeof sources>;
export type NewSource = InferInsertModel<typeof sources>;
export type LeadScoringConfig = InferSelectModel<typeof leadScoringConfigs>;
export type NewLeadScoringConfig = InferInsertModel<typeof leadScoringConfigs>;
export type OutreachCampaign = InferSelectModel<typeof outreachCampaigns>;
export type NewOutreachCampaign = InferInsertModel<typeof outreachCampaigns>;
export type OutreachDraft = InferSelectModel<typeof outreachDrafts>;
export type NewOutreachDraft = InferInsertModel<typeof outreachDrafts>;
export type OutreachMessage = InferSelectModel<typeof outreachMessages>;
export type NewOutreachMessage = InferInsertModel<typeof outreachMessages>;
export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
export type ReplyIntelligenceEvent = InferSelectModel<
  typeof replyIntelligenceEvents
>;
export type NewReplyIntelligenceEvent = InferInsertModel<
  typeof replyIntelligenceEvents
>;
export type OutreachSendAttempt = InferSelectModel<typeof outreachSendAttempts>;
export type NewOutreachSendAttempt = InferInsertModel<
  typeof outreachSendAttempts
>;
export type FollowUpQueueItem = InferSelectModel<typeof followUpQueue>;
export type NewFollowUpQueueItem = InferInsertModel<typeof followUpQueue>;
export type ShortageIntelligenceRow = InferSelectModel<
  typeof shortageIntelligenceRows
>;
export type NewShortageIntelligenceRow = InferInsertModel<
  typeof shortageIntelligenceRows
>;
export type LhaRate = InferSelectModel<typeof lhaRates>;
export type NewLhaRate = InferInsertModel<typeof lhaRates>;
export type EconomicsSignal = InferSelectModel<typeof economicsSignals>;
export type NewEconomicsSignal = InferInsertModel<typeof economicsSignals>;
export type Match = InferSelectModel<typeof matches>;
export type NewMatch = InferInsertModel<typeof matches>;
export type Viewing = InferSelectModel<typeof viewings>;
export type NewViewing = InferInsertModel<typeof viewings>;
export type Deal = InferSelectModel<typeof deals>;
export type NewDeal = InferInsertModel<typeof deals>;
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type Objective = InferSelectModel<typeof objectives>;
export type NewObjective = InferInsertModel<typeof objectives>;
export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type NewAuditEvent = InferInsertModel<typeof auditEvents>;
export type SuppressionListEntry = InferSelectModel<typeof suppressionList>;
export type NewSuppressionListEntry = InferInsertModel<typeof suppressionList>;
export type JobRun = InferSelectModel<typeof jobRuns>;
export type NewJobRun = InferInsertModel<typeof jobRuns>;
export type WorkerControl = InferSelectModel<typeof workerControls>;
export type NewWorkerControl = InferInsertModel<typeof workerControls>;
export type QueueItem = InferSelectModel<typeof queueItems>;
export type NewQueueItem = InferInsertModel<typeof queueItems>;
export type WorkerHealthSnapshot = InferSelectModel<typeof workerHealthSnapshots>;
export type NewWorkerHealthSnapshot = InferInsertModel<typeof workerHealthSnapshots>;
export type PqQuestProfile = InferSelectModel<typeof pqQuestProfiles>;
export type NewPqQuestProfile = InferInsertModel<typeof pqQuestProfiles>;
export type PqQuestXpEvent = InferSelectModel<typeof pqQuestXpEvents>;
export type NewPqQuestXpEvent = InferInsertModel<typeof pqQuestXpEvents>;
export type PqQuestObjective = InferSelectModel<typeof pqQuestObjectives>;
export type NewPqQuestObjective = InferInsertModel<typeof pqQuestObjectives>;
export type AnalyticsFunnelSnapshot = InferSelectModel<typeof analyticsFunnelSnapshots>;
export type NewAnalyticsFunnelSnapshot = InferInsertModel<typeof analyticsFunnelSnapshots>;
export type DirectnessAssessment = InferSelectModel<typeof directnessAssessments>;
export type NewDirectnessAssessment = InferInsertModel<typeof directnessAssessments>;
export type AcquisitionMission = InferSelectModel<typeof acquisitionMissions>;
export type NewAcquisitionMission = InferInsertModel<typeof acquisitionMissions>;
export type AcquisitionMissionRun = InferSelectModel<typeof acquisitionMissionRuns>;
export type NewAcquisitionMissionRun = InferInsertModel<typeof acquisitionMissionRuns>;
export type DemandHeatmapCell = InferSelectModel<typeof demandHeatmapCells>;
export type NewDemandHeatmapCell = InferInsertModel<typeof demandHeatmapCells>;
export type AcquisitionExclusion = InferSelectModel<typeof acquisitionExclusions>;
export type NewAcquisitionExclusion = InferInsertModel<typeof acquisitionExclusions>;
export type RelationshipGraphEdge = InferSelectModel<typeof relationshipGraphEdges>;
export type NewRelationshipGraphEdge = InferInsertModel<typeof relationshipGraphEdges>;
export type AgentMessage = InferSelectModel<typeof agentMessages>;
export type NewAgentMessage = InferInsertModel<typeof agentMessages>;
export type PilotFeedback = InferSelectModel<typeof pilotFeedback>;
export type NewPilotFeedback = InferInsertModel<typeof pilotFeedback>;
