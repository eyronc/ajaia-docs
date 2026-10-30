import { randomUUID } from "node:crypto";
import type { Row } from "@libsql/client";
import {
  canDelete,
  canEdit,
  canManageSharing,
  resolveRole,
  type Role,
  type SharePermission,
} from "./access";
import { getDb } from "./db";
import { validateContent, validateTitle } from "./validation";

export type User = { id: string; email: string; name: string };

export type DocumentSummary = {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  role: Role;
  updatedAt: number;
};

export type DocumentDetail = DocumentSummary & {
  content: string;
  version: number;
};

export type ShareEntry = {
  userId: string;
  email: string;
  name: string;
  permission: SharePermission;
};

export type Failure = "not_found" | "forbidden" | "conflict" | "invalid" | "user_not_found";
export type Result<T> = ({ ok: true } & T) | { ok: false; error: Failure; message: string };

function fail(error: Failure, message: string): { ok: false; error: Failure; message: string } {
  return { ok: false, error, message };
}

// ---------- users ----------

export async function findUserByEmail(
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, email, name, password_hash FROM users WHERE email = ?",
    args: [email.trim().toLowerCase()],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    passwordHash: String(row.password_hash),
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, email, name FROM users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return { id: String(row.id), email: String(row.email), name: String(row.name) };
}

// ---------- documents ----------

function toSummary(row: Row, role: Role): DocumentSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name),
    role,
    updatedAt: Number(row.updated_at),
  };
}

export async function createDocument(
  ownerId: string,
  title: string,
  content = "",
): Promise<{ id: string }> {
  const db = await getDb();
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: "INSERT INTO documents (id, owner_id, title, content, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    args: [id, ownerId, title, content, now, now],
  });
  return { id };
}

export async function listDocumentsForUser(userId: string): Promise<DocumentSummary[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT d.id, d.title, d.owner_id, u.name AS owner_name, d.updated_at, NULL AS permission
          FROM documents d JOIN users u ON u.id = d.owner_id
          WHERE d.owner_id = ?
          UNION ALL
          SELECT d.id, d.title, d.owner_id, u.name AS owner_name, d.updated_at, s.permission
          FROM documents d
          JOIN users u ON u.id = d.owner_id
          JOIN document_shares s ON s.document_id = d.id
          WHERE s.user_id = ?
          ORDER BY updated_at DESC`,
    args: [userId, userId],
  });

  const summaries: DocumentSummary[] = [];
  for (const row of result.rows) {
    const permission = row.permission === null ? null : (String(row.permission) as SharePermission);
    const role = resolveRole(String(row.owner_id), userId, permission);
    if (role) summaries.push(toSummary(row, role));
  }
  return summaries;
}

// Returns null for both "does not exist" and "no access" so the API never
// reveals whether a document ID belongs to someone else.
export async function getDocumentForUser(
  documentId: string,
  userId: string,
): Promise<DocumentDetail | null> {
  const db = await getDb();
  const docResult = await db.execute({
    sql: `SELECT d.id, d.title, d.content, d.version, d.owner_id, u.name AS owner_name, d.updated_at
          FROM documents d JOIN users u ON u.id = d.owner_id
          WHERE d.id = ?`,
    args: [documentId],
  });
  const row = docResult.rows[0];
  if (!row) return null;

  const shareResult = await db.execute({
    sql: "SELECT permission FROM document_shares WHERE document_id = ? AND user_id = ?",
    args: [documentId, userId],
  });
  const permission = shareResult.rows[0]
    ? (String(shareResult.rows[0].permission) as SharePermission)
    : null;

  const role = resolveRole(String(row.owner_id), userId, permission);
  if (!role) return null;

  return {
    ...toSummary(row, role),
    content: String(row.content),
    version: Number(row.version),
  };
}

export type DocumentPatch = { title?: unknown; content?: unknown };

export async function updateDocument(
  documentId: string,
  userId: string,
  patch: DocumentPatch,
  expectedVersion: number,
): Promise<Result<{ version: number; updatedAt: number }>> {
  const doc = await getDocumentForUser(documentId, userId);
  if (!doc) return fail("not_found", "Document not found.");
  if (!canEdit(doc.role)) return fail("forbidden", "You have view-only access to this document.");

  const assignments: string[] = [];
  const args: (string | number)[] = [];

  if (patch.title !== undefined) {
    const title = validateTitle(patch.title);
    if (!title.ok) return fail("invalid", title.message);
    assignments.push("title = ?");
    args.push(title.value);
  }
  if (patch.content !== undefined) {
    const content = validateContent(patch.content);
    if (!content.ok) return fail("invalid", content.message);
    assignments.push("content = ?");
    args.push(content.value);
  }
  if (assignments.length === 0) return fail("invalid", "Nothing to update.");

  const now = Date.now();
  const db = await getDb();
  // The version check makes the write atomic: if someone saved in between,
  // zero rows match and we report a conflict instead of overwriting their work.
  const result = await db.execute({
    sql: `UPDATE documents SET ${assignments.join(", ")}, version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?`,
    args: [...args, now, documentId, expectedVersion],
  });

  if (result.rowsAffected === 0) {
    return fail("conflict", "This document was changed by someone else. Reload to get the latest version.");
  }
  return { ok: true, version: expectedVersion + 1, updatedAt: now };
}

export async function deleteDocument(
  documentId: string,
  userId: string,
): Promise<Result<object>> {
  const doc = await getDocumentForUser(documentId, userId);
  if (!doc) return fail("not_found", "Document not found.");
  if (!canDelete(doc.role)) return fail("forbidden", "Only the owner can delete a document.");

  const db = await getDb();
  await db.batch(
    [
      { sql: "DELETE FROM document_shares WHERE document_id = ?", args: [documentId] },
      { sql: "DELETE FROM documents WHERE id = ?", args: [documentId] },
    ],
    "write",
  );
  return { ok: true };
}

// ---------- sharing ----------

export async function listShares(
  documentId: string,
  requesterId: string,
): Promise<Result<{ shares: ShareEntry[] }>> {
  const doc = await getDocumentForUser(documentId, requesterId);
  if (!doc) return fail("not_found", "Document not found.");
  if (!canManageSharing(doc.role)) return fail("forbidden", "Only the owner can manage sharing.");

  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT s.user_id, u.email, u.name, s.permission
          FROM document_shares s JOIN users u ON u.id = s.user_id
          WHERE s.document_id = ?
          ORDER BY u.name`,
    args: [documentId],
  });
  return {
    ok: true,
    shares: result.rows.map((row) => ({
      userId: String(row.user_id),
      email: String(row.email),
      name: String(row.name),
      permission: String(row.permission) as SharePermission,
    })),
  };
}

export async function addShare(
  documentId: string,
  requesterId: string,
  targetEmail: string,
  permission: SharePermission,
): Promise<Result<{ share: ShareEntry }>> {
  const doc = await getDocumentForUser(documentId, requesterId);
  if (!doc) return fail("not_found", "Document not found.");
  if (!canManageSharing(doc.role)) return fail("forbidden", "Only the owner can manage sharing.");

  const target = await findUserByEmail(targetEmail);
  if (!target) return fail("user_not_found", "No user with that email address.");
  if (target.id === requesterId) return fail("invalid", "You already own this document.");

  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO document_shares (document_id, user_id, permission, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (document_id, user_id) DO UPDATE SET permission = excluded.permission`,
    args: [documentId, target.id, permission, Date.now()],
  });

  return {
    ok: true,
    share: { userId: target.id, email: target.email, name: target.name, permission },
  };
}

export async function removeShare(
  documentId: string,
  requesterId: string,
  targetUserId: string,
): Promise<Result<object>> {
  const doc = await getDocumentForUser(documentId, requesterId);
  if (!doc) return fail("not_found", "Document not found.");
  if (!canManageSharing(doc.role)) return fail("forbidden", "Only the owner can manage sharing.");

  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM document_shares WHERE document_id = ? AND user_id = ?",
    args: [documentId, targetUserId],
  });
  return { ok: true };
}
