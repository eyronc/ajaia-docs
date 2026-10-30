"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DocumentSummary, User } from "@/lib/repo";

const ROLE_LABEL = { owner: "Owner", editor: "Can edit", viewer: "View only" } as const;

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Dashboard({
  user,
  documents,
}: {
  user: User;
  documents: DocumentSummary[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const owned = documents.filter((doc) => doc.role === "owner");
  const shared = documents.filter((doc) => doc.role !== "owner");

  async function createDocument() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/documents", { method: "POST" }).catch(() => null);
    if (!response || !response.ok) {
      setMessage({ kind: "error", text: "Could not create the document. Try again." });
      setBusy(false);
      return;
    }
    const data = await response.json();
    router.push(`/doc/${data.id}`);
  }

  async function importFile(file: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);

    const response = await fetch("/api/documents/import", { method: "POST", body: form }).catch(
      () => null,
    );
    if (!response) {
      setMessage({ kind: "error", text: "Could not reach the server. Try again." });
      setBusy(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ kind: "error", text: data.error ?? "Import failed." });
      setBusy(false);
      return;
    }
    router.push(`/doc/${data.id}`);
  }

  async function deleteDocument(doc: DocumentSummary) {
    if (!window.confirm(`Delete "${doc.title}"? This also removes it for people it is shared with.`)) {
      return;
    }
    const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" }).catch(() => null);
    if (!response || !response.ok) {
      setMessage({ kind: "error", text: "Could not delete the document." });
      return;
    }
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="page">
      <header className="topbar">
        <strong className="brand">Ajaia Docs</strong>
        <div className="row">
          <span className="muted small">{user.name}</span>
          <button className="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="actions">
        <button className="button primary" onClick={createDocument} disabled={busy}>
          New document
        </button>
        <button className="button" onClick={() => fileInput.current?.click()} disabled={busy}>
          Import file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.docx"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) importFile(file);
          }}
        />
        <span className="muted small">Import supports .txt, .md, and .docx up to 2 MB.</span>
      </section>

      {message && (
        <p className={message.kind === "error" ? "error" : "muted"} role="alert">
          {message.text}
        </p>
      )}

      <DocumentList
        heading="My documents"
        empty="You have not created any documents yet."
        documents={owned}
        onDelete={deleteDocument}
      />
      <DocumentList
        heading="Shared with me"
        empty="Nothing has been shared with you yet."
        documents={shared}
      />
    </main>
  );
}

function DocumentList({
  heading,
  empty,
  documents,
  onDelete,
}: {
  heading: string;
  empty: string;
  documents: DocumentSummary[];
  onDelete?: (doc: DocumentSummary) => void;
}) {
  return (
    <section className="list-section" aria-label={heading}>
      <h2>{heading}</h2>
      {documents.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="doc-list">
          {documents.map((doc) => (
            <li key={doc.id} className="doc-item">
              <Link href={`/doc/${doc.id}`} className="doc-link">
                <span className="doc-title">{doc.title}</span>
                <span className="muted small">
                  {doc.role === "owner" ? "" : `Shared by ${doc.ownerName} · `}
                  Edited {formatDate(doc.updatedAt)}
                </span>
              </Link>
              <span className={`badge ${doc.role}`}>{ROLE_LABEL[doc.role]}</span>
              {onDelete && (
                <button className="button danger small" onClick={() => onDelete(doc)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
