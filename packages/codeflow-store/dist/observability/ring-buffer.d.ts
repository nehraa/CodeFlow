export declare class RingBuffer<T> {
    private items;
    private readonly capacity;
    constructor(capacity: number);
    push(...items: T[]): void;
    toArray(): T[];
    get length(): number;
    get maxCapacity(): number;
}
//# sourceMappingURL=ring-buffer.d.ts.map