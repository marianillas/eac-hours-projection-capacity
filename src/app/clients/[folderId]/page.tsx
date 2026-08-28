import { notFound } from "next/navigation";
import { getClientFolders, getClientProjects, rollingMonths } from "@/lib/data";
import { formatMonth, formatCurrency } from "@/lib/format";
import { addProject, updateProject, removeProject, addTask, removeTask, updateTaskHours } from "@/lib/actions";
import { ClientSidebar } from "../client-sidebar";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const [clients, projects] = await Promise.all([getClientFolders(), getClientProjects(folderId)]);

  const client = clients.find((c) => c.folder_id === folderId);
  if (!client) notFound();

  const months = rollingMonths({ back: 2, forward: 4 });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 flex gap-6">
      <ClientSidebar clients={clients} activeFolderId={folderId} />

      <div className="flex-1 space-y-6 min-w-0">
        <div>
          <h1 className="text-xl font-semibold">{client.name}</h1>
          <p className="text-sm text-neutral-500">
            Per-task budget: hours are entered, dollars are computed from the project&apos;s
            hourly rate.
          </p>
        </div>

        {projects.length === 0 && (
          <p className="text-sm text-neutral-400 italic">No projects yet — add one below.</p>
        )}

        {projects.map((project) => {
          const rate = Number(project.hourly_rate);
          const totalsByMonth = Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;
          let grandTotal = 0;
          for (const task of project.tasks) {
            for (const m of months) {
              const hours = task.hoursByMonth[m] ?? 0;
              const dollars = hours * rate;
              totalsByMonth[m] += dollars;
              grandTotal += dollars;
            }
          }

          return (
            <section key={project.id} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Project</label>
                    <input
                      form={`project-${project.id}`}
                      name="name"
                      defaultValue={project.name}
                      className="rounded border border-neutral-300 px-2 py-1 text-sm font-medium min-w-48"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Hourly Rate</label>
                    <input
                      form={`project-${project.id}`}
                      name="hourly_rate"
                      type="number"
                      step="0.01"
                      defaultValue={project.hourly_rate}
                      className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    form={`project-${project.id}`}
                    type="submit"
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                  >
                    Save
                  </button>
                </div>
                <form action={removeProject}>
                  <input type="hidden" name="id" value={project.id} />
                  <input type="hidden" name="client_folder_id" value={folderId} />
                  <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                    Remove project
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto rounded border border-neutral-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                      <th className="px-3 py-2 font-medium w-16">#</th>
                      <th className="px-3 py-2 font-medium">Task</th>
                      {months.map((m) => (
                        <th key={m} className="px-3 py-2 font-medium text-right whitespace-nowrap">
                          {formatMonth(m)}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Total $</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.tasks.length === 0 && (
                      <tr>
                        <td colSpan={months.length + 3} className="px-3 py-2 text-neutral-400 italic">
                          No tasks yet.
                        </td>
                      </tr>
                    )}
                    {project.tasks.map((task) => {
                      const taskTotal = months.reduce(
                        (sum, m) => sum + (task.hoursByMonth[m] ?? 0) * rate,
                        0,
                      );
                      return (
                        <tr key={task.id} className="border-b border-neutral-100">
                          <td className="px-3 py-1.5">
                            <input
                              form={`task-${task.id}`}
                              name="task_number"
                              defaultValue={task.task_number}
                              className="w-14 rounded border border-transparent px-1 py-0.5 hover:border-neutral-200 focus:border-neutral-300 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              form={`task-${task.id}`}
                              name="name"
                              defaultValue={task.name}
                              className="w-full min-w-40 rounded border border-transparent px-1 py-0.5 hover:border-neutral-200 focus:border-neutral-300 focus:outline-none"
                            />
                          </td>
                          {months.map((m) => (
                            <td key={m} className="px-3 py-1.5">
                              <input
                                form={`task-${task.id}`}
                                name={`hours_${m}`}
                                type="number"
                                step="0.5"
                                defaultValue={task.hoursByMonth[m] ?? 0}
                                className="w-20 rounded border border-transparent px-1 py-0.5 text-right hover:border-neutral-200 focus:border-neutral-300 focus:outline-none"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right whitespace-nowrap text-neutral-600">
                            {formatCurrency(taskTotal)}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <button
                              form={`task-${task.id}`}
                              type="submit"
                              className="text-xs font-medium text-neutral-600 hover:underline"
                            >
                              Save
                            </button>{" "}
                            <form action={removeTask} className="inline">
                              <input type="hidden" name="id" value={task.id} />
                              <input type="hidden" name="client_folder_id" value={folderId} />
                              <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                                Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {project.tasks.length > 0 && (
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={2} className="px-3 py-2">
                          Total
                        </td>
                        {months.map((m) => (
                          <td key={m} className="px-3 py-2 text-right whitespace-nowrap">
                            {formatCurrency(totalsByMonth[m])}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(grandTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {project.tasks.map((task) => (
                <form key={task.id} id={`task-${task.id}`} action={updateTaskHours}>
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="client_folder_id" value={folderId} />
                </form>
              ))}
              <form id={`project-${project.id}`} action={updateProject}>
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="client_folder_id" value={folderId} />
              </form>

              <form
                action={addTask}
                className="flex flex-wrap items-end gap-3 rounded border border-dashed border-neutral-300 p-3"
              >
                <input type="hidden" name="project_id" value={project.id} />
                <input type="hidden" name="client_folder_id" value={folderId} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">#</label>
                  <input name="task_number" className="w-14 rounded border border-neutral-300 px-2 py-1 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">Task name</label>
                  <input
                    name="name"
                    required
                    className="min-w-56 rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  Add task
                </button>
              </form>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500">Notes</label>
                <textarea
                  form={`project-${project.id}`}
                  name="notes"
                  defaultValue={project.notes}
                  rows={3}
                  placeholder="Freeform notes about this project's budget…"
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </div>
            </section>
          );
        })}

        <form
          action={addProject}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-4"
        >
          <input type="hidden" name="client_folder_id" value={folderId} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Project name</label>
            <input name="name" required className="min-w-48 rounded border border-neutral-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Hourly Rate</label>
            <input
              name="hourly_rate"
              type="number"
              step="0.01"
              defaultValue={0}
              className="w-28 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Add project
          </button>
        </form>
      </div>
    </div>
  );
}
