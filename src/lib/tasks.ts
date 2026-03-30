import { getDb } from "@/lib/db";
import type {
  Task,
  TaskFilters,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskUpdateInput,
  TaskView,
} from "@/lib/task-types";

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    project: row.project,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function applyViewFilter(view: TaskView | undefined, clauses: string[]) {
  switch (view) {
    case "today":
      clauses.push("status != 'done'");
      clauses.push("date(due_date) = date('now')");
      break;
    case "upcoming":
      clauses.push("status != 'done'");
      clauses.push("date(due_date) > date('now')");
      break;
    case "overdue":
      clauses.push("status != 'done'");
      clauses.push("date(due_date) < date('now')");
      break;
    case "completed":
      clauses.push("status = 'done'");
      break;
    default:
      break;
  }
}

export function listTasks(filters: TaskFilters = {}) {
  const db = getDb();
  const clauses = ["1 = 1"];
  const params: Array<string> = [];

  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    clauses.push("(title LIKE ? OR description LIKE ? OR project LIKE ?)");
    params.push(term, term, term);
  }

  if (filters.status && filters.status !== "all") {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  if (filters.priority && filters.priority !== "all") {
    clauses.push("priority = ?");
    params.push(filters.priority);
  }

  applyViewFilter(filters.view, clauses);

  const rows = db
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          status,
          priority,
          project,
          due_date,
          completed_at,
          created_at,
          updated_at
        FROM tasks
        WHERE ${clauses.join(" AND ")}
        ORDER BY
          CASE status
            WHEN 'in_progress' THEN 0
            WHEN 'todo' THEN 1
            ELSE 2
          END,
          CASE priority
            WHEN 'urgent' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            ELSE 3
          END,
          CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
          due_date ASC,
          updated_at DESC
      `,
    )
    .all(...params) as TaskRow[];

  return rows.map(mapTask);
}

export function getTaskById(id: number) {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          id,
          title,
          description,
          status,
          priority,
          project,
          due_date,
          completed_at,
          created_at,
          updated_at
        FROM tasks
        WHERE id = ?
      `,
    )
    .get(id) as TaskRow | undefined;

  return row ? mapTask(row) : null;
}

export function createTask(input: TaskInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const task = {
    title: input.title.trim(),
    description: normalizeText(input.description, ""),
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    project: normalizeText(input.project, "Personal"),
    dueDate: input.dueDate ?? null,
    completedAt: input.status === "done" ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  const result = db
    .prepare(
      `
        INSERT INTO tasks (
          title,
          description,
          status,
          priority,
          project,
          due_date,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      task.title,
      task.description,
      task.status,
      task.priority,
      task.project,
      task.dueDate,
      task.completedAt,
      task.createdAt,
      task.updatedAt,
    );

  return getTaskById(Number(result.lastInsertRowid));
}

export function updateTask(id: number, patch: TaskUpdateInput) {
  const db = getDb();
  const current = getTaskById(id);

  if (!current) {
    return null;
  }

  const now = new Date().toISOString();
  const nextStatus = patch.status ?? current.status;
  const nextTask = {
    title: patch.title?.trim() ?? current.title,
    description:
      patch.description !== undefined
        ? normalizeText(patch.description, "")
        : current.description,
    status: nextStatus,
    priority: patch.priority ?? current.priority,
    project:
      patch.project !== undefined
        ? normalizeText(patch.project, "Personal")
        : current.project,
    dueDate: patch.dueDate !== undefined ? patch.dueDate : current.dueDate,
    completedAt:
      nextStatus === "done"
        ? current.status === "done"
          ? current.completedAt
          : now
        : null,
    updatedAt: now,
  };

  db.prepare(
    `
      UPDATE tasks
      SET
        title = ?,
        description = ?,
        status = ?,
        priority = ?,
        project = ?,
        due_date = ?,
        completed_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
  ).run(
    nextTask.title,
    nextTask.description,
    nextTask.status,
    nextTask.priority,
    nextTask.project,
    nextTask.dueDate,
    nextTask.completedAt,
    nextTask.updatedAt,
    id,
  );

  return getTaskById(id);
}

export function deleteTask(id: number) {
  const db = getDb();
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return result.changes > 0;
}
