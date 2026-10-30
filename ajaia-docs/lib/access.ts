// Pure access rules. No I/O here so the rules are easy to test and reason about.

export type Role = "owner" | "editor" | "viewer";
export type SharePermission = "view" | "edit";

export function resolveRole(
  ownerId: string,
  userId: string,
  sharePermission: SharePermission | null,
): Role | null {
  if (ownerId === userId) return "owner";
  if (sharePermission === "edit") return "editor";
  if (sharePermission === "view") return "viewer";
  return null;
}

export function canView(role: Role | null): boolean {
  return role !== null;
}

export function canEdit(role: Role | null): boolean {
  return role === "owner" || role === "editor";
}

export function canManageSharing(role: Role | null): boolean {
  return role === "owner";
}

export function canDelete(role: Role | null): boolean {
  return role === "owner";
}
