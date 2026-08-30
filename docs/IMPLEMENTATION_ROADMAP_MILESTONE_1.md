# PQ Command Implementation Roadmap - Milestone 1

Goal: Make PQ Command unmistakably work-ready for Monday operations while preserving existing design system language.

## Scope Window
- Milestone length: 3-5 engineering days
- Target outcome: operator-first command centre and lead workflow with reliable status visibility.

## Workstream A - Command Centre Prioritization
1. Add top commercial KPI strip:
   - Deals this week
   - Potential fee pipeline
   - Completed revenue
   - Hot opportunities
2. Add urgent action queue block:
   - Hot replies
   - Overdue tasks
   - Viewings today
3. Keep worker/queue status visible without scrolling deep.

Acceptance criteria:
- First fold shows business state + next actions without navigation.

## Workstream B - Navigation Simplicity
1. Keep 4-step quick-start cards as primary workflow.
2. Add persistent quick navigation for internal routes.
3. Keep advanced modules behind progressive disclosure.

Acceptance criteria:
- Non-technical users can reach leads, inbox, command centre, and acquisition in <= 2 taps.

## Workstream C - Integration Truth Layer
1. Add a single integration status card/table with states:
   - CONNECTED
   - CONFIGURATION REQUIRED
   - FAILED
   - NOT ENABLED
2. Cover AI provider, outreach channels, storage, and key connectors.
3. Link each failed/missing state to actionable setup instructions.

Acceptance criteria:
- No false-positive UI state for disconnected integrations.

## Workstream D - Rent/Tenancy Operational Visibility
1. Add rent control summary block:
   - Due this week
   - Due this month
   - Overdue
   - Landlord payable
2. Link completed deals directly into tenancy/rent workflows.

Acceptance criteria:
- Team can identify payment pressure points at a glance.

## Workstream E - Morning Briefing
1. Generate daily digest from real overnight activity.
2. Show top opportunities and clear first actions.
3. Include confidence and evidence pointers for handover quality.

Acceptance criteria:
- 8:30 AM view is immediately actionable.

## QA and Release Gates
1. Build: npm run build
2. Tests: npm test
3. Health check verification on /api/health
4. Manual operator pass:
   - login
   - open command centre
   - open qualified leads
   - open inbox
   - verify worker health
5. Deploy to Render web + verify live commit.

## Notes
- Preserve token-based design system and premium brand language.
- Avoid fake data and fake execution states.
- Prefer explicit "not connected" over implicit/optimistic UI.
