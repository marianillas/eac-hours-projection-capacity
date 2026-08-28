# eac-hours-projection-capacity

Standalone hours/capacity app, live from ClickUp. Own repo, own ClickUp integration, own
Postgres database — not connected to the ClickUp kanban board app or the eac-lip-utilization
dashboard. Five tabs:

- **Summary** — Client-Billable + Overhead + LIP hours vs. team capacity, by month
- **Admin** — Overhead hours broken down by org-level space (Finance, Marketing, etc.)
- **LIP** — LIP World hours broken down by folder (LIP Core vs. LIP Overhead)
- **Clients** — pick a client folder, manage that client's projects and per-task budgets:
  hours entered per task per month, dollars computed from the project's hourly rate, plus
  freeform notes. Projects and tasks can be pulled straight from ClickUp ("Sync projects
  from ClickUp" on each client's page — a project is a ClickUp list, a task is a ClickUp
  task) or added manually for line items with no ClickUp equivalent
- **Settings** — team roster

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

5. Add your team roster at `/settings`, then click **Sync now** on the Summary tab to pull
   Overhead/LIP hours (and the client folder list) from ClickUp. Client budgets are entered
   per-client under the Clients tab, once client folders have synced at least once.

## How classification works

`src/lib/classification.ts` maps ClickUp space/folder **IDs** (never names — see the file's
comment) to one of four categories: EAC Core, Overhead, LIP Core, LIP Overhead. Despite the
original build spec's note that the time-entries endpoint always returns a null
`task_location`, that field is in fact populated on every entry that has a task (verified
2026-08-28 against this workspace — 786/786 task-linked entries had it). `src/lib/sync.ts`
classifies each entry directly from its `task_location.space_id`/`folder_id`, no separate
task-hierarchy walk needed. Entries with no task at all (ad-hoc time tracking) or under a
space/folder not in `classification.ts` are counted as unclassified and surfaced as sync
warnings rather than silently dropped. Renaming a space or folder in ClickUp is safe and
needs no code change; adding a new space/folder does need an entry in `classification.ts`.

Each entry is also tagged with a **subcategory** — the specific client folder (for EAC Core),
overhead space, or LIP folder it belongs to — stored in `clickup_hours_monthly` alongside the
coarse category. The Summary tab just sums across subcategories per category (unchanged
math); the Admin/LIP/Clients tabs use the subcategory breakdown directly. Client folder names
are fetched live each sync (not hardcoded) into the `client_folders` table, since the client
list changes far more often than the fixed set of overhead spaces or LIP folders — adding a
new client in ClickUp needs no code change, just a re-sync.

## Deploying

This repo is deploy-ready for Vercel (`vercel.json` configures a cron job that hits
`/api/cron/sync` daily at 7am UTC — Vercel's Hobby plan only allows daily cron jobs; bump
the schedule in `vercel.json` if you're on Pro). Set `CLICKUP_API_TOKEN`, `POSTGRES_URL`, and `CRON_SECRET`
as environment variables on the Vercel project, then deploy with `vercel` or by connecting
the repo in the Vercel dashboard.
