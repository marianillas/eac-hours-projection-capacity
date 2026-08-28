-- eac-hours-projection-capacity schema
-- Run via `npm run db:migrate` (scripts/migrate.ts) against POSTGRES_URL.

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  hours_per_week NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_folders (
  folder_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Superseded by client_projects/project_tasks/task_hours_monthly below (per-task budgets
-- with an hourly rate instead of one flat monthly number per client).
DROP TABLE IF EXISTS client_budgets;

CREATE TABLE IF NOT EXISTS client_projects (
  id SERIAL PRIMARY KEY,
  client_folder_id TEXT NOT NULL REFERENCES client_folders(folder_id),
  name TEXT NOT NULL,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  task_number TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_hours_monthly (
  task_id INTEGER NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- always the 1st of the month
  hours NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, month)
);

-- Pure derived cache, fully repopulated by every sync — safe to drop and recreate when its
-- shape changes, unlike team_members/client_projects which hold real user-entered data.
DROP TABLE IF EXISTS clickup_hours_monthly;
CREATE TABLE clickup_hours_monthly (
  month DATE NOT NULL, -- always the 1st of the month
  category TEXT NOT NULL CHECK (category IN ('eac_core', 'overhead', 'lip_core', 'lip_overhead', 'unclassified')),
  subcategory_id TEXT NOT NULL,      -- client folder_id, overhead space_id, LIP folder_id, 'business-development', or 'unclassified'
  subcategory_label TEXT NOT NULL,   -- human name, resolved at sync time
  hours NUMERIC NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, category, subcategory_id)
);
