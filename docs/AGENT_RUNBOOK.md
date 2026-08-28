# Agent Runbook

## Purpose

Operational guidance for PQ agents using internal workflows in a human-controlled manner.

## Daily Order

Open Command Centre first.

1. Open Pilot Mode.
2. Review overnight leads.
3. Qualify stock.
4. Review direct demand.
5. Approve outreach.
6. Handle hot replies.
7. Create requirements from qualified demand.
8. Review matches.
9. Book viewings.
10. Progress deals.
11. Review AI errors.

## Operating Cycle

- Night / background: discover, research, verify, deduplicate, score, prepare.
- 08:30 weekdays: outbound queue opens for approval and controlled send.
- Daytime: monitor replies, convert hot reply to requirement or qualified stock, match, viewing, offer, and deal.
- Evening: capture results, review source and campaign performance, generate shortage targets, and feed the next discovery cycle.

## Non-Negotiables

- Do not bypass RBAC.
- Do not send outreach when policy gates block the send.
- Do not override suppression or opt-out controls.
- Do not enable Level 3 autonomy unless explicitly authorized by admin policy.
- Treat Pilot Mode as human-controlled routing and feedback capture, not autonomous execution authority.

## Feedback Use

Use feedback buttons in Pilot Mode:
- GOOD AI
- WRONG
- MISSING
- NEEDS HUMAN

Add feedback whenever model output affects routing, qualification, outreach approval, or exception handling.

## Escalation Triggers

Escalate to manager/admin when:
- Outbound send is blocked for policy reasons you cannot resolve
- Source permissions or connector health are degraded
- A job run enters failed or dead-letter state repeatedly
- Directness evidence is conflicted or insufficient
- A deal/viewing change affects compliance or commercial commitments
