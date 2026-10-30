import mammoth from "mammoth";
import { marked } from "marked";
import { sanitizeHtml } from "./sanitize";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;

export class ImportError extends Error {}

export function getExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index).toLowerCase();
}

export function titleFromFilename(filename: string): string {
  const index = filename.lastIndexOf(".");
  const base = index > 0 ? filename.slice(0, index) : filename;
  const cleaned = base.replace(/[_-]+/g, " ").trim();
  return (cleaned || "Imported document").slice(0, 200);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Blank lines start a new paragraph. Single line breaks stay as line breaks.
export function textToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) return "<p></p>";
  return normalized
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const html = await marked.parse(markdown, { async: true, gfm: true });
  return sanitizeHtml(html);
}

export type ImportedDocument = { title: string; html: string };

export async function convertUploadToHtml(
  filename: string,
  bytes: Buffer,
): Promise<ImportedDocument> {
  const extension = getExtension(filename);

  if (!SUPPORTED_EXTENSIONS.includes(extension as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new ImportError(
      `Unsupported file type. Supported types: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
    );
  }
  if (bytes.length === 0) {
    throw new ImportError("The file is empty.");
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new ImportError(
      `File is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const title = titleFromFilename(filename);

  if (extension === ".txt") {
    return { title, html: textToHtml(bytes.toString("utf8")) };
  }

  if (extension === ".md") {
    return { title, html: await markdownToHtml(bytes.toString("utf8")) };
  }

  const result = await mammoth.convertToHtml({ buffer: bytes }).catch(() => null);
  if (!result) {
    throw new ImportError("Could not read this .docx file. It may be corrupted.");
  }
  return { title, html: sanitizeHtml(result.value) };
}
