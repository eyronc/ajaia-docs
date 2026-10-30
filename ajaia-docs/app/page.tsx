import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getCurrentUser } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const documents = await listDocumentsForUser(user.id);
  return <Dashboard user={user} documents={documents} />;
}
