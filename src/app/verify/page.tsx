import { VerificationPortal } from "@/components/verification-portal";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "Verify a document · Konek Barangay",
  description: "Check an official barangay document against the issuance registry.",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) return <VerificationPortal initialToken={params.token ?? ""} />;
  return (
    <AppShell role={session.role} email={session.email} fullName={session.email}>
      <VerificationPortal initialToken={params.token ?? ""} embedded />
    </AppShell>
  );
}
