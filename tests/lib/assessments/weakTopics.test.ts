import { describe, it, expect } from "vitest";
import { computeWeakTopics } from "@/lib/assessments/weakTopics";

describe("computeWeakTopics", () => {
  it("computes wrong-rate per topic, sorted worst first", () => {
    const result = computeWeakTopics([
      { topic: "Fractions", isCorrect: false },
      { topic: "Fractions", isCorrect: false },
      { topic: "Algebra", isCorrect: true },
      { topic: "Algebra", isCorrect: false },
    ]);
    expect(result[0]).toEqual({ topic: "Fractions", attempts: 2, wrongRate: 100 });
    expect(result[1]).toEqual({ topic: "Algebra", attempts: 2, wrongRate: 50 });
  });

  it("excludes a topic with fewer than 2 attempts, so one lucky/unlucky guess can't look like a trend", () => {
    const result = computeWeakTopics([{ topic: "Geometry", isCorrect: false }]);
    expect(result.find((t) => t.topic === "Geometry")).toBeUndefined();
  });

  it("excludes a 1-attempt topic even when it would otherwise sort to the very top", () => {
    const result = computeWeakTopics([
      { topic: "Geometry", isCorrect: false },
      { topic: "Algebra", isCorrect: true },
      { topic: "Algebra", isCorrect: false },
    ]);
    expect(result.map((t) => t.topic)).toEqual(["Algebra"]);
    expect(result.find((t) => t.topic === "Geometry")).toBeUndefined();
  });

  it("excludes a 1-attempt perfect topic too, never reporting a misleading 0% weak topic", () => {
    const result = computeWeakTopics([{ topic: "Geometry", isCorrect: true }]);
    expect(result).toEqual([]);
  });

  it("returns an empty list for no attempts at all", () => {
    expect(computeWeakTopics([])).toEqual([]);
  });
});
