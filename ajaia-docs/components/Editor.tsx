"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { canEdit, canManageSharing } from "@/lib/access";
import type { DocumentDetail, User } from "@/lib/repo";
import ShareDialog from "./ShareDialog";

type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";
type Patch = { title?: string; content?: string };

const ROLE_LABEL = { owner: "Owner", editor: "Can edit", viewer: "View only" } as const;

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "All changes saved",
  unsaved: "Unsaved changes",
  saving: "Saving...",
  error: "Could not save",
  conflict: "Not saved: out of date",
};

function hasChanges(patch: Patch): boolean {
  return patch.title !== undefined || patch.content !== undefined;
}

export default function Editor({ document: doc, user }: { document: DocumentDetail; user: User }) {
  const editable = canEdit(doc.role);
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const versionRef = useRef(doc.version);
  const lastTitleRef = useRef(doc.title);
  const pendingRef = useRef<Patch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const conflictRef = useRef(false);

  // Sends whatever has changed since the last save. If more edits arrive while a
  // request is in flight, they are sent right after it finishes.
  const flush = useCallback(
    async function run(): Promise<void> {
      if (savingRef.current || conflictRef.current) return;
      const patch = pendingRef.current;
      if (!hasChanges(patch)) return;

      pendingRef.current = {};
      savingRef.current = true;
      setStatus("saving");

      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, version: versionRef.current }),
      }).catch(() => null);
      savingRef.current = false;

      if (response && response.ok) {
        const data = await response.json();
        versionRef.current = data.version;
        setErrorText(null);
        if (hasChanges(pendingRef.current)) {
          await run();
        } else {
          setStatus("saved");
        }
        return;
      }

      if (response && response.status === 409) {
        conflictRef.current = true;
        setStatus("conflict");
        return;
      }

      if (response && response.status >= 400 && response.status < 500) {
        // Retrying will not help (for example, access was removed).
        const data = await response.json().catch(() => ({}));
        setErrorText(data.error ?? "Could not save your changes.");
        setStatus("error");
        return;
      }

      // Network failure or server error: keep the changes and try again.
      pendingRef.current = { ...patch, ...pendingRef.current };
      setErrorText("Could not reach the server. Retrying...");
      setStatus("error");
      timerRef.current = setTimeout(() => void run(), 3000);
    },
    [doc.id],
  );

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus((current) => (current === "conflict" ? current : "unsaved"));
    timerRef.current = setTimeout(() => void flush(), 800);
  }, [flush]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: doc.content,
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose", "aria-label": "Document body" } },
    onUpdate: ({ editor: instance }) => {
      pendingRef.current.content = instance.getHTML();
      scheduleSave();
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            underline: instance.isActive("underline"),
            paragraph: instance.isActive("paragraph"),
            h1: instance.isActive("heading", { level: 1 }),
            h2: instance.isActive("heading", { level: 2 }),
            h3: instance.isActive("heading", { level: 3 }),
            bullet: instance.isActive("bulletList"),
            ordered: instance.isActive("orderedList"),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo(),
          }
        : null,
  });

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (savingRef.current || hasChanges(pendingRef.current)) event.preventDefault();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") void flush();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flush]);

  function changeTitle(value: string) {
    setTitle(value);
    // An empty title is not saved. It snaps back to the last good title on blur.
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    lastTitleRef.current = trimmed;
    pendingRef.current.title = trimmed;
    scheduleSave();
  }

  function finishTitleEdit() {
    if (title.trim().length === 0) setTitle(lastTitleRef.current);
  }

  async function exportMarkdown() {
    if (!editor) return;
    const { default: TurndownService } = await import("turndown");
    const converter = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
    const markdown = converter.turndown(editor.getHTML());
    const blob = new Blob([markdown + "\n"], { type: "text/markdown" });
    const link = document.createElement("a");
    const filename = lastTitleRef.current.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    link.href = URL.createObjectURL(blob);
    link.download = `${filename || "document"}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const chain = () => editor?.chain().focus();

  return (
    <div className="editor-page">
      <header className="topbar">
        <div className="row grow">
          <Link href="/" className="button small">
            Documents
          </Link>
          <input
            className="title-input"
            value={title}
            onChange={(event) => changeTitle(event.target.value)}
            onBlur={finishTitleEdit}
            disabled={!editable}
            maxLength={200}
            aria-label="Document title"
          />
          <span className={`badge ${doc.role}`}>{ROLE_LABEL[doc.role]}</span>
          {doc.role !== "owner" && (
            <span className="muted small">Owned by {doc.ownerName}</span>
          )}
        </div>
        <div className="row">
          {editable && (
            <span className={`status ${status}`} role="status">
              {STATUS_LABEL[status]}
            </span>
          )}
          <button className="button small" onClick={exportMarkdown}>
            Export .md
          </button>
          {canManageSharing(doc.role) && (
            <button className="button primary small" onClick={() => setShareOpen(true)}>
              Share
            </button>
          )}
          <span className="muted small">{user.name}</span>
        </div>
      </header>

      {status === "conflict" && (
        <div className="banner error" role="alert">
          Someone else changed this document, so your latest edits were not saved. Copy anything you
          need, then reload to get the newest version.
          <button className="button small" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      {status === "error" && errorText && (
        <div className="banner error" role="alert">
          {errorText}
        </div>
      )}
      {!editable && (
        <div className="banner info">You have view-only access. You cannot edit this document.</div>
      )}

      {editable && (
        <div className="toolbar" role="toolbar" aria-label="Formatting">
          <ToolbarButton label="Bold" on={active?.bold} onClick={() => chain()?.toggleBold().run()}>
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton label="Italic" on={active?.italic} onClick={() => chain()?.toggleItalic().run()}>
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            on={active?.underline}
            onClick={() => chain()?.toggleUnderline().run()}
          >
            <u>U</u>
          </ToolbarButton>
          <span className="divider" />
          <ToolbarButton label="Normal text" on={active?.paragraph} onClick={() => chain()?.setParagraph().run()}>
            Text
          </ToolbarButton>
          <ToolbarButton label="Heading 1" on={active?.h1} onClick={() => chain()?.toggleHeading({ level: 1 }).run()}>
            H1
          </ToolbarButton>
          <ToolbarButton label="Heading 2" on={active?.h2} onClick={() => chain()?.toggleHeading({ level: 2 }).run()}>
            H2
          </ToolbarButton>
          <ToolbarButton label="Heading 3" on={active?.h3} onClick={() => chain()?.toggleHeading({ level: 3 }).run()}>
            H3
          </ToolbarButton>
          <span className="divider" />
          <ToolbarButton label="Bulleted list" on={active?.bullet} onClick={() => chain()?.toggleBulletList().run()}>
            • List
          </ToolbarButton>
          <ToolbarButton label="Numbered list" on={active?.ordered} onClick={() => chain()?.toggleOrderedList().run()}>
            1. List
          </ToolbarButton>
          <span className="divider" />
          <ToolbarButton label="Undo" disabled={!active?.canUndo} onClick={() => chain()?.undo().run()}>
            Undo
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!active?.canRedo} onClick={() => chain()?.redo().run()}>
            Redo
          </ToolbarButton>
        </div>
      )}

      <main className="paper-wrap">
        <div className="paper">
          <EditorContent editor={editor} />
        </div>
      </main>

      {shareOpen && <ShareDialog documentId={doc.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function ToolbarButton({
  label,
  on,
  disabled,
  onClick,
  children,
}: {
  label: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tool ${on ? "on" : ""}`}
      aria-label={label}
      aria-pressed={on ?? false}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
