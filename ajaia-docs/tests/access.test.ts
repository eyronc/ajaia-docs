import { describe, expect, it } from "vitest";
import {
  canDelete,
  canEdit,
  canManageSharing,
  canView,
  resolveRole,
} from "@/lib/access";

describe("resolveRole", () => {
  it("makes the owner an owner regardless of shares", () => {
    expect(resolveRole("u1", "u1", null)).toBe("owner");
    expect(resolveRole("u1", "u1", "view")).toBe("owner");
  });

  it("maps share permissions to roles", () => {
    expect(resolveRole("u1", "u2", "edit")).toBe("editor");
    expect(resolveRole("u1", "u2", "view")).toBe("viewer");
  });

  it("gives no role to someone without a share", () => {
    expect(resolveRole("u1", "u2", null)).toBeNull();
  });
});

describe("permissions", () => {
  it("lets every role with access view", () => {
    expect(canView("owner")).toBe(true);
    expect(canView("editor")).toBe(true);
    expect(canView("viewer")).toBe(true);
    expect(canView(null)).toBe(false);
  });

  it("lets only owners and editors edit", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });

  it("keeps sharing and deleting owner-only", () => {
    expect(canManageSharing("owner")).toBe(true);
    expect(canManageSharing("editor")).toBe(false);
    expect(canManageSharing("viewer")).toBe(false);
    expect(canDelete("owner")).toBe(true);
    expect(canDelete("editor")).toBe(false);
  });
});
