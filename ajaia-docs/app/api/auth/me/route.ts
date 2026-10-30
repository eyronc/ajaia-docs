import { getCurrentUser } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return json({ user });
}
