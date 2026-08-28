"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "./db";
import { runSync } from "./sync";
import { rollingMonths } from "./data";

function revalidateAllTabs() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/lip");
  revalidatePath("/clients", "layout");
}

export async function triggerSync() {
  const result = await runSync();
  console.log(
    `[sync] ${result.entriesProcessed} entries processed, ${result.unclassifiedEntries} unclassified, ${result.clientFoldersSynced} client folders, ${result.warnings.length} warning(s)`,
  );
  revalidateAllTabs();
  revalidatePath("/settings");
  return result;
}

export async function addTeamMember(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const hoursPerWeek = Number(formData.get("hours_per_week") ?? 0);
  if (!name || !role) return;

  await getPool().query(
    "INSERT INTO team_members (name, role, hours_per_week) VALUES ($1, $2, $3)",
    [name, role, hoursPerWeek],
  );
  revalidatePath("/settings");
  revalidateAllTabs();
}

export async function updateTeamMember(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const hoursPerWeek = Number(formData.get("hours_per_week") ?? 0);
  const active = formData.get("active") === "on";
  if (!id || !name || !role) return;

  await getPool().query(
    "UPDATE team_members SET name = $1, role = $2, hours_per_week = $3, active = $4 WHERE id = $5",
    [name, role, hoursPerWeek, active, id],
  );
  revalidatePath("/settings");
  revalidateAllTabs();
}

export async function removeTeamMember(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await getPool().query("DELETE FROM team_members WHERE id = $1", [id]);
  revalidatePath("/settings");
  revalidateAllTabs();
}

function revalidateClient(folderId: string) {
  revalidatePath(`/clients/${folderId}`);
  revalidateAllTabs();
}

export async function addProject(formData: FormData) {
  const clientFolderId = String(formData.get("client_folder_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const hourlyRate = Number(formData.get("hourly_rate") ?? 0);
  if (!clientFolderId || !name) return;

  await getPool().query(
    "INSERT INTO client_projects (client_folder_id, name, hourly_rate) VALUES ($1, $2, $3)",
    [clientFolderId, name, hourlyRate],
  );
  revalidateClient(clientFolderId);
}

export async function updateProject(formData: FormData) {
  const id = Number(formData.get("id"));
  const clientFolderId = String(formData.get("client_folder_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const hourlyRate = Number(formData.get("hourly_rate") ?? 0);
  const notes = String(formData.get("notes") ?? "");
  if (!id || !name) return;

  await getPool().query(
    "UPDATE client_projects SET name = $1, hourly_rate = $2, notes = $3 WHERE id = $4",
    [name, hourlyRate, notes, id],
  );
  revalidateClient(clientFolderId);
}

export async function removeProject(formData: FormData) {
  const id = Number(formData.get("id"));
  const clientFolderId = String(formData.get("client_folder_id") ?? "");
  if (!id) return;
  await getPool().query("DELETE FROM client_projects WHERE id = $1", [id]);
  revalidateClient(clientFolderId);
}

export async function addTask(formData: FormData) {
  const projectId = Number(formData.get("project_id"));
  const clientFolderId = String(formData.get("client_folder_id") ?? "");
  const taskNumber = String(formData.get("task_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!projectId || !name) return;

  await getPool().query(
    "INSERT INTO project_tasks (project_id, task_number, name) VALUES ($1, $2, $3)",
    [projectId, taskNumber, name],
  );
  revalidateClient(clientFolderId);
}

export async function removeTask(formData: FormData) {
  const id = Number(formData.get("id"));
  const clientFolderId = String(formData.get("client_folder_id") ?? "");
  if (!id) return;
  await getPool().query("DELETE FROM project_tasks WHERE id = $1", [id]);
  revalidateClient(clientFolderId);
}

export async function updateTaskHours(formData: FormData) {
  const id = Number(formData.get("id"));
  const clientFolderId = String(formData.get("client_folder_id") ?? "");
  const taskNumber = String(formData.get("task_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE project_tasks SET task_number = $1, name = $2 WHERE id = $3", [
      taskNumber,
      name,
      id,
    ]);

    for (const month of rollingMonths({ back: 2, forward: 4 })) {
      const hours = Number(formData.get(`hours_${month}`) ?? 0);
      await client.query(
        `INSERT INTO task_hours_monthly (task_id, month, hours)
         VALUES ($1, $2, $3)
         ON CONFLICT (task_id, month) DO UPDATE SET hours = EXCLUDED.hours`,
        [id, month, hours],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  revalidateClient(clientFolderId);
}
