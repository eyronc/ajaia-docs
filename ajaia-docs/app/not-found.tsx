import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>Document not found</h1>
        <p className="muted">
          It may have been deleted, or you may not have access to it.
        </p>
        <Link className="button primary" href="/">
          Back to documents
        </Link>
      </div>
    </main>
  );
}
