import { getClickupHoursMonthly, rollingMonths, buildBreakdown } from "@/lib/data";
import { LIP_FOLDER_LABEL, LIP_FOLDER_CLASSIFICATION } from "@/lib/classification";
import { BreakdownTable } from "../breakdown-table";

export const dynamic = "force-dynamic";

function labelsFor(category: "lip_core" | "lip_overhead") {
  return Object.fromEntries(
    Object.entries(LIP_FOLDER_LABEL).filter(([id]) => LIP_FOLDER_CLASSIFICATION[id] === category),
  );
}

export default async function LipPage() {
  const clickupHours = await getClickupHoursMonthly();
  const months = rollingMonths({ back: 2, forward: 4 });
  const coreRows = buildBreakdown(months, clickupHours, ["lip_core"], labelsFor("lip_core"));
  const overheadRows = buildBreakdown(months, clickupHours, ["lip_overhead"], labelsFor("lip_overhead"));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">LIP</h1>
        <p className="text-sm text-neutral-500">
          LIP World hours by folder. Total LIP Core ties to Summary&apos;s LIP Hours row; Total
          LIP Overhead feeds into Summary&apos;s combined Overhead Hours row.
        </p>
      </div>

      <BreakdownTable
        months={months}
        sections={[
          { title: "LIP Core", rows: coreRows, totalLabel: "Total LIP Core" },
          { title: "LIP Overhead", rows: overheadRows, totalLabel: "Total LIP Overhead" },
        ]}
        grandTotalLabel="Total LIP"
      />
    </div>
  );
}
