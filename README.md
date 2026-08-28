# eac-hours-projection-capacity

Standalone "At a Glance" app: Client-Billable + Overhead + LIP hours vs. team capacity, by
month, live from ClickUp. Own repo, own ClickUp integration, own Postgres database — not
connected to the ClickUp kanban board app or the eac-lip-utilization dashboard.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in:
   - `CLICKUP_API_TOKEN` — a personal API token from ClickUp (Settings → Apps), created for
     this app specifically.
   - `POSTGRES_URL` — a Postgres connection string (Vercel Postgres, Neon, Supabase, or a
     local instance).
   - `CRON_SECRET` — any random string; must match what you set as an env var on Vercel so
     the cron job can authenticate to `/api/cron/sync`.

3. Create the database tables:

   ```bash
   npm run db:migrate
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. Add your team roster and client-billable budgets at `/settings`, then click **Sync now**
   on the main page to pull Overhead/LIP hours from ClickUp.

## How classification works

`src/lib/classification.ts` maps ClickUp space/folder **IDs** (never names — see the file's
comment) to one of four categories: EAC Core, Overhead, LIP Core, LIP Overhead. The ClickUp
time entries endpoint doesn't return which space/folder a task belongs to, so
`src/lib/clickup.ts` walks each configured space's Folder → List → Task hierarchy to build a
task → category lookup, then classifies each time entry by the task it's logged against
(`src/lib/sync.ts`). Renaming a space or folder in ClickUp is safe and needs no code change;
adding a new space/folder does need an entry in `classification.ts`.

## Deploying

This repo is deploy-ready for Vercel (`vercel.json` configures a cron job that hits
`/api/cron/sync` every 6 hours). Set `CLICKUP_API_TOKEN`, `POSTGRES_URL`, and `CRON_SECRET`
as environment variables on the Vercel project, then deploy with `vercel` or by connecting
the repo in the Vercel dashboard.
