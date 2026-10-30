"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ShareEntry } from "@/lib/repo";

type Permission = "view" | "edit";

export default function ShareDialog({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("view");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/documents/${documentId}/shares`).catch(() => null);
      if (cancelled) return;
      if (!response || !response.ok) {
        setError("Could not load who has access.");
      } else {
        const data = await response.json();
        setShares(data.shares);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function share(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const response = await fetch(`/api/documents/${documentId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, permission }),
    }).catch(() => null);

    setBusy(false);
    if (!response) {
      setError("Could not reach the server. Try again.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Could not share the document.");
      return;
    }

    const entry: ShareEntry = data.share;
    setShares((current) => {
      const others = current.filter((item) => item.userId !== entry.userId);
      return [...others, entry].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEmail("");
  }

  async function remove(entry: ShareEntry) {
    setError(null);
    const response = await fetch(
      `/api/documents/${documentId}/shares?userId=${encodeURIComponent(entry.userId)}`,
      { method: "DELETE" },
    ).catch(() => null);
    if (!response || !response.ok) {
      setError("Could not remove access.");
      return;
    }
    setShares((current) => current.filter((item) => item.userId !== entry.userId));
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Share document"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row spread">
          <h2>Share document</h2>
          <button className="button small" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <form onSubmit={share} className="row wrap share-form">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Email address"
            required
          />
          <select
            value={permission}
            onChange={(event) => setPermission(event.target.value as Permission)}
            aria-label="Permission"
          >
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Sharing..." : "Share"}
          </button>
        </form>
        <p className="muted small">
          Sharing with someone who already has access updates their permission.
        </p>

        {error && <p className="error" role="alert">{error}</p>}

        <h3>People with access</h3>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : shares.length === 0 ? (
          <p className="muted">Only you have access.</p>
        ) : (
          <ul className="share-list">
            {shares.map((entry) => (
              <li key={entry.userId} className="row spread">
                <span>
                  {entry.name} <span className="muted small">{entry.email}</span>
                </span>
                <span className="row">
                  <span className={`badge ${entry.permission === "edit" ? "editor" : "viewer"}`}>
                    {entry.permission === "edit" ? "Can edit" : "Can view"}
                  </span>
                  <button className="button small" onClick={() => remove(entry)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
