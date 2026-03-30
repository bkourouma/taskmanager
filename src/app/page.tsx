import { TaskManager } from "@/components/task-manager";
import { listTasks } from "@/lib/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  const tasks = listTasks();

  return <TaskManager initialTasks={tasks} />;
}
