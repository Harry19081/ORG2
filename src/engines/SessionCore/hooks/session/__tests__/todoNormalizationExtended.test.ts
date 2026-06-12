/**
 * todoNormalization — extended edge-case tests.
 *
 * The main coverage (normalizePersistedTodo, normalizePersistedTodoList,
 * isExpectedTodoLoadRejection) is in useTodoSync.helpers.test.ts.
 * This file adds focused edge-case coverage for `sanitizeTodoDisplayText`
 * and boundary cases not covered by the primary test file.
 */
import { describe, expect, it } from "vitest";

import {
  isExpectedTodoLoadRejection,
  normalizePersistedTodo,
  sanitizeTodoDisplayText,
} from "../todoNormalization";

describe("sanitizeTodoDisplayText", () => {
  it("returns empty string for blank input", () => {
    expect(sanitizeTodoDisplayText("")).toBe("");
    expect(sanitizeTodoDisplayText("   ")).toBe("");
  });

  it("replaces a standalone .plan.md filename with 'Implement approved plan'", () => {
    expect(sanitizeTodoDisplayText("my-task.plan.md")).toBe(
      "Implement approved plan"
    );
  });

  it("replaces an inline .plan.md reference with 'approved plan'", () => {
    const result = sanitizeTodoDisplayText(
      "implement tasks/feature.plan.md now"
    );
    expect(result).toContain("approved plan");
    expect(result).not.toContain(".plan.md");
  });

  it("collapses multiple whitespace to a single space", () => {
    expect(sanitizeTodoDisplayText("do   the   thing")).toBe("do the thing");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeTodoDisplayText("  trim me  ")).toBe("trim me");
  });

  it("handles text with no .plan.md and no whitespace issues unchanged", () => {
    expect(sanitizeTodoDisplayText("Write unit tests")).toBe(
      "Write unit tests"
    );
  });

  it("handles multiple .plan.md references in one string", () => {
    const result = sanitizeTodoDisplayText(
      "Implement foo.plan.md then check bar.plan.md"
    );
    expect(result).not.toContain(".plan.md");
    expect(result).toContain("approved plan");
  });
});

describe("normalizePersistedTodo — activeForm sanitization", () => {
  it("sanitizes activeForm content through sanitizeTodoDisplayText", () => {
    const todo = normalizePersistedTodo(
      {
        id: "t1",
        content: "task",
        activeForm: "my-task.plan.md",
        status: "pending",
      },
      0
    );
    expect(todo.activeForm).toBe("Implement approved plan");
  });

  it("preserves activeForm when it contains normal text", () => {
    const todo = normalizePersistedTodo(
      { id: "t1", content: "task", activeForm: "edit form", status: "pending" },
      0
    );
    expect(todo.activeForm).toBe("edit form");
  });
});

describe("isExpectedTodoLoadRejection — extended cases", () => {
  it("treats Error instances with 'not supported' message as expected", () => {
    expect(
      isExpectedTodoLoadRejection(new Error("feature not supported"))
    ).toBe(true);
  });

  it("treats string errors with 'not a coding agent' as expected", () => {
    expect(isExpectedTodoLoadRejection("not a coding agent session")).toBe(
      true
    );
  });

  it("treats generic Error objects as unexpected", () => {
    expect(isExpectedTodoLoadRejection(new Error("network error"))).toBe(false);
  });

  it("handles non-Error, non-string values without crashing", () => {
    expect(isExpectedTodoLoadRejection(null)).toBe(false);
    expect(isExpectedTodoLoadRejection(42)).toBe(false);
    expect(isExpectedTodoLoadRejection({ code: 404 })).toBe(false);
  });
});
