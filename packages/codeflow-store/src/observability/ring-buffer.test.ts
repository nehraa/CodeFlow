import { describe, it, expect, beforeEach } from "vitest";
import { RingBuffer } from "./ring-buffer.js";

describe("RingBuffer", () => {
  describe("constructor", () => {
    it("should create with positive capacity", () => {
      const buffer = new RingBuffer(5);
      expect(buffer.maxCapacity).toBe(5);
      expect(buffer.length).toBe(0);
    });

    it("should throw for zero capacity", () => {
      expect(() => new RingBuffer(0)).toThrow("capacity must be at least 1");
    });

    it("should throw for negative capacity", () => {
      expect(() => new RingBuffer(-1)).toThrow("capacity must be at least 1");
    });
  });

  describe("push", () => {
    it("should add items up to capacity", () => {
      const buffer = new RingBuffer(3);
      buffer.push("a", "b", "c");
      expect(buffer.length).toBe(3);
      expect(buffer.toArray()).toEqual(["a", "b", "c"]);
    });

    it("should evict oldest when over capacity", () => {
      const buffer = new RingBuffer(3);
      buffer.push("a", "b", "c");
      buffer.push("d");
      expect(buffer.length).toBe(3);
      expect(buffer.toArray()).toEqual(["b", "c", "d"]);
    });

    it("should evict multiple oldest when adding many over capacity", () => {
      const buffer = new RingBuffer(3);
      buffer.push("a", "b");
      buffer.push("c", "d", "e", "f");
      expect(buffer.length).toBe(3);
      expect(buffer.toArray()).toEqual(["d", "e", "f"]);
    });

    it("should handle single item at capacity", () => {
      const buffer = new RingBuffer(2);
      buffer.push("a");
      buffer.push("b");
      buffer.push("c");
      expect(buffer.length).toBe(2);
      expect(buffer.toArray()).toEqual(["b", "c"]);
    });
  });

  describe("toArray", () => {
    it("should return copy of internal array", () => {
      const buffer = new RingBuffer(3);
      buffer.push(1, 2);
      const arr = buffer.toArray();
      arr.push(999);
      expect(buffer.toArray()).toEqual([1, 2]);
    });
  });

  describe("order preservation", () => {
    it("should maintain insertion order within capacity", () => {
      const buffer = new RingBuffer(5);
      buffer.push("first", "second", "third");
      expect(buffer.toArray()).toEqual(["first", "second", "third"]);
    });

    it("should drop oldest when full", () => {
      const buffer = new RingBuffer(2);
      buffer.push("oldest", "middle");
      buffer.push("newest");
      expect(buffer.toArray()).toEqual(["middle", "newest"]);
    });
  });
});