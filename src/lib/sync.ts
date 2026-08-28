import { buildTaskClassificationMap, getTimeEntries } from "./clickup";
import { getPool } from "./db";
import type { Category } from "./classification";

const SYNC_WINDOW_MONTHS_BACK = 6;
const SYNC_WINDOW_MONTHS_FORWARD = 1; // catches entries logged slightly ahead of "now"

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export type SyncResult = {
  tasksScanned: number;
  entriesProcessed: number;
  unclassifiedEntries: number;
  hoursByMonth: Record<string, Record<string, number>>; // month (ISO date) -> category -> hours
  warnings: { kind: string; detail: string }[];
  finishedAt: string;
};

export async function runSync(): Promise<SyncResult> {
  const { taskCategory, warnings } = await buildTaskClassificationMap();

  const now = new Date();
  const start = monthStart(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - SYNC_WINDOW_MONTHS_BACK, 1)),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + SYNC_WINDOW_MONTHS_FORWARD + 1, 0, 23, 59, 59),
  );

  const entries = await getTimeEntries(start.getTime(), end.getTime());

  const hoursByMonth = new Map<string, Map<Category | "unclassified", number>>();
  let unclassifiedEntries = 0;

  for (const entry of entries) {
    const taskId = entry.task?.id;
    const category = taskId ? taskCategory.get(taskId) : undefined;
    if (!category) {
      unclassifiedEntries += 1;
      continue;
    }

    const entryDate = new Date(Number(entry.start));
    const monthKey = monthStart(entryDate).toISOString().slice(0, 10);
    const durationHours = Number(entry.duration) / 1000 / 60 / 60;

    if (!hoursByMonth.has(monthKey)) hoursByMonth.set(monthKey, new Map());
    const monthMap = hoursByMonth.get(monthKey)!;
    monthMap.set(category, (monthMap.get(category) ?? 0) + durationHours);
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const [month, categories] of hoursByMonth) {
      for (const [category, hours] of categories) {
        await client.query(
          `INSERT INTO clickup_hours_monthly (month, category, hours, synced_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (month, category)
           DO UPDATE SET hours = EXCLUDED.hours, synced_at = EXCLUDED.synced_at`,
          [month, category, hours],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const hoursByMonthPlain: Record<string, Record<string, number>> = {};
  for (const [month, categories] of hoursByMonth) {
    hoursByMonthPlain[month] = Object.fromEntries(categories);
  }

  return {
    tasksScanned: taskCategory.size,
    entriesProcessed: entries.length,
    unclassifiedEntries,
    hoursByMonth: hoursByMonthPlain,
    warnings,
    finishedAt: new Date().toISOString(),
  };
}
