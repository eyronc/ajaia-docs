import { createClient, type Client } from "@libsql/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

declare global {
  // Cached on globalThis so Next.js dev reloads do not open many connections.
  var __ajaiaDb: Promise<Client> | undefined;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS document_shares (
    document_id TEXT NOT NULL REFERENCES documents(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (document_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id)`,
];

export const DEMO_PASSWORD = "password123";

export const DEMO_USERS = [
  { email: "alice@example.com", name: "Alice Rivera" },
  { email: "bob@example.com", name: "Bob Chen" },
  { email: "carol@example.com", name: "Carol Santos" },
];

const WELCOME_CONTENT = `<h1>Welcome to Ajaia Docs</h1>
<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob</strong> (can edit) and <strong>Carol</strong> (can view).</p>
<h2>Try these</h2>
<ul><li>Use the toolbar for <strong>bold</strong>, <em>italic</em>, <u>underline</u>, headings, and lists.</li><li>Sign in as Bob and edit this page. Sign in as Carol and notice it is read only.</li><li>Import a .txt, .md, or .docx file from the dashboard.</li></ul>
<ol><li>Changes save automatically.</li><li>Refresh the page and everything is still here.</li></ol>`;

async function seedIfEmpty(client: Client): Promise<void> {
  const existing = await client.execute("SELECT COUNT(*) AS total FROM users");
  if (Number(existing.rows[0].total) > 0) return;

  const now = Date.now();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = DEMO_USERS.map(() => randomUUID());
  const welcomeId = randomUUID();

  await client.batch(
    [
      ...DEMO_USERS.map((user, index) => ({
        sql: "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [userIds[index], user.email, user.name, passwordHash, now],
      })),
      {
        sql: "INSERT INTO documents (id, owner_id, title, content, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
        args: [welcomeId, userIds[0], "Welcome to Ajaia Docs", WELCOME_CONTENT, now, now],
      },
      {
        sql: "INSERT INTO document_shares (document_id, user_id, permission, created_at) VALUES (?, ?, 'edit', ?)",
        args: [welcomeId, userIds[1], now],
      },
      {
        sql: "INSERT INTO document_shares (document_id, user_id, permission, created_at) VALUES (?, ?, 'view', ?)",
        args: [welcomeId, userIds[2], now],
      },
    ],
    "write",
  );
}

async function initialize(): Promise<Client> {
  const url = process.env.DATABASE_URL ?? "file:data/app.db";

  if (url.startsWith("file:") && !url.includes(":memory:")) {
    const filePath = url.slice("file:".length);
    mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }

  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  await client.batch(SCHEMA, "write");
  await seedIfEmpty(client);
  return client;
}

export function getDb(): Promise<Client> {
  if (!globalThis.__ajaiaDb) {
    globalThis.__ajaiaDb = initialize();
  }
  return globalThis.__ajaiaDb;
}
