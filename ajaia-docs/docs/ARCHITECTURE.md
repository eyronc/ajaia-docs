# Architecture note

## What I prioritized and why

The prompt is open ended, so I picked a slice that is small but complete from the browser to the database:

1. **Editing that feels right.** A real rich-text editor (TipTap) with autosave and a visible save status. This is the heart of the product, so it got the most polish.
2. **Access control that is actually enforced.** Sharing is only meaningful if the server checks it. Every read and write goes through one data layer that resolves the caller's role first.
3. **A file import that fits the workflow.** Uploading a file turns it into an editable document. This is useful on day one and easy to explain.
4. **Something reviewers can run and trust.** One command to start, seeded users, tests, and a free deployment path.

Everything else was cut on purpose (see "Scope cuts").

## System overview

```
Browser (React, TipTap)
   |  fetch JSON / multipart
   v
Next.js route handlers  (app/api/**)
   |  validate input, require session
   v
lib/repo.ts   <-- every permission check lives here
   |            uses lib/access.ts (pure rules)
   v
libSQL client --> SQLite file (local) or Turso (hosted)
```

Pages for the dashboard and editor are server components that load data directly from `lib/repo.ts`, then hand it to client components. The editor then talks to the JSON API.

## Data model

```
users            id, email (unique), name, password_hash, created_at
documents        id, owner_id -> users, title, content (HTML), version, created_at, updated_at
document_shares  (document_id, user_id) primary key, permission ('view' | 'edit'), created_at
```

- `content` is the editor's HTML. It keeps bold, italic, underline, headings, and lists exactly (a test checks the round trip).
- `version` is an integer that goes up by one on every save. It is used for stale-save protection.
- One row per person per document in `document_shares`. Sharing again updates the permission instead of adding a duplicate.

## Access model

There are three roles, resolved in `lib/access.ts`:

| Role | How you get it | View | Edit and rename | Share | Delete |
| --- | --- | --- | --- | --- | --- |
| Owner | You created or imported it | Yes | Yes | Yes | Yes |
| Editor | Shared with "Can edit" | Yes | Yes | No | No |
| Viewer | Shared with "Can view" | Yes | No | No | No |

Decisions worth calling out:

- The rules are pure functions with no I/O, so they are trivial to test.
- The UI hides what you cannot do, but the **server is the source of truth**. Hiding a button is not security, so each API call re-checks the role.
- A document you cannot access returns **404, not 403**. This avoids revealing whether someone else's document ID exists.

## Saving and conflicts

- The editor debounces changes (800 ms) and sends a `PATCH` with the new content and the `version` it last saw.
- The server runs `UPDATE ... WHERE id = ? AND version = ?`. If nobody else saved, one row changes and the version increments. If someone else saved first, zero rows change and the server returns **409**.
- On a 409 the editor stops autosaving and shows a clear warning, so work is never silently overwritten. The user can copy their text and reload.
- Network failures keep the unsaved changes and retry every 3 seconds. Other 4xx errors (for example, access was removed) show the server's message.
- Leaving the page with unsaved changes triggers the browser warning, and a save is attempted when the tab is hidden.

## File import

`lib/import.ts` converts uploads to HTML on the server:

- `.txt`: paragraphs split on blank lines, with HTML escaped
- `.md`: `marked`
- `.docx`: `mammoth`

Limits are enforced twice: file size is checked from the request before reading the file, and again on the bytes. Imported HTML passes through a small sanitizer, and the editor's schema drops anything it does not understand when it loads the content.

## Authentication

The brief allows simulated users, so I used seeded accounts with a real login flow: bcrypt-hashed passwords, and a signed, HTTP-only, SameSite=Lax session cookie (HMAC-SHA256, 7-day expiry, constant-time comparison). Login always does a password comparison, even for unknown emails, so response time does not reveal which emails exist.

This is demo-grade, not production auth. See "Known limitations".

## Scope cuts (on purpose)

| Cut | Why |
| --- | --- |
| Real-time multi-user editing | Needs a CRDT or operational transform and a websocket layer. Doing it badly is worse than not doing it. Stale-save protection covers the failure case honestly. |
| Comments and suggestions | Separate product surface. Depth in editing and sharing mattered more. |
| Version history | A natural next step. The `version` column and a history table would be the base. |
| Sign-up, password reset, email invites | The brief allows seeded users. Sharing is by email of an existing user. |
| Rich `.docx` fidelity (images, tables) | Text, headings, lists, and basic styles cover the common case. |
| Page layout and printing | Not part of the core editing flow. |

## Tradeoffs

- **HTML in a text column vs. JSON documents.** HTML is simple, portable, and easy to import into. JSON would be stricter. For this scope HTML wins, and the editor schema acts as the real parser.
- **SQLite/libSQL vs. Postgres.** One codebase runs on a local file with zero setup and on free hosted Turso. A Postgres setup would add reviewer friction.
- **Permission checks in the data layer vs. database policies.** Checks in `lib/repo.ts` keep the logic in one readable place and work with SQLite. Row-level security would be the next hardening step on Postgres.
- **Optimistic version check vs. locking.** No locks, no extra infrastructure, and a clear user message on conflict.

## Known limitations

- No rate limiting or lockout on login. All demo users share one documented password.
- The HTML sanitizer is regex based and intentionally conservative. A production version should use a maintained library such as DOMPurify on the server.
- Conflicts are detected, not merged. The second person to save has to reload and re-apply their edits.
- A removed share takes effect on the next request, but an open editor tab only finds out when it next saves.
- Seed accounts and a public password exist so reviewers can test sharing. They should not exist in a real deployment.

## Deployment

The app is a standard Next.js build. A hosted deployment needs three environment variables: `DATABASE_URL` and `DATABASE_AUTH_TOKEN` for a free Turso database, and `SESSION_SECRET`. Tables and demo data are created automatically on first use, so there is no separate migration step to forget. Step-by-step instructions are in the README.
