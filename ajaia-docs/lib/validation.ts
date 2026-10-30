export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 1_000_000;

export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

export function validateTitle(input: unknown): Validated<string> {
  if (typeof input !== "string") {
    return { ok: false, message: "Title must be text." };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Title cannot be empty." };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { ok: false, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function validateContent(input: unknown): Validated<string> {
  if (typeof input !== "string") {
    return { ok: false, message: "Content must be text." };
  }
  if (input.length > MAX_CONTENT_LENGTH) {
    return { ok: false, message: "Document is too large to save." };
  }
  return { ok: true, value: input };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(input: unknown): Validated<string> {
  if (typeof input !== "string") {
    return { ok: false, message: "Email must be text." };
  }
  const normalized = input.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, value: normalized };
}

export function validatePermission(input: unknown): Validated<"view" | "edit"> {
  if (input === "view" || input === "edit") {
    return { ok: true, value: input };
  }
  return { ok: false, message: 'Permission must be "view" or "edit".' };
}
