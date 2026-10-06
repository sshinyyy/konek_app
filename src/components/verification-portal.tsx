"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CircleAlert, LoaderCircle, Search, ShieldCheck } from "lucide-react";

type Result = {
  authentic: boolean;
  message: string;
  referenceNo?: string | null;
  documentType?: string | null;
  recipientName?: string | null;
  issuedAt?: string | null;
  validUntil?: string | null;
};

function extractToken(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    return parsed.searchParams.get("token") ?? cleaned;
  } catch {
    return cleaned;
  }
}

export function VerificationPortal({ initialToken }: { initialToken: string }) {
  const [input, setInput] = useState(initialToken);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(Boolean(initialToken));
  const [error, setError] = useState("");

  async function verify(value: string) {
    const token = extractToken(value);
    if (!token) {
      setError("Enter the verification code from the QR link.");
      setResult(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/verify?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The verification service is unavailable.");
      setResult(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The verification service is unavailable.");
      setResult(null);
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!initialToken) return;
    const token = extractToken(initialToken);
    void fetch(`/api/v1/verify?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "The verification service is unavailable.");
        setResult(body);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The verification service is unavailable."))
      .finally(() => setBusy(false));
  }, [initialToken]);

  return (
    <main className="min-h-screen bg-[#f6f8f5] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[600px]">
        <Link className="inline-flex items-center gap-2 text-[12px] font-medium text-[#64746a] hover:text-[#145b43]" href="/login"><ArrowLeft size={14} /> Barangay services</Link>
        <div className="mt-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#145b43] text-white"><span className="text-lg font-semibold">k.</span></span>
          <span><span className="block text-[14px] font-bold text-[#253a30]">konek<span className="font-normal">barangay</span></span><span className="mt-0.5 block text-[9px] tracking-[.13em] text-[#89958d]">OFFICIAL DOCUMENT CHECK</span></span>
        </div>
        <div className="mt-8">
          <p className="eyebrow">PUBLIC VERIFICATION PORTAL</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em] text-[#23372d] sm:text-[34px]">Check a document.</h1>
          <p className="mt-2 text-[13px] leading-6 text-[#7e8a82]">Scan the QR code with your phone camera, or enter the verification link below.</p>
        </div>
        <form className="card mt-5 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); void verify(input); }}>
          <label className="mb-2 block text-[11px] font-semibold text-[#4e5d53]" htmlFor="token">Verification link or code</label>
          <div className="flex gap-2"><input autoComplete="off" className="field min-w-0" id="token" onChange={(event) => setInput(event.target.value)} placeholder="Paste the QR verification link" value={input} /><button aria-label="Verify document" className="button-primary shrink-0 px-3 sm:px-4" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Search size={15} />}<span className="hidden sm:inline">Verify</span></button></div>
          <p className="mt-2 text-[10px] leading-5 text-[#9aa49e]">This portal only displays public document details. Never share a verification link with anyone you do not trust.</p>
        </form>

        {error && <p aria-live="polite" className="mt-4 rounded-lg border border-[#f0d5d0] bg-[#fff6f4] px-4 py-3 text-[12px] text-[#a14d3d]">{error}</p>}
        {busy && !result && <div className="mt-5 flex items-center justify-center gap-2 py-8 text-[12px] text-[#87948b]"><LoaderCircle className="animate-spin" size={17} />Checking the official issuance registry…</div>}
        {result && (
          <section aria-live="polite" className={`mt-5 overflow-hidden rounded-xl border bg-white ${result.authentic ? "border-[#d9e9dd]" : "border-[#f0dad4]"}`}>
            <div className={`flex items-center gap-3 px-5 py-4 ${result.authentic ? "bg-[#edf7ef]" : "bg-[#fff3ef]"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${result.authentic ? "bg-[#d9eddd] text-[#35734d]" : "bg-[#f9ded7] text-[#a54f3f]"}`}>{result.authentic ? <BadgeCheck size={21} /> : <CircleAlert size={20} />}</span>
              <div><p className={`text-[15px] font-bold ${result.authentic ? "text-[#286344]" : "text-[#9e4a3b]"}`}>{result.authentic ? "Authentic Document" : "Invalid / Forged Document"}</p><p className={`mt-0.5 text-[10px] ${result.authentic ? "text-[#62846a]" : "text-[#ad6b5e]"}`}>{result.message}</p></div>
            </div>
            {result.authentic && <div className="grid gap-x-8 sm:grid-cols-2">
              {[
                ["Document type", result.documentType?.replaceAll("_", " ") ?? "—"],
                ["Reference number", result.referenceNo ?? "—"],
                ["Recipient", result.recipientName ?? "—"],
                ["Issue date", result.issuedAt ? new Date(result.issuedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"],
                ["Valid until", result.validUntil ? new Date(result.validUntil).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "No expiry"],
              ].map(([label, value]) => <div className="border-b border-[#f0f2ef] px-5 py-3.5" key={label}><p className="text-[9px] font-semibold uppercase tracking-wide text-[#98a29b]">{label}</p><p className="mt-1 text-[12px] font-medium text-[#435349]">{value}</p></div>)}
            </div>}
            <div className="flex items-start gap-2 border-t border-[#edf0ed] px-5 py-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#819789]" size={14} /><p className="text-[10px] leading-5 text-[#89948c]">Verification status reflects the barangay issuance registry at the time this code was checked. A valid result does not replace any required physical checks.</p></div>
          </section>
        )}
        <p className="mt-7 text-center text-[10px] leading-5 text-[#9aa49d]">Need assistance? Visit your barangay office for help with official document verification.</p>
      </div>
    </main>
  );
}
