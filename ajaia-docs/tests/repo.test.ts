import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Each run uses its own temporary SQLite file, seeded automatically on first use.
const tempDir = mkdtempSync(path.join(tmpdir(), "ajaia-test-"));
process.env.DATABASE_URL = `file:${path.join(tempDir, "test.db")}`;

import {
  addShare,
  createDocument,
  deleteDocument,
  findUserByEmail,
  getDocumentForUser,
  listDocumentsForUser,
  listShares,
  removeShare,
  updateDocument,
} from "@/lib/repo";

let aliceId = "";
let bobId = "";
let carolId = "";

beforeAll(async () => {
  aliceId = (await findUserByEmail("alice@example.com"))!.id;
  bobId = (await findUserByEmail("bob@example.com"))!.id;
  carolId = (await findUserByEmail("carol@example.com"))!.id;
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("seed data", () => {
  it("creates demo users and a shared welcome document", async () => {
    const bobDocs = await listDocumentsForUser(bobId);
    const welcome = bobDocs.find((doc) => doc.title === "Welcome to Ajaia Docs");
    expect(welcome?.role).toBe("editor");

    const carolDocs = await listDocumentsForUser(carolId);
    expect(carolDocs.find((doc) => doc.title === "Welcome to Ajaia Docs")?.role).toBe("viewer");
  });
});

describe("sharing and access", () => {
  it("hides a private document from other users", async () => {
    const { id } = await createDocument(aliceId, "Private plan", "<p>secret</p>");

    expect(await getDocumentForUser(id, aliceId)).not.toBeNull();
    expect(await getDocumentForUser(id, bobId)).toBeNull();
    expect((await listDocumentsForUser(bobId)).some((doc) => doc.id === id)).toBe(false);
  });

  it("lets a viewer read but not edit", async () => {
    const { id } = await createDocument(aliceId, "Read only share");
    const shared = await addShare(id, aliceId, "carol@example.com", "view");
    expect(shared.ok).toBe(true);

    const carolView = await getDocumentForUser(id, carolId);
    expect(carolView?.role).toBe("viewer");

    const attempt = await updateDocument(id, carolId, { content: "<p>hacked</p>" }, 1);
    expect(attempt).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("lets an editor change content and rename, but not manage sharing or delete", async () => {
    const { id } = await createDocument(aliceId, "Team doc");
    await addShare(id, aliceId, "bob@example.com", "edit");

    const edit = await updateDocument(id, bobId, { title: "Renamed", content: "<p>hi</p>" }, 1);
    expect(edit).toMatchObject({ ok: true, version: 2 });

    const saved = await getDocumentForUser(id, aliceId);
    expect(saved).toMatchObject({ title: "Renamed", content: "<p>hi</p>", version: 2 });

    expect(await addShare(id, bobId, "carol@example.com", "view")).toMatchObject({
      ok: false,
      error: "forbidden",
    });
    expect(await deleteDocument(id, bobId)).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("updates an existing share instead of duplicating it", async () => {
    const { id } = await createDocument(aliceId, "Upgrade me");
    await addShare(id, aliceId, "bob@example.com", "view");
    await addShare(id, aliceId, "bob@example.com", "edit");

    const listed = await listShares(id, aliceId);
    expect(listed.ok && listed.shares).toHaveLength(1);
    expect(listed.ok && listed.shares[0].permission).toBe("edit");
  });

  it("revokes access when a share is removed", async () => {
    const { id } = await createDocument(aliceId, "Revoke me");
    await addShare(id, aliceId, "bob@example.com", "edit");
    expect(await getDocumentForUser(id, bobId)).not.toBeNull();

    await removeShare(id, aliceId, bobId);
    expect(await getDocumentForUser(id, bobId)).toBeNull();
  });

  it("rejects unknown emails and sharing with yourself", async () => {
    const { id } = await createDocument(aliceId, "Edge cases");
    expect(await addShare(id, aliceId, "nobody@example.com", "view")).toMatchObject({
      ok: false,
      error: "user_not_found",
    });
    expect(await addShare(id, aliceId, "alice@example.com", "view")).toMatchObject({
      ok: false,
      error: "invalid",
    });
  });

  it("deletes a document and its shares together", async () => {
    const { id } = await createDocument(aliceId, "Delete me");
    await addShare(id, aliceId, "bob@example.com", "view");

    expect(await deleteDocument(id, aliceId)).toMatchObject({ ok: true });
    expect(await getDocumentForUser(id, aliceId)).toBeNull();
    expect(await getDocumentForUser(id, bobId)).toBeNull();
  });
});

describe("saving", () => {
  it("rejects a stale save instead of overwriting newer work", async () => {
    const { id } = await createDocument(aliceId, "Conflict doc");
    await addShare(id, aliceId, "bob@example.com", "edit");

    // Both people open version 1. Bob saves first.
    expect(await updateDocument(id, bobId, { content: "<p>bob</p>" }, 1)).toMatchObject({
      ok: true,
    });
    // Alice still thinks it is version 1.
    expect(await updateDocument(id, aliceId, { content: "<p>alice</p>" }, 1)).toMatchObject({
      ok: false,
      error: "conflict",
    });

    const latest = await getDocumentForUser(id, aliceId);
    expect(latest?.content).toBe("<p>bob</p>");
  });

  it("validates title and content", async () => {
    const { id } = await createDocument(aliceId, "Validation doc");

    expect(await updateDocument(id, aliceId, { title: "   " }, 1)).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(await updateDocument(id, aliceId, { title: "x".repeat(201) }, 1)).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(await updateDocument(id, aliceId, { content: 42 }, 1)).toMatchObject({
      ok: false,
      error: "invalid",
    });
    expect(await updateDocument(id, aliceId, {}, 1)).toMatchObject({ ok: false, error: "invalid" });
  });

  it("preserves formatting markup exactly", async () => {
    const { id } = await createDocument(aliceId, "Formatting doc");
    const html =
      "<h2>Heading</h2><p><strong>bold</strong> <em>italic</em> <u>underline</u></p><ul><li>one</li></ul><ol><li>two</li></ol>";
    await updateDocument(id, aliceId, { content: html }, 1);

    const reopened = await getDocumentForUser(id, aliceId);
    expect(reopened?.content).toBe(html);
  });
});
