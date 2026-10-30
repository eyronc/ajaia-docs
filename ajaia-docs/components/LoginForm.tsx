"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type DemoUser = { email: string; name: string };

export default function LoginForm({
  demoUsers,
  demoPassword,
}: {
  demoUsers: DemoUser[];
  demoPassword: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);

    if (!response) {
      setError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Sign in failed.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>Ajaia Docs</h1>
        <p className="muted">Sign in to create, edit, and share documents.</p>

        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="demo-box">
          <p className="muted small">
            Demo accounts (password: <code>{demoPassword}</code>). Click one to fill the form.
          </p>
          <div className="row wrap">
            {demoUsers.map((user) => (
              <button
                key={user.email}
                type="button"
                className="button"
                onClick={() => {
                  setEmail(user.email);
                  setPassword(demoPassword);
                }}
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
