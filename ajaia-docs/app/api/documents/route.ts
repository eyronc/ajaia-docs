import { getCurrentUser } from "@/lib/auth";
import { errorResponse, json, readJsonObject, unauthorized } from "@/lib/http";
import { createDocument, listDocumentsForUser } from "@/lib/repo";
import { validateTitle } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ documents: await listDocumentsForUser(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  // The body is optional. An empty request creates "Untitled document".
  const body = (await readJsonObject(request)) ?? {};
  let title = "Untitled document";
  if (body.title !== undefined) {
    const checked = validateTitle(body.title);
    if (!checked.ok) return errorResponse(checked.message, 400);
    title = checked.value;
  }

  const created = await createDocument(user.id, title);
  return json({ id: created.id }, 201);
}
