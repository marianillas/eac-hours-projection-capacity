import { query } from "./db";
import { CORE_TARGET_PCT, OVERHEAD_TARGET_PCT } from "./classification";

export type TeamMember = {
  id: number;
  name: string;
  role: string;
  hours_per_week: string;
  active: boolean;
};

export type ClientFolder = {
  folder_id: string;
  name: string;
};

export type ClickupHourRow = {
  month: string;
  category: string;
  subcategory_id: string;
  subcategory_label: string;
  hours: string;
  synced_at: string;
};

export type ProjectTask = {
  id: number;
  project_id: number;
  task_number: string;
  name: string;
  sort_order: number;
  hoursByMonth: Record<string, number>; // month -> hours
};

export type ClientProject = {
  id: number;
  client_folder_id: string;
  name: string;
  hourly_rate: string;
  notes: string;
  sort_order: number;
  tasks: ProjectTask[];
};

export async function getTeamMembers(): Promise<TeamMember[]> {
  return query<TeamMember>(
    "SELECT id, name, role, hours_per_week, active FROM team_members ORDER BY id",
  );
}

export async function getClientFolders(): Promise<ClientFolder[]> {
  return query<ClientFolder>("SELECT folder_id, name FROM client_folders ORDER BY name");
}

export async function getClickupHoursMonthly(): Promise<ClickupHourRow[]> {
  return query<ClickupHourRow>(
    "SELECT month::text, category, subcategory_id, subcategory_label, hours, synced_at::text FROM clickup_hours_monthly ORDER BY month",
  );
}

export async function getClientProjects(folderId: string): Promise<ClientProject[]> {
  const projects = await query<Omit<ClientProject, "tasks">>(
    "SELECT id, client_folder_id, name, hourly_rate, notes, sort_order FROM client_projects WHERE client_folder_id = $1 ORDER BY sort_order, id",
    [folderId],
  );
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const tasks = await query<{ id: number; project_id: number; task_number: string; name: string; sort_order: number }>(
    "SELECT id, project_id, task_number, name, sort_order FROM project_tasks WHERE project_id = ANY($1) ORDER BY sort_order, id",
    [projectIds],
  );

  const taskIds = tasks.map((t) => t.id);
  const hourRows = taskIds.length
    ? await query<{ task_id: number; month: string; hours: string }>(
        "SELECT task_id, month::text, hours FROM task_hours_monthly WHERE task_id = ANY($1)",
        [taskIds],
      )
    : [];

  const hoursByTask = new Map<number, Record<string, number>>();
  for (const h of hourRows) {
    if (!hoursByTask.has(h.task_id)) hoursByTask.set(h.task_id, {});
    hoursByTask.get(h.task_id)![h.month] = Number(h.hours);
  }

  const tasksByProject = new Map<number, ProjectTask[]>();
  for (const t of tasks) {
    const task: ProjectTask = { ...t, hoursByMonth: hoursByTask.get(t.id) ?? {} };
    if (!tasksByProject.has(t.project_id)) tasksByProject.set(t.project_id, []);
    tasksByProject.get(t.project_id)!.push(task);
  }

  return projects.map((p) => ({ ...p, tasks: tasksByProject.get(p.id) ?? [] }));
}

/** Sum of budgeted task hours across every client/project, grouped by month. */
export async function getClientBillableHoursByMonth(): Promise<Record<string, number>> {
  const rows = await query<{ month: string; total_hours: string }>(
    "SELECT month::text AS month, SUM(hours) AS total_hours FROM task_hours_monthly GROUP BY month",
  );
  return Object.fromEntries(rows.map((r) => [r.month, Number(r.total_hours)]));
}

export function monthlyCapacityHours(members: TeamMember[]): number {
  const weeklyTotal = members
    .filter((m) => m.active)
    .reduce((sum, m) => sum + Number(m.hours_per_week), 0);
  return (weeklyTotal * 52) / 12;
}

export type MonthRow = {
  month: string; // ISO date, first of month
  clientBillableHours: number;
  overheadHours: number;
  lipHours: number;
  totalDemand: number;
  capacity: number;
  variance: number;
  status: "OK" | "TIGHT" | "OVER CAPACITY";
  hasClickupData: boolean;
  coreTargetHours: number;
  overheadTargetHours: number;
};

export function statusFor(variance: number, capacity: number): MonthRow["status"] {
  if (variance < 0) return "OVER CAPACITY";
  if (capacity > 0 && variance < capacity * 0.1) return "TIGHT";
  return "OK";
}

export function buildMonthRows(
  months: string[], // ISO dates, first of month
  clientBillableHoursByMonth: Record<string, number>,
  clickupHours: ClickupHourRow[],
  capacity: number,
): MonthRow[] {
  return months.map((month) => {
    const clientBillableHours = clientBillableHoursByMonth[month] ?? 0;

    const clickupForMonth = clickupHours.filter((h) => h.month === month);
    const hasClickupData = clickupForMonth.length > 0;
    const overheadHours = clickupForMonth
      .filter((h) => h.category === "overhead" || h.category === "lip_overhead")
      .reduce((sum, h) => sum + Number(h.hours), 0);
    const lipHours = clickupForMonth
      .filter((h) => h.category === "lip_core")
      .reduce((sum, h) => sum + Number(h.hours), 0);

    const totalDemand = clientBillableHours + overheadHours + lipHours;
    const variance = capacity - totalDemand;

    return {
      month,
      clientBillableHours,
      overheadHours,
      lipHours,
      totalDemand,
      capacity,
      variance,
      status: statusFor(variance, capacity),
      hasClickupData,
      coreTargetHours: capacity * CORE_TARGET_PCT,
      overheadTargetHours: capacity * OVERHEAD_TARGET_PCT,
    };
  });
}

export function rollingMonths(centerOffset: { back: number; forward: number }): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = -centerOffset.back; i <= centerOffset.forward; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push(d.toISOString().slice(0, 10));
  }
  return months;
}

/** One row per subcategory (space/folder/client) within a category, months as columns. */
export type BreakdownRow = {
  subcategoryId: string;
  label: string;
  hoursByMonth: Record<string, number>; // month -> hours (0 if none that month)
};

export function buildBreakdown(
  months: string[],
  clickupHours: ClickupHourRow[],
  categories: string[],
  // Known space/folder IDs to always show (with 0 hours) even if nothing was logged this
  // window — otherwise a space with no recent activity would just silently disappear.
  knownSubcategories: Record<string, string> = {},
): BreakdownRow[] {
  const bySubcategory = new Map<string, BreakdownRow>();

  const ensure = (id: string, label: string) => {
    if (!bySubcategory.has(id)) {
      bySubcategory.set(id, { subcategoryId: id, label, hoursByMonth: Object.fromEntries(months.map((m) => [m, 0])) });
    }
    return bySubcategory.get(id)!;
  };

  for (const [id, label] of Object.entries(knownSubcategories)) ensure(id, label);

  for (const row of clickupHours) {
    if (!categories.includes(row.category)) continue;
    const entry = ensure(row.subcategory_id, row.subcategory_label);
    if (months.includes(row.month)) {
      entry.hoursByMonth[row.month] = (entry.hoursByMonth[row.month] ?? 0) + Number(row.hours);
    }
  }
  return Array.from(bySubcategory.values()).sort((a, b) => a.label.localeCompare(b.label));
}
