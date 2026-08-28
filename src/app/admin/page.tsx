import { getClickupHoursMonthly, rollingMonths, buildBreakdown } from "@/lib/data";
import { OVERHEAD_SPACE_LABEL } from "@/lib/classification";
import { BreakdownTable } from "../breakdown-table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const clickupHours = await getClickupHoursMonthly();
  const months = rollingMonths({ back: 2, forward: 4 });
  const rows = buildBreakdown(months, clickupHours, ["overhead"], OVERHEAD_SPACE_LABEL);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-neutral-500">
          Overhead hours by space (Finance and Budgeting, EAC Core Materials, Contacts, Social
          Media, Operations, Marketing, EAC). LIP&apos;s own admin/overhead work is tracked
          separately on the LIP tab, so this total won&apos;t match Summary&apos;s combined
          Overhead Hours row (which includes LIP Overhead too).
        </p>
      </div>

      <BreakdownTable
        months={months}
        sections={[{ rows, totalLabel: "Total Org Overhead" }]}
      />
    </div>
  );
}
