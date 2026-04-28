import { BaseService } from "./base-service";

export type TaskInput = {
  title: string;
};

export function normalizeTask(input: TaskInput): TaskInput {
  return {
    title: input.title.trim()
  };
}

export class TaskService extends BaseService {
  saveTask(input: TaskInput): { id: string; title: string } {
    const normalized = normalizeTask(input);

    return {
      id: this.stamp(normalized.title),
      title: normalized.title
    };
  }
}
