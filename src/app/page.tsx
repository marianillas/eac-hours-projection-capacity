import {
  getTeamMembers,
  getClientBudgets,
  getClickupHoursMonthly,
  monthlyCapacityHours,
  buildMonthRows,
  rollingMonths,
  type MonthRow,
} from "@/lib/data";
import { SyncButton } from "./sync-button";

// Reads live DB state on every request; nothing here is safe to prerender at build time.
export const dynamic = "force-dynamic";

function formatMonth(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatHours(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

const STATUS_STYLE: Record<MonthRow["status"], string> = {
  OK: "bg-emerald-100 text-emerald-800",
  TIGHT: "bg-amber-100 text-amber-800",
  "OVER CAPACITY": "bg-red-100 text-red-800",
};

export default async function AtAGlancePage() {
  const [members, clientBudgets, clickupHours] = await Promise.all([
    getTeamMembers(),
    getClientBudgets(),
    getClickupHoursMonthly(),
  ]);

  const capacity = monthlyCapacityHours(members);
  const months = rollingMonths({ back: 2, forward: 4 });
  const rows = buildMonthRows(months, clientBudgets, clickupHours, capacity);

  const lastSynced = clickupHours.reduce<string | null>((latest, h) => {
    if (!latest || h.synced_at > latest) return h.synced_at;
    return latest;
  }, null);

  const rowDefs: {
    label: string;
    render: (r: MonthRow) => React.ReactNode;
    emphasize?: boolean;
  }[] = [
    {
      label: "Client-Billable Hours",
      render: (r) => (
        <>
          {formatHours(r.clientBillableHours)}
          {r.clientBillableTbaCount > 0 && (
            <span className="ml-1 text-xs text-amber-600">
              (+{r.clientBillableTbaCount} TBA)
            </span>
          )}
        </>
      ),
    },
    {
      label: "Overhead Hours",
      render: (r) => (r.hasClickupData ? formatHours(r.overheadHours) : "—"),
    },
    {
      label: "LIP Hours",
      render: (r) => (r.hasClickupData ? formatHours(r.lipHours) : "—"),
    },
    {
      label: "Total Projected Demand",
      render: (r) => formatHours(r.totalDemand),
      emphasize: true,
    },
    {
      label: "Team Capacity",
      render: (r) => formatHours(r.capacity),
    },
    {
      label: "Variance",
      render: (r) => formatHours(r.variance),
      emphasize: true,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">At a Glance</h1>
          <p className="text-sm text-neutral-500">
            {lastSynced
              ? `Last synced ${new Date(lastSynced).toLocaleString()}`
              : "Not synced yet — click Sync now to pull ClickUp hours."}
          </p>
        </div>
        <SyncButton />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left font-medium px-4 py-3 sticky left-0 bg-neutral-50">
                &nbsp;
              </th>
              {rows.map((r) => (
                <th key={r.month} className="text-right font-medium px-4 py-3 whitespace-nowrap">
                  {formatMonth(r.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowDefs.map((def) => (
              <tr key={def.label} className="border-b border-neutral-100 last:border-0">
                <td
                  className={`px-4 py-2.5 sticky left-0 bg-white ${
                    def.emphasize ? "font-semibold" : "text-neutral-600"
                  }`}
                >
                  {def.label}
                </td>
                {rows.map((r) => (
                  <td
                    key={r.month}
                    className={`px-4 py-2.5 text-right whitespace-nowrap ${
                      def.emphasize ? "font-semibold" : ""
                    }`}
                  >
                    {def.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-4 py-3 sticky left-0 bg-white font-semibold">Status</td>
              {rows.map((r) => (
                <td key={r.month} className="px-4 py-3 text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        Target: {(70).toFixed(0)}% core / {(30).toFixed(0)}% overhead ·{" "}
        {formatHours(rows[0]?.coreTargetHours ?? 0)} core hrs / month,{" "}
        {formatHours(rows[0]?.overheadTargetHours ?? 0)} overhead hrs / month at current capacity
        — reference only, not a hard input.
      </p>
    </div>
  );
}
