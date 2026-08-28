import {
  WORKSPACE_ID,
  LIP_WORLD_SPACE_ID,
  SPACE_CLASSIFICATION,
  LIP_FOLDER_CLASSIFICATION,
  type Category,
} from "./classification";

const API_BASE = "https://api.clickup.com/api/v2";

function authHeaders() {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    throw new Error("CLICKUP_API_TOKEN is not set. Add it to .env.local.");
  }
  return { Authorization: token };
}

const MAX_RATE_LIMIT_RETRIES = 6;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickupGet<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: authHeaders() });

    if (res.status === 429) {
      if (attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw new Error(`ClickUp API rate limit persisted after ${MAX_RATE_LIMIT_RETRIES} retries on ${pathname}`);
      }
      // ClickUp sends X-RateLimit-Reset as a unix timestamp (seconds) for when the window clears.
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const resetAt = resetHeader ? Number(resetHeader) * 1000 : null;
      const waitMs = resetAt
        ? Math.max(resetAt - Date.now(), 1000)
        : 2000 * 2 ** attempt; // exponential backoff fallback: 2s, 4s, 8s, ...
      await sleep(Math.min(waitMs, 60_000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp API ${res.status} on ${pathname}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
}

type ClickUpFolder = { id: string; name: string };
type ClickUpList = { id: string; name: string };
type ClickUpTask = { id: string; date_created: string };
type ClickUpTimeEntry = {
  id: string;
  task: { id: string } | null;
  start: string;
  duration: string; // ms, as string
};

async function getFolders(spaceId: string): Promise<ClickUpFolder[]> {
  const data = await clickupGet<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder`, {
    archived: "false",
  });
  return data.folders;
}

async function getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
  const data = await clickupGet<{ lists: ClickUpList[] }>(`/space/${spaceId}/list`, {
    archived: "false",
  });
  return data.lists;
}

async function getFolderLists(folderId: string): Promise<ClickUpList[]> {
  const data = await clickupGet<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
    archived: "false",
  });
  return data.lists;
}

async function getAllTasksForList(listId: string): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  let page = 0;
  for (;;) {
    const data = await clickupGet<{ tasks: ClickUpTask[]; last_page: boolean }>(
      `/list/${listId}/task`,
      { archived: "false", include_closed: "true", subtasks: "true", page: String(page) },
    );
    tasks.push(...data.tasks);
    if (data.last_page) break;
    page += 1;
  }
  return tasks;
}

export type SyncWarning = { kind: string; detail: string };

/**
 * Walks Space > Folder > List > Task for every configured space and returns a
 * task_id -> category map, so time entries (which don't carry space/folder info,
 * see spec section 2) can be classified by looking up the task they're logged against.
 */
export async function buildTaskClassificationMap(): Promise<{
  taskCategory: Map<string, Category | "unclassified">;
  warnings: SyncWarning[];
}> {
  const taskCategory = new Map<string, Category | "unclassified">();
  const warnings: SyncWarning[] = [];

  async function classifyLists(lists: ClickUpList[], category: Category | "unclassified") {
    for (const list of lists) {
      const tasks = await getAllTasksForList(list.id);
      for (const task of tasks) taskCategory.set(task.id, category);
    }
  }

  // Space-level classified spaces: every task under them (any folder/list) gets one category.
  for (const [spaceId, category] of Object.entries(SPACE_CLASSIFICATION)) {
    const [folders, folderlessLists] = await Promise.all([
      getFolders(spaceId),
      getFolderlessLists(spaceId),
    ]);
    await classifyLists(folderlessLists, category);
    for (const folder of folders) {
      const lists = await getFolderLists(folder.id);
      await classifyLists(lists, category);
    }
  }

  // LIP World: classified per-folder.
  const [lipFolders, lipFolderlessLists] = await Promise.all([
    getFolders(LIP_WORLD_SPACE_ID),
    getFolderlessLists(LIP_WORLD_SPACE_ID),
  ]);

  if (lipFolderlessLists.length > 0) {
    warnings.push({
      kind: "unclassified_folderless_list",
      detail: `LIP World has ${lipFolderlessLists.length} folderless list(s) not covered by LIP_FOLDER_CLASSIFICATION.`,
    });
    await classifyLists(lipFolderlessLists, "unclassified");
  }

  for (const folder of lipFolders) {
    const category = LIP_FOLDER_CLASSIFICATION[folder.id];
    if (!category) {
      warnings.push({
        kind: "unclassified_lip_folder",
        detail: `LIP World folder "${folder.name}" (${folder.id}) is not in LIP_FOLDER_CLASSIFICATION.`,
      });
    }
    const lists = await getFolderLists(folder.id);
    await classifyLists(lists, category ?? "unclassified");
  }

  return { taskCategory, warnings };
}

export async function getTimeEntries(startMs: number, endMs: number): Promise<ClickUpTimeEntry[]> {
  const entries: ClickUpTimeEntry[] = [];
  let page = 0;
  for (;;) {
    const data = await clickupGet<ClickUpTimeEntry[] | { data: ClickUpTimeEntry[] }>(
      `/team/${WORKSPACE_ID}/time_entries`,
      {
        start_date: String(startMs),
        end_date: String(endMs),
        page: String(page),
      },
    );
    const batch = Array.isArray(data) ? data : data.data;
    entries.push(...batch);
    if (batch.length < 100) break; // ClickUp pages at 100/request
    page += 1;
  }
  return entries;
}

export type { ClickUpTimeEntry };
