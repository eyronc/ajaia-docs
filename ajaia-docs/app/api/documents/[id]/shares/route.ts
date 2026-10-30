import { getCurrentUser } from "@/lib/auth";
import {
  errorResponse,
  failureResponse,
  json,
  readJsonObject,
  unauthorized,
} from "@/lib/http";
import { addShare, listShares, removeShare } from "@/lib/repo";
import { validateEmail, validatePermission } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const result = await listShares(id, user.id);
  if (!result.ok) return failureResponse(result.error, result.message);
  return json({ shares: result.shares });
}

// Sharing with someone who already has access updates their permission.
export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await readJsonObject(request);
  if (!body) return errorResponse("Send a JSON body with email and permission.", 400);

  const email = validateEmail(body.email);
  if (!email.ok) return errorResponse(email.message, 400);
  const permission = validatePermission(body.permission);
  if (!permission.ok) return errorResponse(permission.message, 400);

  const { id } = await context.params;
  const result = await addShare(id, user.id, email.value, permission.value);
  if (!result.ok) return failureResponse(result.error, result.message);
  return json({ share: result.share });
}

export async function DELETE(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const targetUserId = new URL(request.url).searchParams.get("userId");
  if (!targetUserId) return errorResponse("userId is required.", 400);

  const { id } = await context.params;
  const result = await removeShare(id, user.id, targetUserId);
  if (!result.ok) return failureResponse(result.error, result.message);
  return json({ ok: true });
}
