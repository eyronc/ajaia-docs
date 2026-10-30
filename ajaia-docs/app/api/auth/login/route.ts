import bcrypt from "bcryptjs";
import { startSession } from "@/lib/auth";
import { errorResponse, json, readJsonObject } from "@/lib/http";
import { findUserByEmail } from "@/lib/repo";
import { validateEmail } from "@/lib/validation";

// Compared against when the email is unknown, so response time does not reveal
// which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return errorResponse("Send a JSON body with email and password.", 400);

  const email = validateEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.ok || password.length === 0) {
    return errorResponse("Enter your email and password.", 400);
  }

  const user = await findUserByEmail(email.value);
  const matches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !matches) {
    return errorResponse("Invalid email or password.", 401);
  }

  await startSession(user.id);
  return json({ user: { id: user.id, email: user.email, name: user.name } });
}
