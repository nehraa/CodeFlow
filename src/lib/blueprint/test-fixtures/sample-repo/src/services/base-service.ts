export class BaseService {
  protected stamp(name: string): string {
    return `task:${name}`;
  }
}
