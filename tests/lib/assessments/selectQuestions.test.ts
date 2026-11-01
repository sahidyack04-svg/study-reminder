import { describe, it, expect } from "vitest";
import { pickRandomQuestions } from "@/lib/assessments/selectQuestions";

describe("pickRandomQuestions", () => {
  it("returns every item from the pool, at most once, when count exceeds pool size", () => {
    const pool = ["a", "b", "c"];
    const result = pickRandomQuestions(pool, 10, () => 0);
    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(pool));
  });

  it("returns exactly `count` items when the pool is larger", () => {
    const pool = ["a", "b", "c", "d", "e"];
    const result = pickRandomQuestions(pool, 2, () => 0.5);
    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);
  });

  it("never mutates the caller's pool", () => {
    const pool = ["a", "b", "c", "d"];
    pickRandomQuestions(pool, 2, () => 0.9);
    expect(pool).toEqual(["a", "b", "c", "d"]);
  });

  it("returns an empty list for an empty pool or a non-positive count", () => {
    expect(pickRandomQuestions([], 5, () => 0)).toEqual([]);
    expect(pickRandomQuestions(["a", "b"], 0, () => 0)).toEqual([]);
  });
});
