import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy notice · Konek Barangay",
  description: "How resident information is used to provide barangay services.",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f8f5] px-4 py-8 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-[760px]">
        <Link className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64746a] hover:text-[#145b43]" href="/register"><ArrowLeft size={14} /> Back to registration</Link>
        <div className="mt-7 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#145b43] text-lg font-semibold text-white">k.</span><span><span className="block text-[14px] font-bold text-[#253a30]">konek<span className="font-normal">barangay</span></span><span className="mt-0.5 block text-[9px] tracking-[.13em] text-[#89958d]">PRIVACY NOTICE · VERSION 2026-10-V1</span></span></div>
        <h1 className="mt-8 text-[31px] font-semibold tracking-[-.04em] text-[#23372d]">Your information. In trusted hands.</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#7e8a82]">This notice explains how the barangay uses personal information to provide resident and document services through Konek Barangay.</p>
        <div className="mt-6 rounded-xl border border-[#dce8dc] bg-white p-4 sm:p-5"><div className="flex gap-3"><LockKeyhole className="mt-0.5 shrink-0 text-[#63836e]" size={17} /><p className="text-[12px] leading-6 text-[#5e6e63]">This is a draft notice for implementation planning. The barangay&apos;s Data Protection Officer must confirm the controller details, lawful bases, retention periods, recipients, and contact channel before launch.</p></div></div>
        <div className="card mt-5 divide-y divide-[#edf0ed] px-5 sm:px-7">
          {[
            ["Information we collect", "Account email and password hash; resident name, date of birth, address, phone number and civil status; document request purpose and status; and supporting files you choose to submit."],
            ["Why we use it", "To establish resident accounts, verify resident records, process and issue requested barangay documents, provide request receipts and status information, prevent misuse, and maintain issuance and audit records."],
            ["How it is protected", "Sensitive profile details are encrypted before being stored. Passwords are hashed. Access is limited by role and database row-level policies. Uploaded files and issued PDFs are kept in private cloud storage and shared only through short-lived links."],
            ["Who may access it", "Authorized barangay staff may review information needed to process your request. The barangay's contracted hosting, database, and storage providers process data only to deliver the service under the barangay's configuration and agreements."],
            ["Public document verification", "A QR scan checks the official document registry and may show the document type, reference number, recipient name, issue date, and validity status. Each scan is logged for security, with the network address hashed using a protected server-side salt."],
            ["Retention and your rights", "Records are retained according to the barangay's approved records-retention and deletion schedule. You may request access, correction, or other applicable data-subject rights through the barangay office. The barangay must publish its approved retention schedule and rights-handling contact before production."],
            ["Questions or concerns", "For privacy questions, contact the barangay office through its official published channels and ask for the designated Data Protection Officer. Do not include passwords or sensitive identification numbers in support requests."],
          ].map(([heading, body]) => <section className="py-4" key={heading}><h2 className="text-[13px] font-semibold text-[#3e5045]">{heading}</h2><p className="mt-1.5 text-[11px] leading-6 text-[#78857c]">{body}</p></section>)}
        </div>
        <p className="mt-4 flex items-center gap-2 px-1 text-[10px] leading-5 text-[#98a29b]"><ShieldCheck size={13} /> Please read the final barangay-approved privacy notice before using the production service.</p>
      </article>
    </main>
  );
}
