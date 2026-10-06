import { VerificationPortal } from "@/components/verification-portal";

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
  return <VerificationPortal initialToken={params.token ?? ""} />;
}
