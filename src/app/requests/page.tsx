import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResidentDashboard } from "@/components/resident-dashboard";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

export default async function RequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== UserRole.RESIDENT) redirect(session.role === UserRole.ADMIN ? "/admin" : "/staff");
  const profile = await withRlsContext(session, (tx) =>
    tx.residentProfile.findUnique({
      where: { userId: session.userId },
      select: { fullNameEncrypted: true },
    }),
  );
  const fullName = profile ? decrypt(profile.fullNameEncrypted) : "Resident";
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();

  return (
    <AppShell role={session.role} email={session.email} fullName={fullName}>
      <ResidentDashboard key="requests" fullName={fullName} today={today} section="requests" />
    </AppShell>
  );
}
