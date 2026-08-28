import { getTimeEntries, getClientFolders } from "./clickup";
import { getPool } from "./db";
import {
  classifyLocation,
  PROJECTS_SPACE_ID,
  BUSINESS_DEVELOPMENT_SPACE_ID,
  BUSINESS_DEVELOPMENT_SUBCATEGORY_ID,
  OVERHEAD_SPACE_LABEL,
  LIP_FOLDER_LABEL,
  type Category,
} from "./classification";

const SYNC_WINDOW_MONTHS_BACK = 6;
const SYNC_WINDOW_MONTHS_FORWARD = 1; // catches entries logged slightly ahead of "now"

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export type SyncResult = {
  entriesProcessed: number;
  unclassifiedEntries: number;
  clientFoldersSynced: number;
  hoursByMonth: Record<string, Record<string, number>>; // month (ISO date) -> "category:subcategoryId" -> hours
  warnings: { kind: string; detail: string }[];
  finishedAt: string;
};

type Bucket = { category: Category; subcategoryId: string; subcategoryLabel: string; hours: number };

function subcategoryFor(
  category: Category,
  spaceId: string,
  folderId: string | null,
  clientFolderNames: Map<string, string>,
): { id: string; label: string } {
  if (category === "eac_core") {
    if (spaceId === PROJECTS_SPACE_ID && folderId) {
      return { id: folderId, label: clientFolderNames.get(folderId) ?? `Unknown client (${folderId})` };
    }
    if (spaceId === BUSINESS_DEVELOPMENT_SPACE_ID) {
      return { id: BUSINESS_DEVELOPMENT_SUBCATEGORY_ID, label: "Business Development" };
    }
    return { id: spaceId, label: "EAC Core (other)" };
  }
  if (category === "overhead") {
    return { id: spaceId, label: OVERHEAD_SPACE_LABEL[spaceId] ?? spaceId };
  }
  // lip_core / lip_overhead
  const id = folderId ?? spaceId;
  return { id, label: LIP_FOLDER_LABEL[id] ?? id };
}

export async function runSync(): Promise<SyncResult> {
  const [clientFolders, now] = [await getClientFolders(), new Date()];
  const clientFolderNames = new Map(clientFolders.map((f) => [f.id, f.name]));

  const start = monthStart(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - SYNC_WINDOW_MONTHS_BACK, 1)),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + SYNC_WINDOW_MONTHS_FORWARD + 1, 0, 23, 59, 59),
  );

  const entries = await getTimeEntries(start.getTime(), end.getTime());

  const hoursByMonth = new Map<string, Map<string, Bucket>>(); // month -> "category:subcategoryId" -> bucket
  let unclassifiedEntries = 0;
  const unclassifiedLocations = new Map<string, number>(); // "spaceId/folderId" -> count, for warnings

  for (const entry of entries) {
    const tl = entry.task_location;
    const category = classifyLocation(tl?.space_id, tl?.folder_id);

    if (!category) {
      unclassifiedEntries += 1;
      if (tl?.space_id) {
        const key = `${tl.space_id}/${tl.folder_id ?? ""}`;
        unclassifiedLocations.set(key, (unclassifiedLocations.get(key) ?? 0) + 1);
      }
      continue;
    }

    const { id: subcategoryId, label: subcategoryLabel } = subcategoryFor(
      category,
      tl!.space_id!,
      tl!.folder_id,
      clientFolderNames,
    );

    const entryDate = new Date(Number(entry.start));
    const monthKey = monthStart(entryDate).toISOString().slice(0, 10);
    const durationHours = Number(entry.duration) / 1000 / 60 / 60;

    if (!hoursByMonth.has(monthKey)) hoursByMonth.set(monthKey, new Map());
    const monthMap = hoursByMonth.get(monthKey)!;
    const bucketKey = `${category}:${subcategoryId}`;
    const existing = monthMap.get(bucketKey);
    if (existing) {
      existing.hours += durationHours;
    } else {
      monthMap.set(bucketKey, { category, subcategoryId, subcategoryLabel, hours: durationHours });
    }
  }

  const warnings = Array.from(unclassifiedLocations.entries()).map(([key, count]) => {
    const [spaceId, folderId] = key.split("/");
    return {
      kind: "unclassified_location",
      detail: `${count} time entr${count === 1 ? "y" : "ies"} under space ${spaceId}${
        folderId ? ` / folder ${folderId}` : ""
      }, which isn't in classification.ts.`,
    };
  });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    for (const folder of clientFolders) {
      await client.query(
        `INSERT INTO client_folders (folder_id, name, synced_at)
         VALUES ($1, $2, now())
         ON CONFLICT (folder_id) DO UPDATE SET name = EXCLUDED.name, synced_at = EXCLUDED.synced_at`,
        [folder.id, folder.name],
      );
    }

    for (const [month, buckets] of hoursByMonth) {
      for (const { category, subcategoryId, subcategoryLabel, hours } of buckets.values()) {
        await client.query(
          `INSERT INTO clickup_hours_monthly (month, category, subcategory_id, subcategory_label, hours, synced_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (month, category, subcategory_id)
           DO UPDATE SET subcategory_label = EXCLUDED.subcategory_label, hours = EXCLUDED.hours, synced_at = EXCLUDED.synced_at`,
          [month, category, subcategoryId, subcategoryLabel, hours],
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
  for (const [month, buckets] of hoursByMonth) {
    hoursByMonthPlain[month] = Object.fromEntries(
      Array.from(buckets.values()).map((b) => [`${b.category}:${b.subcategoryId}`, b.hours]),
    );
  }

  return {
    entriesProcessed: entries.length,
    unclassifiedEntries,
    clientFoldersSynced: clientFolders.length,
    hoursByMonth: hoursByMonthPlain,
    warnings,
    finishedAt: new Date().toISOString(),
  };
}
