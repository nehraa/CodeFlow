import { BaseService } from "./base-service.js";

/**
 * Process data and return a formatted result.
 */
export function processData(input: string): string {
  return `processed: ${input}`;
}

export function calculateSum(a: number, b: number): number {
  return a + b;
}

/**
 * UserService handles user operations.
 */
export class UserService extends BaseService {
  private dbHost: string;

  constructor(host: string) {
    super();
    this.dbHost = host;
  }

  getUser(id: number): string {
    const data = processData("user");
    return data;
  }

  saveUser(name: string): boolean {
    const formatted = processData(name);
    return formatted.length > 0;
  }
}

export class TaskService extends BaseService {
  createTask(title: string): string {
    const result = processData(title);
    return result;
  }

  run(): boolean {
    this.connect();
    return true;
  }
}

const svc = new UserService("localhost");
const user = svc.getUser(1);
