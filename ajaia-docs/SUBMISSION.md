# Submission: Ajaia Docs

Candidate: Aaron Cumahig (aaroncumahig12@gmail.com)
Role: AI-Native Full Stack Product Engineer, Ajaia LLC

## Links

- **Live product URL:** PASTE LIVE URL HERE (deployment steps are in `README.md`)
- **Walkthrough video:** see `VIDEO_URL.txt`

## Test accounts

All accounts use the password `password123`. They are created automatically on first start.

| Name | Email | Role on the seeded "Welcome" document |
| --- | --- | --- |
| Alice Rivera | alice@example.com | Owner |
| Bob Chen | bob@example.com | Can edit |
| Carol Santos | carol@example.com | View only |

To review sharing: sign in as Alice and Bob in two browser profiles (or one normal and one private window). The login page has one-click buttons that fill in each account.

## What is included

| Path | Contents |
| --- | --- |
| `app/`, `components/`, `lib/` | Source code: pages, API routes, UI, data layer, access rules, import |
| `tests/` | 33 automated tests (Vitest) |
| `README.md` | Setup, run, test, and deploy instructions, plus an API summary |
| `docs/ARCHITECTURE.md` | Architecture note: priorities, data model, access model, tradeoffs, limitations |
| `docs/AI-WORKFLOW.md` | AI workflow note |
| `docs/VIDEO-SCRIPT.md` | Outline used for the walkthrough video |
| `docs/screenshots/` | Dashboard, editor, share dialog, view-only, and conflict screenshots |
| `SUBMISSION.md` | This file |
| `VIDEO_URL.txt` | Text file with the walkthrough video link |
| `package.json`, `package-lock.json`, config files | Project configuration |
| `.env.example` | Environment variables with comments |

## Status

### What is working

- Create, rename, edit, autosave, save, and reopen documents
- Rich text: bold, italic, underline, headings H1 to H3, bulleted and numbered lists, undo and redo
- Formatting survives a refresh (covered by a test and a browser check)
- File import for `.txt`, `.md`, and `.docx` up to 2 MB, with clear errors for unsupported, empty, corrupted, and oversized files
- Sharing by email with "Can view" or "Can edit"; owner can change or remove access
- Separate "My documents" and "Shared with me" lists with role badges
- View-only mode for viewers: read-only content, disabled title, no toolbar, no share button
- Access enforced on the server for every request; inaccessible documents return 404
- Stale-save protection with a visible warning, so work is never silently overwritten
- Input validation and error messages for titles, content, emails, permissions, and uploads
- Export to Markdown
- Automated tests (33 passing), a clean type check, and a passing production build

### What is incomplete or simplified

- **No real-time co-editing.** Two people can work on the same document, but the second saver is warned and must reload. Changes are not merged.
- **No sign-up, password reset, or email invites.** Accounts are seeded, and you can only share with an existing user.
- **`.docx` import keeps text and basic formatting only.** Images, tables, and comments are dropped.
- **Auth is demo-grade.** No rate limiting, and the demo password is shared.
- **HTML sanitizing is a conservative regex pass.** A maintained sanitizing library is the right production choice.
- **The live URL needs to be filled in.** Deployment steps are documented, and the app has been built and exercised locally.
- **Tested in Chromium only.**

### What I would build next with 2 to 4 more hours

1. **Version history:** a `document_versions` table written on save, with a simple list and restore.
2. **Presence indicators:** show who else has the document open, using lightweight polling.
3. **Stricter sanitizing:** replace the regex pass with DOMPurify on the server.
4. **Sharing polish:** pick people from a searchable list and show pending-access changes in open tabs.
5. **A browser test in CI:** turn the headless-browser checks into a repeatable Playwright suite.
