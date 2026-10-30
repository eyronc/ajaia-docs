# Ajaia Docs

A lightweight collaborative document editor inspired by Google Docs. Built as a take-home for the Ajaia Full Stack Product Engineer role.

Users can create and edit rich-text documents, import files, and share documents with other people. Owned and shared documents are shown separately, and access is enforced on the server.

## Features

- **Create, rename, edit, save, reopen** documents in the browser
- **Rich text:** bold, italic, underline, headings (H1 to H3), bulleted and numbered lists, undo and redo
- **Autosave** after you stop typing, with a visible save status
- **File import:** upload a `.txt`, `.md`, or `.docx` file (up to 2 MB) and it becomes a new editable document
- **Sharing:** the owner shares by email with "Can view" or "Can edit", and can change or remove access
- **Owned vs shared:** the dashboard has "My documents" and "Shared with me" lists with role badges
- **View-only mode:** viewers see a read-only document with no toolbar
- **Stale save protection:** if someone else saved first, your save is rejected and you see a warning instead of silently overwriting their work
- **Export to Markdown** (small extra)

## Tech stack

| Area | Choice |
| --- | --- |
| App | Next.js 15 (App Router) and TypeScript |
| Editor | TipTap (ProseMirror) |
| Database | SQLite through libSQL (`@libsql/client`) |
| Auth | Email and password, signed HTTP-only session cookie |
| Import | `marked` (Markdown), `mammoth` (.docx) |
| Tests | Vitest |

Everything is free to run. Local development uses a SQLite file. A hosted deployment uses a free Turso database, which speaks the same libSQL protocol, so the code does not change.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No other setup is needed. The database file is created at `data/app.db` and seeded on first start.

### Demo accounts

All accounts use the password `password123`.

| User | Email | Role on the seeded "Welcome" document |
| --- | --- | --- |
| Alice Rivera | alice@example.com | Owner |
| Bob Chen | bob@example.com | Can edit |
| Carol Santos | carol@example.com | View only |

The login page has buttons that fill these in for you.

### Try the sharing flow

1. Sign in as **Alice** and open "Welcome to Ajaia Docs". Click **Share** to see who has access.
2. Open a second browser profile or a private window and sign in as **Bob**. The document is under "Shared with me" with a "Can edit" badge. Edit it.
3. Sign in as **Carol**. The same document is read-only.
4. As Alice, create a new document and share it with Carol as "Can edit". It appears in Carol's list.

### Tests and checks

```bash
npm test          # 33 automated tests
npm run typecheck # TypeScript
```

The tests cover access rules, sharing and permission behavior against a real temporary SQLite database, stale-save conflicts, formatting round-trips, file import for all three types (including a generated .docx), input validation, HTML sanitizing, and session tokens.

### Production build

```bash
cp .env.example .env.local   # then set SESSION_SECRET to a random string
npm run build
npm start
```

`SESSION_SECRET` is required in production. The app refuses to start sessions without it.

## Deploy (Vercel and Turso, both free)

A local SQLite file does not persist on serverless hosting, so a hosted deployment needs a libSQL database.

1. Create a free database at https://turso.tech. With the CLI:
   ```bash
   turso db create ajaia-docs
   turso db show ajaia-docs --url          # DATABASE_URL
   turso db tokens create ajaia-docs       # DATABASE_AUTH_TOKEN
   ```
2. Push this project to a Git repository and import it in Vercel (or run `npx vercel`).
3. Add these environment variables in Vercel:
   - `DATABASE_URL` (the `libsql://...` URL)
   - `DATABASE_AUTH_TOKEN`
   - `SESSION_SECRET` (for example, the output of `openssl rand -hex 32`)
4. Deploy. Tables and the demo accounts are created automatically on the first request.

## Supported file types

Import accepts `.txt`, `.md`, and `.docx`, up to 2 MB. The same limits are shown in the dashboard. Other types and oversized or corrupted files are rejected with a clear message.

| Type | How it becomes a document |
| --- | --- |
| `.txt` | Blank lines start new paragraphs |
| `.md` | Headings, lists, bold, and italic are kept |
| `.docx` | Text, headings, lists, bold, italic, and underline are kept. Images, tables, and comments are not. |

## API summary

All routes except login require a signed-in session. Documents you cannot access return 404, the same as documents that do not exist.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Session |
| `GET /api/documents` | List owned and shared documents |
| `POST /api/documents` | Create a document |
| `GET, PATCH, DELETE /api/documents/:id` | Read, save (needs `version`), delete (owner only) |
| `GET, POST, DELETE /api/documents/:id/shares` | List, add or update, remove access (owner only) |
| `POST /api/documents/import` | Upload a file as a new document |

## Project layout

```
app/            Pages and API route handlers
components/     Dashboard, Editor, ShareDialog, LoginForm
lib/access.ts   Pure access rules (owner, editor, viewer)
lib/repo.ts     All database reads and writes, with permission checks
lib/db.ts       Schema, connection, and seed data
lib/import.ts   File to HTML conversion
lib/auth.ts     Signed session cookies
tests/          Vitest tests
docs/           Architecture note, AI workflow note, video script, screenshots
```

## More documents

- [Architecture note](docs/ARCHITECTURE.md)
- [AI workflow note](docs/AI-WORKFLOW.md)
- [Submission contents, status, and next steps](SUBMISSION.md)
