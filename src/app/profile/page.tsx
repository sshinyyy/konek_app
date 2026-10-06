import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== UserRole.RESIDENT) redirect(session.role === UserRole.ADMIN ? "/admin" : "/staff");
  const profile = await withRlsContext(session, (tx) =>
    tx.residentProfile.findUnique({ where: { userId: session.userId }, select: { fullNameEncrypted: true } }),
  );
  const fullName = profile ? decrypt(profile.fullNameEncrypted) : session.email;
  return <AppShell role={session.role} email={session.email} fullName={fullName}><ProfileForm email={session.email} /></AppShell>;
}
