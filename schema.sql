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

CREATE TABLE IF NOT EXISTS client_budgets (
  id SERIAL PRIMARY KEY,
  month DATE NOT NULL, -- always the 1st of the month
  client_name TEXT NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tba')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_budgets_month_idx ON client_budgets (month);

CREATE TABLE IF NOT EXISTS clickup_hours_monthly (
  month DATE NOT NULL, -- always the 1st of the month
  category TEXT NOT NULL CHECK (category IN ('eac_core', 'overhead', 'lip_core', 'lip_overhead', 'unclassified')),
  hours NUMERIC NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, category)
);
