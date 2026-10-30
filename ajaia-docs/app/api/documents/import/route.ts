import { getCurrentUser } from "@/lib/auth";
import { errorResponse, json, unauthorized } from "@/lib/http";
import { convertUploadToHtml, ImportError, MAX_UPLOAD_BYTES } from "@/lib/import";
import { createDocument } from "@/lib/repo";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return errorResponse("Choose a file to import.", 400);
  }
  // Checked before reading the file into memory.
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(
      `File is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const converted = await convertUploadToHtml(file.name, bytes).catch((error: unknown) =>
    error instanceof Error ? error : new Error("Import failed."),
  );
  if (converted instanceof ImportError) {
    return errorResponse(converted.message, 400);
  }
  if (converted instanceof Error) {
    return errorResponse("Something went wrong while importing the file.", 500);
  }

  const created = await createDocument(user.id, converted.title, converted.html);
  return json({ id: created.id }, 201);
}
