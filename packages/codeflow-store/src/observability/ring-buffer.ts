export class RingBuffer<T> {
  private items: T[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("capacity must be at least 1");
    this.capacity = capacity;
  }

  push(...items: T[]): void {
    for (const item of items) {
      if (this.items.length >= this.capacity) {
        this.items.shift();
      }
      this.items.push(item);
    }
  }

  toArray(): T[] {
    return [...this.items];
  }

  get length(): number {
    return this.items.length;
  }

  get maxCapacity(): number {
    return this.capacity;
  }
}
