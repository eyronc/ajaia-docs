# AI workflow note

## Tools used

- **Claude (Sonnet 5.5)** working as a coding agent with file and shell access: planning, writing code, running commands, and checking results.
- **Headless Chromium through Playwright**, driven by a script the agent wrote, for end-to-end UI checks.

No other AI tools were used.

## How I worked with it

The app was not generated in one shot. The work was split so each step could be checked before the next one built on it:

1. **Scope first.** Read the brief, listed what must work, and chose scope cuts before writing code (see the architecture note).
2. **Pure logic first.** Access rules, validation, and import conversion were written as small functions with no I/O, and tested before any UI existed.
3. **Data layer, then API.** All permission checks were placed in one module, and the routes stayed thin.
4. **UI last.** Dashboard, editor, and share dialog were built on top of an API that was already tested.
5. **Verify at every layer** (see below), then write the docs from what was actually built.

## Where AI materially sped things up

- **Boilerplate and wiring:** project scaffold, eight route handlers, login and session code, and consistent error handling.
- **Test authoring:** 33 tests, including a generated `.docx` fixture so the Word import is tested without a binary file in the repo.
- **End-to-end checks:** a scripted run of 30 live HTTP checks and 21 browser checks. Writing this by hand would have cost more time than the feature work.
- **Documentation:** first drafts of the README and architecture note from the finished code.

## What I changed or rejected

- **Removed a redundant dependency.** The first install included a separate TipTap underline extension. The current TipTap starter kit already ships underline, so keeping both would have registered the extension twice. It was uninstalled.
- **Replaced a placeholder bcrypt hash.** The first draft of the login route used a hard-coded dummy hash for timing protection. A hand-written hash string cannot be trusted to be valid, so it now generates a real one at startup.
- **Fixed type errors the first draft shipped with.** An error type in the data layer and untyped error handling in the import route were corrected after the type checker flagged them.
- **Left out on purpose as too big for the timebox:** real-time collaboration, comments, version history, and full `.docx` fidelity. Each would have added breadth while weakening the core flow.
- **Deliberately kept simple:** the HTML sanitizer is a conservative regex pass, and the architecture note says plainly that a production version should use a maintained library.

## How correctness was verified

| Layer | Check | Result |
| --- | --- | --- |
| Types | `tsc --noEmit` | Clean |
| Logic and data | Vitest against a real temporary SQLite database | 33 of 33 pass |
| API | 30 live requests against the production build: login, save and reopen, every role on every sensitive action, stale save, validation, import (valid, wrong type, empty, oversized), delete, logout | All returned the expected status |
| UI | 21 checks in headless Chromium: formatting survives a refresh, autosave status, sharing from the dialog, shared list and badges, viewer is read-only, conflict banner, UI import, Markdown export | All pass |
| Visual | Screenshots of the dashboard, editor, share dialog, viewer, and conflict state were reviewed by eye | In `docs/screenshots` |
| Build | `next build` with type and lint checks | Passes |

Two things the checks cannot prove: behavior on a real hosted deployment, and behavior in browsers other than Chromium.

## Rules followed in this build

- AI output is a draft, not a source of truth. Each layer was type-checked and tested before the next one was built on it.
- Tests target real failure cases (a stale save is rejected, a viewer cannot edit, a stranger gets 404) and not only happy paths.
- When the AI's code and the type checker disagreed, the type checker won.
