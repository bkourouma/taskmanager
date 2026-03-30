import { z } from "zod";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/task-types";

const dueDateField = z
  .union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

const descriptionField = z
  .string()
  .trim()
  .max(500, "Keep descriptions under 500 characters.")
  .optional()
  .transform((value) => value ?? "");

const projectField = z
  .string()
  .trim()
  .max(60, "Project names should stay under 60 characters.")
  .optional()
  .transform((value) => value || "Personal");

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "A task title is required.")
    .max(120, "Keep task titles under 120 characters."),
  description: descriptionField,
  project: projectField,
  priority: z.enum(TASK_PRIORITIES).optional().default("medium"),
  status: z.enum(TASK_STATUSES).optional().default("todo"),
  dueDate: dueDateField,
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });
