import { getTeamMembers, getClientBudgets } from "@/lib/data";
import {
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  addClientBudget,
  removeClientBudget,
} from "@/lib/actions";

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

export default async function SettingsPage() {
  const [members, budgets] = await Promise.all([getTeamMembers(), getClientBudgets()]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Team Roster</h2>
          <p className="text-sm text-neutral-500">
            Monthly capacity = SUM(hrs/week) × 52/12, for active members only.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Hrs/Week</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-neutral-100 last:border-0">
                  {/* Inputs are associated with the standalone <form id={`team-${m.id}`}>
                      rendered below via the `form` attribute, since a <form> can't wrap
                      table cells directly (invalid HTML: <form> is not a valid child of <tr>). */}
                  <td className="px-4 py-2">
                    <input
                      form={`team-${m.id}`}
                      name="name"
                      defaultValue={m.name}
                      className="w-full rounded border border-transparent px-2 py-1 hover:border-neutral-200 focus:border-neutral-300 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      form={`team-${m.id}`}
                      name="role"
                      defaultValue={m.role}
                      className="w-full rounded border border-transparent px-2 py-1 hover:border-neutral-200 focus:border-neutral-300 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      form={`team-${m.id}`}
                      name="hours_per_week"
                      type="number"
                      step="0.5"
                      defaultValue={m.hours_per_week}
                      className="w-20 rounded border border-transparent px-2 py-1 hover:border-neutral-200 focus:border-neutral-300 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input form={`team-${m.id}`} type="checkbox" name="active" defaultChecked={m.active} />
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      form={`team-${m.id}`}
                      type="submit"
                      className="text-xs font-medium text-neutral-600 hover:underline"
                    >
                      Save
                    </button>
                    <form action={removeTeamMember} className="contents">
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.map((m) => (
            <form key={m.id} id={`team-${m.id}`} action={updateTeamMember}>
              <input type="hidden" name="id" value={m.id} />
            </form>
          ))}
        </div>

        <form
          action={addTeamMember}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Name</label>
            <input name="name" required className="rounded border border-neutral-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Role</label>
            <input name="role" required className="rounded border border-neutral-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Hrs/Week</label>
            <input
              name="hours_per_week"
              type="number"
              step="0.5"
              defaultValue={40}
              className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Add team member
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Client-Billable Budgets</h2>
          <p className="text-sm text-neutral-500">
            Per-client monthly hours from the Hours Projection &amp; Guide sheet. Rows marked TBA
            are excluded from that month&apos;s total on the At a Glance view until confirmed.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-2 font-medium">Month</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Hours</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">{formatMonth(b.month)}</td>
                  <td className="px-4 py-2">{b.client_name}</td>
                  <td className="px-4 py-2">{b.hours}</td>
                  <td className="px-4 py-2">
                    {b.status === "tba" ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        TBA
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        Confirmed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <form action={removeClientBudget}>
                      <input type="hidden" name="id" value={b.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={addClientBudget}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Month</label>
            <input
              name="month"
              type="date"
              required
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Client</label>
            <input
              name="client_name"
              required
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Hours</label>
            <input
              name="hours"
              type="number"
              step="0.5"
              defaultValue={0}
              className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Status</label>
            <select name="status" className="rounded border border-neutral-300 px-2 py-1 text-sm">
              <option value="confirmed">Confirmed</option>
              <option value="tba">TBA</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Add budget row
          </button>
        </form>
      </section>
    </div>
  );
}
