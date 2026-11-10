import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StaffDashboard } from "@/components/staff-dashboard";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { getRequestPage } from "@/lib/request-query";
import { withRlsContext } from "@/lib/rls";

export async function StaffPage({
  section,
}: {
  section: "dashboard" | "profile";
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== UserRole.STAFF && session.role !== UserRole.ADMIN) redirect("/");
  const [profile, initialPage] = await Promise.all([
    section === "profile"
      ? withRlsContext(session, (tx) =>
          tx.staffProfile.findUnique({
            where: { userId: session.userId },
            select: { fullNameEncrypted: true, jobTitle: true, phoneEncrypted: true },
          }),
        )
      : Promise.resolve(null),
    section === "dashboard" ? getRequestPage(session, 0) : Promise.resolve(undefined),
  ]);
  const staffProfile = profile
    ? {
        fullName: decrypt(profile.fullNameEncrypted),
        jobTitle: profile.jobTitle,
        phone: decrypt(profile.phoneEncrypted),
      }
    : { fullName: "", jobTitle: "", phone: "" };
  const name = staffProfile.fullName || session.email;

  return (
    <AppShell role={session.role} email={session.email} fullName={name}>
      <StaffDashboard key={section} staffName={name} initialProfile={staffProfile} section={section} initialPage={initialPage} />
    </AppShell>
  );
}
