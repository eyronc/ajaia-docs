import { getCurrentUser } from "@/lib/auth";
import {
  errorResponse,
  failureResponse,
  json,
  readJsonObject,
  unauthorized,
} from "@/lib/http";
import { deleteDocument, getDocumentForUser, updateDocument } from "@/lib/repo";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const document = await getDocumentForUser(id, user.id);
  if (!document) return errorResponse("Document not found.", 404);
  return json({ document });
}

export async function PATCH(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  if (!body) return errorResponse("Send a JSON body.", 400);

  const version = body.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return errorResponse("A valid document version is required.", 400);
  }

  const { id } = await context.params;
  const result = await updateDocument(
    id,
    user.id,
    { title: body.title, content: body.content },
    version,
  );
  if (!result.ok) return failureResponse(result.error, result.message);
  return json({ version: result.version, updatedAt: result.updatedAt });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const result = await deleteDocument(id, user.id);
  if (!result.ok) return failureResponse(result.error, result.message);
  return json({ ok: true });
}
