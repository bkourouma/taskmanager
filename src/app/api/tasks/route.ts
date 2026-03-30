import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createTaskSchema } from "@/lib/task-schema";
import { createTask, listTasks } from "@/lib/tasks";
import type { TaskFilters } from "@/lib/task-types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const filters: TaskFilters = {
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    view:
      (request.nextUrl.searchParams.get("view") as TaskFilters["view"]) ??
      undefined,
    status:
      (request.nextUrl.searchParams.get("status") as TaskFilters["status"]) ??
      undefined,
    priority:
      (request.nextUrl.searchParams.get("priority") as TaskFilters["priority"]) ??
      undefined,
  };

  return NextResponse.json({ tasks: listTasks(filters) });
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = createTaskSchema.parse(json);
    const task = createTask(payload);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid task payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create the task right now." },
      { status: 500 },
    );
  }
}
