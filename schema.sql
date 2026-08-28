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

CREATE TABLE IF NOT EXISTS client_budgets (
  id SERIAL PRIMARY KEY,
  month DATE NOT NULL, -- always the 1st of the month
  client_name TEXT NOT NULL,
  client_folder_id TEXT REFERENCES client_folders(folder_id),
  hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tba')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_budgets ADD COLUMN IF NOT EXISTS client_folder_id TEXT REFERENCES client_folders(folder_id);

CREATE INDEX IF NOT EXISTS client_budgets_month_idx ON client_budgets (month);

-- Pure derived cache, fully repopulated by every sync — safe to drop and recreate when its
-- shape changes, unlike team_members/client_budgets which hold real user-entered data.
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
