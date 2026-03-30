"use client";

import {
  type FormEvent,
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  CalendarDays,
  CircleDot,
  ClipboardList,
  Flame,
  FolderKanban,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";

import { StatCard } from "@/components/stat-card";
import { TaskCard } from "@/components/task-card";
import {
  formatTaskDate,
  getNextWorkflowStatus,
  isTaskOverdue,
  matchesView,
  priorityLabels,
  prioritySortValue,
  statusLabels,
  statusSortValue,
  statusToneMap,
} from "@/lib/task-ui";
import type { Task, TaskPriority, TaskStatus, TaskView } from "@/lib/task-types";

type FilterPriority = TaskPriority | "all";
type FilterStatus = TaskStatus | "all";

interface TaskManagerProps {
  initialTasks: Task[];
}

interface TaskFormState {
  title: string;
  description: string;
  project: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
}

const viewOptions: Array<{ value: TaskView; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

const priorityOptions: Array<{ value: FilterPriority; label: string }> = [
  { value: "all", label: "Any priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusOptions: Array<{ value: FilterStatus; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const emptyTaskForm: TaskFormState = {
  title: "",
  description: "",
  project: "Personal",
  priority: "medium",
  status: "todo",
  dueDate: "",
};

function taskToFormState(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description,
    project: task.project,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? "",
  };
}

export function TaskManager({ initialTasks }: TaskManagerProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState<TaskFormState>(emptyTaskForm);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [editorDraft, setEditorDraft] = useState<TaskFormState | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TaskView>("all");
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const sortedTasks = [...tasks].sort((left, right) => {
    const statusDifference = statusSortValue(left.status) - statusSortValue(right.status);
    if (statusDifference !== 0) return statusDifference;

    const priorityDifference =
      prioritySortValue(left.priority) - prioritySortValue(right.priority);
    if (priorityDifference !== 0) return priorityDifference;

    if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
    if (left.dueDate) return -1;
    if (right.dueDate) return 1;

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const visibleTasks = sortedTasks.filter((task) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [task.title, task.description, task.project]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);

    return (
      matchesSearch &&
      (priorityFilter === "all" || task.priority === priorityFilter) &&
      (statusFilter === "all" || task.status === statusFilter) &&
      matchesView(task, view, todayKey)
    );
  });

  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const overdueCount = tasks.filter((task) => isTaskOverdue(task, todayKey)).length;
  const todayCount = tasks.filter(
    (task) => task.dueDate === todayKey && task.status !== "done",
  ).length;
  const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const focusTasks = sortedTasks
    .filter(
      (task) =>
        task.status !== "done" &&
        (task.status === "in_progress" || task.dueDate === todayKey),
    )
    .slice(0, 3);

  const upcomingTasks = sortedTasks
    .filter((task) => task.status !== "done" && Boolean(task.dueDate && task.dueDate >= todayKey))
    .slice(0, 5);

  const priorityStats = ["urgent", "high", "medium", "low"].map((priority) => ({
    priority: priority as TaskPriority,
    count: tasks.filter((task) => task.priority === priority && task.status !== "done").length,
  }));

  useEffect(() => {
    if (!feedback && !error) return;

    const timeout = window.setTimeout(() => {
      setFeedback(null);
      setError(null);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [feedback, error]);

  async function sendJson<T>(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Something went wrong.");
    }

    return payload;
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!draft.title.trim()) {
      setError("Add a task title before saving.");
      return;
    }

    try {
      const payload = await sendJson<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ ...draft, dueDate: draft.dueDate || null }),
      });

      startTransition(() => {
        setTasks((current) => [payload.task, ...current]);
        setDraft((current) => ({
          ...current,
          title: "",
          description: "",
          dueDate: "",
          status: "todo",
        }));
        setFeedback("Task captured and added to your queue.");
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create the task.");
    }
  }

  function openEditor(task: Task) {
    setEditorTask(task);
    setEditorDraft(taskToFormState(task));
  }

  function closeEditor() {
    setEditorTask(null);
    setEditorDraft(null);
  }

  async function saveTaskEdits() {
    if (!editorTask || !editorDraft) return;

    setError(null);

    try {
      const payload = await sendJson<{ task: Task }>(`/api/tasks/${editorTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...editorDraft, dueDate: editorDraft.dueDate || null }),
      });

      startTransition(() => {
        setTasks((current) =>
          current.map((task) => (task.id === payload.task.id ? payload.task : task)),
        );
        closeEditor();
        setFeedback("Task updated.");
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save changes.");
    }
  }

  async function mutateTask(task: Task, patch: Partial<TaskFormState>) {
    setError(null);

    try {
      const payload = await sendJson<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...patch,
          dueDate: patch.dueDate === "" ? null : patch.dueDate,
        }),
      });

      startTransition(() => {
        setTasks((current) =>
          current.map((item) => (item.id === payload.task.id ? payload.task : item)),
        );
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update the task.");
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;

    setError(null);

    try {
      await sendJson<{ success: true }>(`/api/tasks/${task.id}`, { method: "DELETE" });

      startTransition(() => {
        setTasks((current) => current.filter((item) => item.id !== task.id));
        setFeedback("Task removed.");
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete the task.");
    }
  }

  async function handleToggleDone(task: Task) {
    await mutateTask(task, { status: task.status === "done" ? "todo" : "done" });
  }

  async function handleAdvanceStatus(task: Task) {
    await mutateTask(task, { status: getNextWorkflowStatus(task.status) });
  }

  return (
    <>
      <div className="relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,122,24,0.35),rgba(255,122,24,0))]" />
          <div className="absolute right-[-12%] top-[10rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.22),rgba(59,130,246,0))]" />
          <div className="absolute bottom-[-10rem] left-[15%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,184,169,0.22),rgba(0,184,169,0))]" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
            <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 ring-1 ring-white/70">
                <Sparkles className="h-4 w-4 text-orange-500" />
                Progressive workspace
              </div>

              <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.32em] text-slate-500">
                    {format(new Date(), "EEEE, MMMM d")}
                  </p>
                  <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                    Momentum task manager for calm, focused execution.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                    Capture work fast, prioritize what matters, and keep the whole
                    pipeline visible without losing the visual polish of a modern product dashboard.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("quick-capture")?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  New task
                </button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total" value={String(tasks.length)} caption="All active and completed work in one stream." />
                <StatCard label="In Motion" value={String(inProgressCount)} caption="Tasks actively moving through your day." />
                <StatCard label="Due Today" value={String(todayCount)} caption="Items scheduled to land before the day closes." />
                <StatCard label="Overdue" value={String(overdueCount)} caption="Signals that need attention before they drift further." />
              </div>
            </div>

            <aside className="glass-panel rounded-[2rem] p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Delivery pulse</p>
                  <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">Daily momentum</h2>
                </div>
                <Target className="h-6 w-6 text-orange-500" />
              </div>

              <div className="mt-8 flex items-center gap-6">
                <div
                  className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#0f172a ${completionRate}%, rgba(15, 23, 42, 0.08) ${completionRate}% 100%)`,
                  }}
                >
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-[rgba(248,250,252,0.92)] backdrop-blur">
                    <div className="text-center">
                      <p className="text-3xl font-semibold text-slate-950">{completionRate}%</p>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">complete</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.4rem] bg-white/80 p-4 ring-1 ring-white/70">
                    <p className="text-sm text-slate-500">Done today</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{doneCount}</p>
                  </div>
                  <div className="rounded-[1.4rem] bg-slate-950 p-4 text-white">
                    <p className="text-sm text-white/70">Next focus</p>
                    <p className="mt-1 text-base font-medium">{focusTasks[0]?.title ?? "Queue a meaningful task to begin."}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-3">
                {priorityStats.map(({ priority, count }) => (
                  <div key={priority} className="rounded-2xl bg-white/75 p-3 ring-1 ring-white/70">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{priorityLabels[priority]}</span>
                      <span className="text-slate-500">{count} open</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
                      <div
                        className={clsx(
                          "h-full rounded-full",
                          priority === "urgent" && "bg-rose-500",
                          priority === "high" && "bg-amber-500",
                          priority === "medium" && "bg-sky-500",
                          priority === "low" && "bg-emerald-500",
                        )}
                        style={{
                          width: `${tasks.length ? Math.max((count / tasks.length) * 100, count > 0 ? 8 : 0) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-6">
              <form
                id="quick-capture"
                onSubmit={handleCreateTask}
                className="glass-panel rounded-[2rem] p-6 sm:p-8"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                      Quick capture
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                      Add work without breaking flow.
                    </h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-800">
                    <Flame className="h-4 w-4" />
                    Fast entry
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Title</span>
                    <input
                      value={draft.title}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Ship pricing page polish"
                      className="surface-input"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Project</span>
                    <input
                      value={draft.project}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, project: event.target.value }))
                      }
                      placeholder="Product"
                      className="surface-input"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Priority</span>
                    <select
                      value={draft.priority}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          priority: event.target.value as TaskPriority,
                        }))
                      }
                      className="surface-input"
                    >
                      {priorityOptions
                        .filter((option) => option.value !== "all")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Due date</span>
                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, dueDate: event.target.value }))
                      }
                      className="surface-input"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Notes</span>
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Capture context, links, or the first concrete step."
                      rows={3}
                      className="surface-input min-h-[104px] resize-none"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[1.25rem] bg-slate-950 px-5 py-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 lg:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Add task
                    </button>
                  </div>
                </div>
              </form>

              <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                        Command center
                      </p>
                      <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                        Slice the queue your way.
                      </h2>
                    </div>

                    <label className="relative block lg:max-w-sm lg:flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search title, notes, or project"
                        className="surface-input pl-11"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {viewOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setView(option.value)}
                          className={clsx(
                            "rounded-full px-4 py-2 text-sm font-medium transition",
                            view === option.value
                              ? "bg-slate-950 text-white"
                              : "bg-white/80 text-slate-600 ring-1 ring-white/70 hover:text-slate-950",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={priorityFilter}
                        onChange={(event) =>
                          setPriorityFilter(event.target.value as FilterPriority)
                        }
                        className="surface-input"
                      >
                        {priorityOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as FilterStatus)
                        }
                        className="surface-input"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {focusTasks.length > 0 && (
                <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                        Focus lane
                      </p>
                      <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                        Tasks already carrying momentum.
                      </h2>
                    </div>
                    <CircleDot className="h-6 w-6 text-indigo-500" />
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {focusTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => openEditor(task)}
                        className="rounded-[1.6rem] bg-white/80 p-5 text-left ring-1 ring-white/70 transition hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={clsx(
                              "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                              statusToneMap[task.status],
                            )}
                          >
                            {statusLabels[task.status]}
                          </span>
                          <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                            {priorityLabels[task.priority]}
                          </span>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
                          {task.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {task.description || "Open the editor to add more context."}
                        </p>
                        <p className="mt-5 text-sm font-medium text-slate-500">
                          {formatTaskDate(task.dueDate)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                      Task stream
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                      {visibleTasks.length} task{visibleTasks.length === 1 ? "" : "s"} in
                      view
                    </h2>
                  </div>
                  <ClipboardList className="h-6 w-6 text-slate-400" />
                </div>

                <div className="mt-6 space-y-4">
                  {visibleTasks.length === 0 ? (
                    <div className="rounded-[1.8rem] border border-dashed border-slate-300/80 bg-white/60 px-6 py-14 text-center">
                      <h3 className="font-display text-2xl font-semibold text-slate-950">
                        Nothing in this slice yet.
                      </h3>
                      <p className="mt-3 text-base leading-8 text-slate-600">
                        Try a different filter, clear the search, or capture a new
                        task above to bring this view to life.
                      </p>
                    </div>
                  ) : (
                    visibleTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        todayKey={todayKey}
                        onToggleDone={handleToggleDone}
                        onAdvanceStatus={handleAdvanceStatus}
                        onEdit={openEditor}
                        onDelete={handleDeleteTask}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                      Upcoming
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                      Deadline radar
                    </h2>
                  </div>
                  <CalendarDays className="h-6 w-6 text-sky-500" />
                </div>

                <div className="mt-6 space-y-3">
                  {upcomingTasks.length === 0 ? (
                    <div className="rounded-[1.6rem] bg-white/70 p-5 text-sm leading-7 text-slate-600 ring-1 ring-white/70">
                      Clear runway. Add due dates to keep the dashboard forecasting
                      ahead.
                    </div>
                  ) : (
                    upcomingTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => openEditor(task)}
                        className="flex w-full items-start justify-between gap-4 rounded-[1.4rem] bg-white/75 p-4 text-left ring-1 ring-white/70 transition hover:bg-white"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {task.title}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">{task.project}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-700">
                            {formatTaskDate(task.dueDate)}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {priorityLabels[task.priority]}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                      Structure
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                      Workflow snapshot
                    </h2>
                  </div>
                  <FolderKanban className="h-6 w-6 text-emerald-500" />
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    {
                      label: "To do",
                      count: tasks.filter((task) => task.status === "todo").length,
                      tone: "bg-slate-950",
                    },
                    {
                      label: "In progress",
                      count: tasks.filter((task) => task.status === "in_progress").length,
                      tone: "bg-indigo-500",
                    },
                    {
                      label: "Done",
                      count: doneCount,
                      tone: "bg-emerald-500",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="text-slate-500">{item.count}</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200/70">
                        <div
                          className={clsx("h-full rounded-full", item.tone)}
                          style={{
                            width: `${tasks.length ? (item.count / tasks.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                      Notes
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                      How this board works
                    </h2>
                  </div>
                  <Sparkles className="h-6 w-6 text-orange-500" />
                </div>

                <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
                  <p>
                    Use the quick capture panel for fast entry, then push tasks
                    through <span className="font-medium text-slate-900">To do</span>,
                    <span className="font-medium text-slate-900"> In progress</span>,
                    and <span className="font-medium text-slate-900">Done</span>.
                  </p>
                  <p>
                    Search, priority, and status filters stack together so you can
                    move from strategic overview to precise execution in a couple of
                    clicks.
                  </p>
                  <p>
                    Every task is stored in SQLite locally, which keeps the stack
                    lightweight and easy to extend.
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>

      {(feedback || error) && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-[1.4rem] bg-slate-950 px-5 py-4 text-sm font-medium text-white shadow-2xl shadow-slate-950/20">
          {error ?? feedback}
        </div>
      )}

      {editorTask && editorDraft && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Edit task</p>
                <h2 className="font-display mt-2 text-3xl font-semibold text-slate-950">{editorTask.title}</h2>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 text-slate-500 ring-1 ring-white/70 transition hover:text-slate-950"
                aria-label="Close editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  value={editorDraft.title}
                  onChange={(event) =>
                    setEditorDraft((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  className="surface-input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Project</span>
                <input
                  value={editorDraft.project}
                  onChange={(event) =>
                    setEditorDraft((current) =>
                      current ? { ...current, project: event.target.value } : current,
                    )
                  }
                  className="surface-input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Due date</span>
                <input
                  type="date"
                  value={editorDraft.dueDate}
                  onChange={(event) =>
                    setEditorDraft((current) =>
                      current ? { ...current, dueDate: event.target.value } : current,
                    )
                  }
                  className="surface-input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Priority</span>
                <select
                  value={editorDraft.priority}
                  onChange={(event) =>
                    setEditorDraft((current) =>
                      current
                        ? {
                            ...current,
                            priority: event.target.value as TaskPriority,
                          }
                        : current,
                    )
                  }
                  className="surface-input"
                >
                  {priorityOptions
                    .filter((option) => option.value !== "all")
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select
                  value={editorDraft.status}
                  onChange={(event) =>
                    setEditorDraft((current) =>
                      current
                        ? {
                            ...current,
                            status: event.target.value as TaskStatus,
                          }
                        : current,
                    )
                  }
                  className="surface-input"
                >
                  {statusOptions
                    .filter((option) => option.value !== "all")
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea
                  value={editorDraft.description}
                  onChange={(event) =>
                    setEditorDraft((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value,
                          }
                        : current,
                    )
                  }
                  rows={4}
                  className="surface-input min-h-[132px] resize-none"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTaskEdits}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
