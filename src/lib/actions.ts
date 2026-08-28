"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "./db";
import { runSync } from "./sync";

export async function triggerSync() {
  const result = await runSync();
  revalidatePath("/");
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
  revalidatePath("/");
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
  revalidatePath("/");
}

export async function removeTeamMember(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await getPool().query("DELETE FROM team_members WHERE id = $1", [id]);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function addClientBudget(formData: FormData) {
  const monthInput = String(formData.get("month") ?? "");
  const clientName = String(formData.get("client_name") ?? "").trim();
  const hours = Number(formData.get("hours") ?? 0);
  const status = String(formData.get("status") ?? "confirmed");
  if (!monthInput || !clientName) return;

  // Normalize to the 1st of the month regardless of which day the date picker returns.
  const month = `${monthInput.slice(0, 7)}-01`;

  await getPool().query(
    "INSERT INTO client_budgets (month, client_name, hours, status) VALUES ($1, $2, $3, $4)",
    [month, clientName, hours, status],
  );
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function removeClientBudget(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await getPool().query("DELETE FROM client_budgets WHERE id = $1", [id]);
  revalidatePath("/settings");
  revalidatePath("/");
}
