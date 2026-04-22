export class RingBuffer {
    items = [];
    capacity;
    constructor(capacity) {
        if (capacity < 1)
            throw new Error("capacity must be at least 1");
        this.capacity = capacity;
    }
    push(...items) {
        for (const item of items) {
            if (this.items.length >= this.capacity) {
                this.items.shift();
            }
            this.items.push(item);
        }
    }
    toArray() {
        return [...this.items];
    }
    get length() {
        return this.items.length;
    }
    get maxCapacity() {
        return this.capacity;
    }
}
//# sourceMappingURL=ring-buffer.js.map