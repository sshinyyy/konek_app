import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== UserRole.ADMIN) redirect("/");
  return <AppShell role={session.role} email={session.email} fullName={session.email}><AdminConsole email={session.email} /></AppShell>;
}
