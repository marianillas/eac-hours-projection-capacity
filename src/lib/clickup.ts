import { WORKSPACE_ID, PROJECTS_SPACE_ID } from "./classification";

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

type ClickUpTimeEntry = {
  id: string;
  task: { id: string } | null;
  start: string;
  duration: string; // ms, as string
  task_location: { list_id: string | null; folder_id: string | null; space_id: string | null } | null;
};

/**
 * Fetches every time entry in [startMs, endMs]. Empirically (verified 2026-08-28 against
 * this workspace) this endpoint returns the full result set for the date range in a single
 * response — it does not paginate via `page` the way ClickUp's task-listing endpoints do.
 * If the entry volume ever grows large enough that this stops holding, split the date range
 * into smaller chunks (e.g. per month) rather than relying on `page`.
 */
export async function getTimeEntries(startMs: number, endMs: number): Promise<ClickUpTimeEntry[]> {
  const data = await clickupGet<{ data: ClickUpTimeEntry[] }>(`/team/${WORKSPACE_ID}/time_entries`, {
    start_date: String(startMs),
    end_date: String(endMs),
  });
  return data.data;
}

export type ClickUpClientFolder = { id: string; name: string };

/** The client folders under the Projects space — each one is a client's own project. */
export async function getClientFolders(): Promise<ClickUpClientFolder[]> {
  const data = await clickupGet<{ folders: ClickUpClientFolder[] }>(`/space/${PROJECTS_SPACE_ID}/folder`, {
    archived: "false",
  });
  return data.folders.map((f) => ({ id: f.id, name: f.name }));
}

export type ClickUpList = { id: string; name: string };

/** The lists inside a client folder — each list is one "project" in our budget model. */
export async function getListsForFolder(folderId: string): Promise<ClickUpList[]> {
  const data = await clickupGet<{ lists: ClickUpList[] }>(`/folder/${folderId}/list`, {
    archived: "false",
  });
  return data.lists;
}

export type ClickUpProjectTask = { id: string; name: string };

/** Top-level tasks in a list (no subtasks — see plan notes on why). */
export async function getTasksForList(listId: string): Promise<ClickUpProjectTask[]> {
  const tasks: ClickUpProjectTask[] = [];
  let page = 0;
  for (;;) {
    const data = await clickupGet<{ tasks: ClickUpProjectTask[]; last_page: boolean }>(
      `/list/${listId}/task`,
      { archived: "false", include_closed: "true", page: String(page) },
    );
    tasks.push(...data.tasks);
    if (data.last_page) break;
    page += 1;
  }
  return tasks;
}

export type { ClickUpTimeEntry };
