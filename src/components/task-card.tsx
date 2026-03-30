import { ArrowRight, CalendarDays, Check, Clock3, PencilLine, Trash2 } from "lucide-react";
import clsx from "clsx";

import {
  formatTaskDate,
  getNextWorkflowStatus,
  getRelativeLabel,
  isTaskOverdue,
  priorityLabels,
  priorityToneMap,
  statusLabels,
  statusToneMap,
} from "@/lib/task-ui";
import type { Task } from "@/lib/task-types";

export function TaskCard({
  task,
  todayKey,
  onToggleDone,
  onAdvanceStatus,
  onEdit,
  onDelete,
}: {
  task: Task;
  todayKey: string;
  onToggleDone: (task: Task) => void;
  onAdvanceStatus: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const overdue = isTaskOverdue(task, todayKey);
  const nextStatus = getNextWorkflowStatus(task.status);

  return (
    <article
      className={clsx(
        "glass-panel task-shadow rounded-[1.65rem] p-5 transition-transform duration-300 hover:-translate-y-0.5",
        task.status === "done" && "bg-white/70",
      )}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => onToggleDone(task)}
          className={clsx(
            "mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition-colors",
            task.status === "done"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-700",
          )}
          aria-label={task.status === "done" ? "Mark as open" : "Mark as done"}
        >
          <Check className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                statusToneMap[task.status],
              )}
            >
              {statusLabels[task.status]}
            </span>
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                priorityToneMap[task.priority],
              )}
            >
              {priorityLabels[task.priority]}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
              {task.project}
            </span>
          </div>

          <h3
            className={clsx(
              "mt-4 text-xl font-semibold tracking-tight text-slate-950",
              task.status === "done" && "text-slate-500 line-through decoration-2",
            )}
          >
            {task.title}
          </h3>

          <p className="mt-2 text-sm leading-7 text-slate-600">
            {task.description || "Focused, concise, and ready to move."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                overdue
                  ? "bg-rose-500/12 text-rose-800 ring-1 ring-rose-500/20"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              <CalendarDays className="h-4 w-4" />
              {formatTaskDate(task.dueDate)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
              <Clock3 className="h-4 w-4" />
              Updated {getRelativeLabel(task.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAdvanceStatus(task)}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <ArrowRight className="h-4 w-4" />
          Move to {statusLabels[nextStatus]}
        </button>
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
        >
          <PencilLine className="h-4 w-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-500/14"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </article>
  );
}
