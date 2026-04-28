import { TaskService } from "../../../services/task-service";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { title: string };
  const service = new TaskService();
  const task = service.saveTask({ title: payload.title });

  return Response.json(task);
}
