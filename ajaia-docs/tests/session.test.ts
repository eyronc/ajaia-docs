import { describe, expect, it, vi } from "vitest";

// lib/auth imports next/headers, which only exists inside a Next.js request.
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
// lib/auth also imports the repo, which is not needed for token tests.
vi.mock("@/lib/repo", () => ({ findUserById: async () => null }));

import { createSessionToken, readSessionToken } from "@/lib/auth";

describe("session tokens", () => {
  it("round-trips a user id", () => {
    const token = createSessionToken("user-123");
    expect(readSessionToken(token)).toBe("user-123");
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken("user-123");
    const forged = token.replace("user-123", "user-999");
    expect(readSessionToken(forged)).toBeNull();
  });

  it("rejects an expired token", () => {
    const longAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const token = createSessionToken("user-123", longAgo);
    expect(readSessionToken(token)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(readSessionToken("")).toBeNull();
    expect(readSessionToken("a.b")).toBeNull();
    expect(readSessionToken("a.b.c.d")).toBeNull();
  });
});
