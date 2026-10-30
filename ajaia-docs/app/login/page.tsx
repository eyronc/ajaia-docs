import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return <LoginForm demoUsers={DEMO_USERS} demoPassword={DEMO_PASSWORD} />;
}
