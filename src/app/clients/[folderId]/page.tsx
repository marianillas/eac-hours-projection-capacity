import { notFound } from "next/navigation";
import {
  getClientFolders,
  getClientBudgets,
  getClickupHoursMonthly,
  rollingMonths,
} from "@/lib/data";
import { formatMonth, formatHours } from "@/lib/format";
import { ClientSidebar } from "../client-sidebar";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const [clients, budgets, clickupHours] = await Promise.all([
    getClientFolders(),
    getClientBudgets(),
    getClickupHoursMonthly(),
  ]);

  const client = clients.find((c) => c.folder_id === folderId);
  if (!client) notFound();

  const months = rollingMonths({ back: 2, forward: 4 });

  const budgetedByMonth = new Map<string, { hours: number; tbaCount: number }>();
  for (const b of budgets) {
    if (b.client_folder_id !== folderId) continue;
    const entry = budgetedByMonth.get(b.month) ?? { hours: 0, tbaCount: 0 };
    if (b.status === "confirmed") entry.hours += Number(b.hours);
    else entry.tbaCount += 1;
    budgetedByMonth.set(b.month, entry);
  }

  const actualByMonth = new Map<string, number>();
  const syncedMonths = new Set<string>();
  for (const h of clickupHours) {
    if (h.category !== "eac_core" || h.subcategory_id !== folderId) continue;
    actualByMonth.set(h.month, (actualByMonth.get(h.month) ?? 0) + Number(h.hours));
  }
  for (const h of clickupHours) syncedMonths.add(h.month); // any row means that month was synced

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex gap-6">
      <ClientSidebar clients={clients} activeFolderId={folderId} />

      <div className="flex-1 space-y-4 min-w-0">
        <div>
          <h1 className="text-xl font-semibold">{client.name}</h1>
          <p className="text-sm text-neutral-500">
            Budgeted hours (from Settings) vs. actual ClickUp hours logged under this
            client&apos;s folder.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left font-medium px-4 py-3 sticky left-0 bg-neutral-50">
                  &nbsp;
                </th>
                {months.map((m) => (
                  <th key={m} className="text-right font-medium px-4 py-3 whitespace-nowrap">
                    {formatMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="px-4 py-2.5 sticky left-0 bg-white text-blue-600">
                  Budgeted Hours
                </td>
                {months.map((m) => {
                  const b = budgetedByMonth.get(m);
                  return (
                    <td key={m} className="px-4 py-2.5 text-right whitespace-nowrap text-blue-600">
                      {b && (b.hours > 0 || b.tbaCount > 0) ? (
                        <>
                          {formatHours(b.hours)}
                          {b.tbaCount > 0 && (
                            <span className="ml-1 text-xs text-amber-600">
                              (+{b.tbaCount} TBA)
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-neutral-100">
                <td className="px-4 py-2.5 sticky left-0 bg-white text-neutral-900">
                  Actual Hours
                </td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-2.5 text-right whitespace-nowrap text-neutral-900">
                    {syncedMonths.has(m) ? formatHours(actualByMonth.get(m) ?? 0) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="font-semibold">
                <td className="px-4 py-2.5 sticky left-0 bg-white">Variance (Budget − Actual)</td>
                {months.map((m) => {
                  const budgeted = budgetedByMonth.get(m)?.hours ?? 0;
                  const actual = actualByMonth.get(m);
                  if (actual === undefined && !budgetedByMonth.has(m)) {
                    return (
                      <td key={m} className="px-4 py-2.5 text-right whitespace-nowrap">
                        —
                      </td>
                    );
                  }
                  const variance = budgeted - (actual ?? 0);
                  return (
                    <td key={m} className="px-4 py-2.5 text-right whitespace-nowrap">
                      {formatHours(variance)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
