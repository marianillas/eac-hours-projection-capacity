import { query } from "./db";
import { CORE_TARGET_PCT, OVERHEAD_TARGET_PCT } from "./classification";

export type TeamMember = {
  id: number;
  name: string;
  role: string;
  hours_per_week: string;
  active: boolean;
};

export type ClientBudget = {
  id: number;
  month: string; // ISO date
  client_name: string;
  hours: string;
  status: "confirmed" | "tba";
};

export async function getTeamMembers(): Promise<TeamMember[]> {
  return query<TeamMember>(
    "SELECT id, name, role, hours_per_week, active FROM team_members ORDER BY id",
  );
}

export async function getClientBudgets(): Promise<ClientBudget[]> {
  return query<ClientBudget>(
    "SELECT id, month::text, client_name, hours, status FROM client_budgets ORDER BY month, client_name",
  );
}

export async function getClickupHoursMonthly(): Promise<
  { month: string; category: string; hours: string; synced_at: string }[]
> {
  return query<{ month: string; category: string; hours: string; synced_at: string }>(
    "SELECT month::text, category, hours, synced_at::text FROM clickup_hours_monthly ORDER BY month",
  );
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
  clientBillableTbaCount: number;
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
  clientBudgets: ClientBudget[],
  clickupHours: { month: string; category: string; hours: string }[],
  capacity: number,
): MonthRow[] {
  return months.map((month) => {
    const budgetsForMonth = clientBudgets.filter((b) => b.month === month);
    const clientBillableHours = budgetsForMonth
      .filter((b) => b.status === "confirmed")
      .reduce((sum, b) => sum + Number(b.hours), 0);
    const clientBillableTbaCount = budgetsForMonth.filter((b) => b.status === "tba").length;

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
      clientBillableTbaCount,
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
