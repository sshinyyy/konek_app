import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResidentDashboard } from "@/components/resident-dashboard";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === UserRole.ADMIN) redirect("/admin");
  if (session.role === UserRole.STAFF) redirect("/staff");
  const profile = await withRlsContext(session, (tx) =>
    tx.residentProfile.findUnique({ where: { userId: session.userId }, select: { fullNameEncrypted: true } }),
  );
  const name = profile ? decrypt(profile.fullNameEncrypted) : "Resident";
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
  return <AppShell role={session.role} email={session.email} fullName={name}><ResidentDashboard fullName={name} today={today} /></AppShell>;
}
