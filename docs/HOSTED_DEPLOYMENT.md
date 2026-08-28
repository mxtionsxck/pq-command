# Hosted Deployment

## Goal

Run PQ COMMAND without depending on a local laptop.

## Runtime Model

Deploy two long-running processes against the same production database:

- `web`: `npm start`
- `worker`: `npm run bot`

This allows the app UI and the constant sourcing bot to run independently.

## Required Environment

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_LOCAL_ADMIN_USERNAME` or external auth provider config
- `AUTH_LOCAL_ADMIN_PASSWORD` or external auth provider config
- Any production storage / AI / connector variables you intend to use

## Source Rules

Configured public-web sources must only run when:
- the source record is `APPROVED`
- the source is enabled
- the connector key is supported
- each configured domain policy is allowed by robots and terms flags

## Gumtree And Similar Portals

Gumtree and similar portals can be configured as source records, but they should remain `REVIEW_REQUIRED` until you confirm the site’s rules and your use is permitted. The bot will not run blocked or review-required domains.

Example source config JSON:

```json
{
  "urls": [
    "https://www.gumtree.com/search?search_category=property-to-rent"
  ],
  "domainRegistry": [
    {
      "domain": "www.gumtree.com",
      "permissionStatus": "REVIEW_REQUIRED",
      "robotsAllowed": false,
      "termsAllowed": false,
      "crawlDelayMs": 1000,
      "maxRequestsPerMinute": 6
    }
  ],
  "sourceProvenance": "portal_public"
}
```

## Recommended Deployment Shape

Any host that supports a web process plus a worker process will work.

Examples:
- Render: one web service and one background worker
- Railway: one web service and one worker service
- Fly.io / VPS: one app process and one bot process under a process manager

## Included Render Blueprint

This repo now includes `render.yaml` for the fastest real no-laptop path:

- managed Postgres database
- `pq-command-web` service
- `pq-command-worker` service

What still must be provided in Render:

- `AUTH_LOCAL_ADMIN_PASSWORD`
- any optional storage / AI / source connector credentials you intend to use

After connecting the repo in Render, apply the blueprint and then set the remaining secret env vars in the Render dashboard.

## Verification

1. Confirm `/api/health` responds.
2. Confirm the worker logs show successful automation ticks.
3. Create an approved source with connector key `supply.public.web`.
4. Run `Run configured source` in Admin > Sources.
5. Confirm discovery job runs, leads, signals, and evidence are created.
6. Then rely on the automated bot loop.
