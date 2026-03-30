export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const TASK_VIEWS = [
  "all",
  "today",
  "upcoming",
  "overdue",
  "completed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskView = (typeof TASK_VIEWS)[number];

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFilters {
  q?: string;
  view?: TaskView;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  dueDate?: string | null;
}

export type TaskUpdateInput = Partial<TaskInput>;
