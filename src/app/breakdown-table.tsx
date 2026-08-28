import { Fragment } from "react";
import { formatMonth, formatHours } from "@/lib/format";
import type { BreakdownRow } from "@/lib/data";

export type BreakdownSection = {
  title?: string;
  rows: BreakdownRow[];
  totalLabel: string;
};

function sumRow(rows: BreakdownRow[], month: string): number {
  return rows.reduce((sum, r) => sum + (r.hoursByMonth[month] ?? 0), 0);
}

export function BreakdownTable({
  months,
  sections,
  grandTotalLabel,
}: {
  months: string[];
  sections: BreakdownSection[];
  grandTotalLabel?: string;
}) {
  return (
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
          {sections.map((section, sectionIdx) => (
            <Fragment key={section.title ?? sectionIdx}>
              {section.title && (
                <tr key={`${section.title}-heading`} className="bg-neutral-50/60">
                  <td
                    colSpan={months.length + 1}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 sticky left-0 bg-neutral-50/60"
                  >
                    {section.title}
                  </td>
                </tr>
              )}
              {section.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={months.length + 1}
                    className="px-4 py-2.5 text-neutral-400 italic"
                  >
                    No hours logged in this window.
                  </td>
                </tr>
              )}
              {section.rows.map((row) => (
                <tr key={row.subcategoryId} className="border-b border-neutral-100">
                  <td className="px-4 py-2 sticky left-0 bg-white text-neutral-600">
                    {row.label}
                  </td>
                  {months.map((m) => (
                    <td key={m} className="px-4 py-2 text-right whitespace-nowrap">
                      {row.hoursByMonth[m] ? formatHours(row.hoursByMonth[m]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr
                key={`${section.title ?? sectionIdx}-total`}
                className="border-b border-neutral-200 last:border-0 font-semibold"
              >
                <td className="px-4 py-2.5 sticky left-0 bg-white">{section.totalLabel}</td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-2.5 text-right whitespace-nowrap">
                    {formatHours(sumRow(section.rows, m))}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
          {grandTotalLabel && sections.length > 1 && (
            <tr className="bg-neutral-50 font-semibold">
              <td className="px-4 py-3 sticky left-0 bg-neutral-50">{grandTotalLabel}</td>
              {months.map((m) => (
                <td key={m} className="px-4 py-3 text-right whitespace-nowrap">
                  {formatHours(sections.reduce((sum, s) => sum + sumRow(s.rows, m), 0))}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
