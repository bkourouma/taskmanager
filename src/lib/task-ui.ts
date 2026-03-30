import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  parseISO,
} from "date-fns";

import type { Task, TaskPriority, TaskStatus, TaskView } from "@/lib/task-types";

export const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const priorityToneMap: Record<TaskPriority, string> = {
  low: "bg-emerald-500/12 text-emerald-900 ring-1 ring-emerald-500/20",
  medium: "bg-sky-500/12 text-sky-900 ring-1 ring-sky-500/20",
  high: "bg-amber-500/14 text-amber-900 ring-1 ring-amber-500/20",
  urgent: "bg-rose-500/14 text-rose-900 ring-1 ring-rose-500/20",
};

export const statusToneMap: Record<TaskStatus, string> = {
  todo: "bg-white/80 text-slate-700 ring-1 ring-slate-200",
  in_progress: "bg-indigo-500/10 text-indigo-900 ring-1 ring-indigo-500/15",
  done: "bg-emerald-500/10 text-emerald-900 ring-1 ring-emerald-500/15",
};

export function formatTaskDate(value: string | null) {
  if (!value) {
    return "No deadline";
  }

  const date = parseISO(value);

  if (isToday(date)) {
    return "Today";
  }

  if (isTomorrow(date)) {
    return "Tomorrow";
  }

  return format(date, "EEE, MMM d");
}

export function getRelativeLabel(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true });
}

export function statusSortValue(status: TaskStatus) {
  if (status === "in_progress") return 0;
  if (status === "todo") return 1;
  return 2;
}

export function prioritySortValue(priority: TaskPriority) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "medium") return 2;
  return 3;
}

export function isTaskOverdue(task: Task, todayKey: string) {
  return Boolean(task.dueDate && task.dueDate < todayKey && task.status !== "done");
}

export function getNextWorkflowStatus(status: TaskStatus): TaskStatus {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return "todo";
}

export function matchesView(task: Task, view: TaskView, todayKey: string) {
  if (view === "today") {
    return task.dueDate === todayKey && task.status !== "done";
  }

  if (view === "upcoming") {
    return Boolean(task.dueDate && task.dueDate > todayKey && task.status !== "done");
  }

  if (view === "overdue") {
    return isTaskOverdue(task, todayKey);
  }

  if (view === "completed") {
    return task.status === "done";
  }

  return true;
}
