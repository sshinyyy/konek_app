import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaffDashboard } from "@/components/staff-dashboard";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { withRlsContext } from "@/lib/rls";

export default async function StaffPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== UserRole.STAFF && session.role !== UserRole.ADMIN) redirect("/");
  const profile = await withRlsContext(session, (tx) =>
    tx.staffProfile.findUnique({
      where: { userId: session.userId },
      select: { fullNameEncrypted: true, jobTitle: true, phoneEncrypted: true },
    }),
  );
  const staffProfile = profile
    ? {
        fullName: decrypt(profile.fullNameEncrypted),
        jobTitle: profile.jobTitle,
        phone: decrypt(profile.phoneEncrypted),
      }
    : { fullName: "", jobTitle: "", phone: "" };
  const name = staffProfile.fullName || session.email;
  return <AppShell role={session.role} email={session.email} fullName={name}><StaffDashboard staffName={name} initialProfile={staffProfile} /></AppShell>;
}
