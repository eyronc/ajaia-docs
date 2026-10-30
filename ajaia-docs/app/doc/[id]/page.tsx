import { notFound, redirect } from "next/navigation";
import Editor from "@/components/Editor";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentForUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const document = await getDocumentForUser(id, user.id);
  if (!document) notFound();

  return <Editor document={document} user={user} />;
}
