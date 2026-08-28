import assert from "node:assert/strict";
import test from "node:test";

import { consumeRateLimit } from "../src/server/security/rate-limit";
import { createPilotModeService } from "../src/server/services/pilot-mode-service";

const actor = {
  type: "user" as const,
  id: "usr_pilot",
  userId: "usr_pilot",
  role: "AGENT" as const,
};

test("prompt 43 auth/api rate limiter blocks requests over quota within window", () => {
  const key = `test-rate-${Date.now()}`;

  const first = consumeRateLimit({
    key,
    max: 2,
    windowMs: 60_000,
  });
  const second = consumeRateLimit({
    key,
    max: 2,
    windowMs: 60_000,
  });
  const third = consumeRateLimit({
    key,
    max: 2,
    windowMs: 60_000,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(typeof third.retryAfterSeconds, "number");
});

test("prompt 44 pilot mode exposes guided workflows and daily summary", async () => {
  const service = createPilotModeService({
    repository: {
      async workflowQueueCounts() {
        return {
          review_overnight_leads: 3,
          qualify_stock: 4,
          review_direct_demand: 2,
          approve_outreach: 5,
          handle_hot_replies: 1,
          create_requirement: 2,
          review_matches: 6,
          book_viewing: 1,
          progress_deal: 2,
          review_ai_errors: 1,
        };
      },
      async listFeedbackSummaryForDay() {
        return [
          { feedbackLabel: "GOOD_AI", total: 3 },
          { feedbackLabel: "WRONG", total: 1 },
          { feedbackLabel: "MISSING", total: 2 },
          { feedbackLabel: "NEEDS_HUMAN", total: 1 },
        ];
      },
      async listFeedbackEvents() {
        return [
          {
            id: "plf_1",
            workflowKey: "approve_outreach",
            feedbackLabel: "GOOD_AI",
            notes: "solid draft",
          },
        ];
      },
      async addFeedback() {
        return { id: "plf_new" };
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_pilot" };
      },
    } as never,
    now: () => new Date("2026-08-28T09:00:00.000Z"),
  });

  const dashboard = await service.getDashboard();

  assert.equal(dashboard.workflows.length, 10);
  assert.equal(dashboard.dailySummary.totalFeedback, 7);
  assert.equal(dashboard.dailySummary.hotRepliesOpen, 1);
  assert.equal(
    dashboard.workflows.find((item) => item.key === "approve_outreach")?.queueCount,
    5,
  );
});

test("prompt 44 pilot feedback persists as human-controlled training signal", async () => {
  let captured: Record<string, unknown> | undefined;

  const service = createPilotModeService({
    repository: {
      async addFeedback(input: Record<string, unknown>) {
        captured = input;
        return { id: "plf_created" };
      },
      async workflowQueueCounts() {
        return {
          review_overnight_leads: 0,
          qualify_stock: 0,
          review_direct_demand: 0,
          approve_outreach: 0,
          handle_hot_replies: 0,
          create_requirement: 0,
          review_matches: 0,
          book_viewing: 0,
          progress_deal: 0,
          review_ai_errors: 0,
        };
      },
      async listFeedbackSummaryForDay() {
        return [];
      },
      async listFeedbackEvents() {
        return [];
      },
    } as never,
    auditService: {
      async recordEvent() {
        return { id: "aud_feedback" };
      },
    } as never,
  });

  await service.submitFeedback(
    {
      workflowKey: "review_ai_errors",
      feedbackLabel: "NEEDS_HUMAN",
      notes: "Escalate this dead-letter run to operations.",
      entityType: "job_run",
      entityId: "job_1",
    },
    actor,
  );

  assert.equal(captured?.["workflowKey"], "review_ai_errors");
  assert.equal(captured?.["feedbackLabel"], "NEEDS_HUMAN");
  assert.equal(captured?.["submittedByUserId"], "usr_pilot");
});
