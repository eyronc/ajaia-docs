# Walkthrough video script (target 4 minutes)

Record with Loom or similar. Keep two browser profiles ready: one signed in as Alice, one as Bob. Open the live URL.

## 0:00 to 0:20 Intro
"This is Ajaia Docs, a lightweight collaborative document editor. I built it with Next.js, TipTap, and SQLite through libSQL. I'll show the main flow, what I cut on purpose, and how I used AI."

## 0:20 to 1:30 Main flow: create and edit
- Sign in as Alice. Point out the demo account buttons.
- Click **New document**. Rename it.
- Type a heading, then bold, italic, underline, a bulleted list, and a numbered list.
- Point at the save status going from "Saving..." to "All changes saved".
- Refresh the page. Everything is still there, formatting included.

## 1:30 to 2:15 File import
- Back on the dashboard, click **Import file**. Mention the limits shown next to it: .txt, .md, .docx, 2 MB.
- Import a Markdown file. It opens as an editable document with headings and lists intact.
- Optional: show an unsupported file being rejected with a clear message.

## 2:15 to 3:15 Sharing
- As Alice, open a document and click **Share**. Share with Bob as "Can edit".
- Switch to Bob's window. Show the document under **Shared with me** with a "Can edit" badge. Edit it.
- Share another document with Carol as "Can view". Show that her view is read-only, with no toolbar.
- Mention: the server checks access on every request. A document you cannot access returns 404.

## 3:15 to 3:40 Stale-save protection
- Have Alice and Bob both open the same document. Bob saves. Alice types.
- Show Alice's warning banner instead of silently overwriting Bob's work.

## 3:40 to 4:20 Decisions, cuts, and AI
- **Cut on purpose:** real-time co-editing, comments, version history, sign-up and email invites, full .docx fidelity. "I chose depth in editing and sharing over breadth."
- **Key decisions:** access rules as pure functions; every check in one data layer; version column for conflict detection; one codebase for local SQLite and hosted Turso.
- **AI:** "I used Claude as a coding agent. It sped up scaffolding, tests, and end-to-end checks. The type checker caught errors in the first draft and they were fixed, and I verified with 33 tests, live API checks, and browser checks." Add anything you personally reviewed or changed.
- **Next with 2 to 4 more hours:** version history, a real-time presence indicator, and a stricter HTML sanitizer.

## Tips
- Say the numbers once: 33 tests, 3 roles, 3 import types.
- Keep your cursor still when you are talking and move it only when you act.
