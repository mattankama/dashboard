import { describe, expect, it } from "vitest";
import { validateNewItem } from "../src/validate";

describe("validateNewItem", () => {
  it("accepts text alone, with no category and not pinned", () => {
    expect(validateNewItem({ text: "Call Grandma" })).toEqual({
      ok: true,
      value: { text: "Call Grandma", category: null, pinned: false },
    });
  });

  it("trims text but keeps internal newlines", () => {
    const result = validateNewItem({ text: "  line one\nline two \n" });
    expect(result).toEqual({ ok: true, value: { text: "line one\nline two", category: null, pinned: false } });
  });

  it("rejects missing text", () => {
    expect(validateNewItem({})).toEqual({ ok: false, message: "text is required" });
  });

  it("rejects text that is only whitespace", () => {
    expect(validateNewItem({ text: " \n\t " })).toEqual({ ok: false, message: "text is required" });
  });

  it("rejects text that isn't a string", () => {
    expect(validateNewItem({ text: 42 })).toEqual({ ok: false, message: "text must be a string" });
  });

  it("accepts exactly 500 characters, counting an emoji as one", () => {
    const text = "🙂".repeat(500);
    expect(validateNewItem({ text }).ok).toBe(true);
  });

  it("rejects 501 characters", () => {
    expect(validateNewItem({ text: "a".repeat(501) })).toEqual({
      ok: false,
      message: "text must be at most 500 characters",
    });
  });

  it("trims the category", () => {
    const result = validateNewItem({ text: "x", category: "  School " });
    expect(result.ok && result.value.category).toBe("School");
  });

  it("treats an empty or null category as none", () => {
    for (const category of ["", "   ", null]) {
      const result = validateNewItem({ text: "x", category });
      expect(result.ok && result.value.category).toBeNull();
    }
  });

  it("rejects a category over 40 characters", () => {
    expect(validateNewItem({ text: "x", category: "c".repeat(41) })).toEqual({
      ok: false,
      message: "category must be at most 40 characters",
    });
  });

  it("rejects a category that isn't a string", () => {
    expect(validateNewItem({ text: "x", category: 3 })).toEqual({
      ok: false,
      message: "category must be a string or null",
    });
  });

  it("accepts pinned: true", () => {
    const result = validateNewItem({ text: "x", pinned: true });
    expect(result.ok && result.value.pinned).toBe(true);
  });

  it("rejects a pinned value that isn't a boolean", () => {
    expect(validateNewItem({ text: "x", pinned: 1 })).toEqual({ ok: false, message: "pinned must be true or false" });
  });

  it("rejects unknown fields", () => {
    expect(validateNewItem({ text: "x", pined: true })).toEqual({ ok: false, message: "Unknown field: pined" });
  });

  it("rejects a body that isn't an object", () => {
    for (const body of [null, [], "text", 5]) {
      expect(validateNewItem(body)).toEqual({ ok: false, message: "Body must be a JSON object" });
    }
  });
});
