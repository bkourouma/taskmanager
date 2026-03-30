import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateTaskSchema } from "@/lib/task-schema";
import { deleteTask, updateTask } from "@/lib/tasks";

export const runtime = "nodejs";

function parseTaskId(id: string) {
  const taskId = Number(id);
  return Number.isInteger(taskId) && taskId > 0 ? taskId : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const taskId = parseTaskId(id);

    if (!taskId) {
      return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
    }

    const json = await request.json();
    const payload = updateTaskSchema.parse(json);
    const task = updateTask(taskId, payload);

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid update payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to update the task right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  }

  const deleted = deleteTask(taskId);

  if (!deleted) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
