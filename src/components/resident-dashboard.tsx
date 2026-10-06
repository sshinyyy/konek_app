"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, FileCheck2, FilePlus2, Files, LoaderCircle, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";

type ResidentRequest = {
  id: string;
  referenceNo: string;
  type: string;
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "ISSUED";
  purpose: string;
  remarks: string | null;
  submittedAt: string;
  uploads: { id: string; fileName: string; status: string; sizeBytes: number }[];
  document: { referenceNo: string; issuedAt: string; validUntil: string | null } | null;
};

const documentNames: Record<string, string> = {
  BARANGAY_CLEARANCE: "Barangay clearance",
  CERTIFICATE_OF_RESIDENCY: "Certificate of residency",
  BARANGAY_ID: "Barangay ID",
};

const statusStyles: Record<ResidentRequest["status"], string> = {
  PENDING: "bg-[#fff4df] text-[#986c21]",
  IN_REVIEW: "bg-[#edf3fb] text-[#55739b]",
  APPROVED: "bg-[#e8f3ec] text-[#38704e]",
  ISSUED: "bg-[#e8f3ec] text-[#38704e]",
  REJECTED: "bg-[#fcece8] text-[#a45442]",
};

async function getError(response: Response) {
  const result = await response.json();
  return result.error ?? "The request could not be completed.";
}

export function ResidentDashboard({ fullName, today }: { fullName: string; today: string }) {
  const [requests, setRequests] = useState<ResidentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState("BARANGAY_CLEARANCE");
  const [purpose, setPurpose] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");

  async function loadRequests() {
    setError("");
    try {
      const response = await fetch("/api/v1/requests", { cache: "no-store" });
      if (!response.ok) throw new Error(await getError(response));
      const body = await response.json();
      setRequests(body.requests);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch("/api/v1/requests", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await getError(response));
        return response.json();
      })
      .then((body) => setRequests(body.requests))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load requests."))
      .finally(() => setLoading(false));
    const interval = window.setInterval(() => {
      void fetch("/api/v1/requests", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error(await getError(response));
          return response.json();
        })
        .then((body) => setRequests(body.requests))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh requests."));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, purpose }),
      });
      if (!response.ok) throw new Error(await getError(response));
      const created = await response.json();
      for (const file of files) {
        const signedResponse = await fetch("/api/v1/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: created.id,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });
        if (!signedResponse.ok) throw new Error(await getError(signedResponse));
        const signed = await signedResponse.json();
        const uploadResponse = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error(`Could not securely upload ${file.name}.`);
        const completed = await fetch(`/api/v1/uploads/${signed.id}/complete`, { method: "POST" });
        if (!completed.ok) throw new Error(await getError(completed));
      }
      setNotice(`Request ${created.referenceNo} has been submitted.`);
      setPurpose("");
      setFiles([]);
      setShowForm(false);
      await loadRequests();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be submitted.");
      await loadRequests();
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter((request) => ["PENDING", "IN_REVIEW"].includes(request.status)).length;
  const issuedCount = requests.filter((request) => request.status === "ISSUED").length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{today} <span className="px-1.5 text-[#c5cdc6]">·</span> RESIDENT PORTAL</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em] text-[#24372e] sm:text-[34px]">Good day, {fullName.split(" ")[0]}.</h1>
          <p className="mt-1.5 text-[13px] text-[#7d8981]">Your community services, all in one place.</p>
        </div>
        <button className="button-primary" onClick={() => setShowForm((value) => !value)} type="button">
          <FilePlus2 size={16} /> New request
        </button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total requests", value: requests.length, icon: Files, accent: "text-[#477661]", note: "All-time submissions" },
          { label: "In progress", value: pendingCount, icon: Clock3, accent: "text-[#bc8936]", note: "Awaiting processing" },
          { label: "Documents issued", value: issuedCount, icon: FileCheck2, accent: "text-[#477661]", note: "Ready to download" },
        ].map(({ label, value, icon: Icon, accent, note }) => (
          <div className="card flex items-center justify-between p-4 sm:p-5" key={label}>
            <div><p className="text-[12px] text-[#849087]">{label}</p><p className="mt-1 text-[25px] font-semibold tracking-tight text-[#26392f]">{loading ? "—" : value}</p><p className="mt-0.5 text-[10px] text-[#9aa49c]">{note}</p></div>
            <span className={`flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f1f5f0] ${accent}`}><Icon size={18} /></span>
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-xl bg-[#164c38] p-5 text-white sm:flex sm:items-center sm:justify-between sm:px-7 sm:py-6">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-[#cde4d2]"><ShieldCheck size={20} /></span>
          <div><p className="text-[15px] font-semibold">Official documents. Verified in a scan.</p><p className="mt-1 max-w-[430px] text-[12px] leading-5 text-white/65">Every issued certificate includes a unique QR code for secure, instant authenticity checks.</p></div>
        </div>
        <a className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[#d6eadc] hover:text-white sm:mt-0" href="/verify">Explore verification <ArrowUpRight size={14} /></a>
      </div>

      {showForm && (
        <section className="card mt-7 p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div><p className="eyebrow">NEW APPLICATION</p><h2 className="mt-1 text-[19px] font-semibold tracking-tight">Request a document</h2></div>
            <button aria-label="Close request form" className="text-[22px] leading-none text-[#9aa49e]" onClick={() => setShowForm(false)} type="button">×</button>
          </div>
          <form className="mt-5 space-y-4" onSubmit={submitRequest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[12px] font-semibold text-[#4d5b53]">Document type
                <select className="field mt-1.5" onChange={(event) => setType(event.target.value)} value={type}>
                  <option value="BARANGAY_CLEARANCE">Barangay clearance</option>
                  <option value="CERTIFICATE_OF_RESIDENCY">Certificate of residency</option>
                  <option value="BARANGAY_ID">Barangay ID</option>
                </select>
              </label>
              <label className="text-[12px] font-semibold text-[#4d5b53]">Purpose of request
                <input className="field mt-1.5" maxLength={500} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Local employment requirement" required value={purpose} />
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-[#4d5b53]">Supporting documents <span className="font-normal text-[#99a29c]">(optional, PDF or image · max 10 MB each)</span>
              <span className="mt-1.5 flex min-h-[76px] cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#d9e2da] bg-[#fbfcfa] px-4 text-[#78867d] hover:border-[#9eb8a3]">
                <UploadCloud size={18} className="shrink-0 text-[#6c947b]" />
                <span className="flex-1 text-[12px]">{files.length ? files.map((file) => file.name).join(", ") : "Choose files to attach"}</span>
                <input accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} type="file" />
              </span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-4">
              <p className="max-w-[510px] text-[11px] leading-5 text-[#8a958e]">By submitting, you confirm that the information is accurate and consent to its use for processing this request.</p>
              <button className="button-primary" disabled={submitting} type="submit">{submitting ? <><LoaderCircle className="animate-spin" size={15} /> Submitting…</> : <>Submit request <ArrowRight size={15} /></>}</button>
            </div>
          </form>
        </section>
      )}

      {notice && <p aria-live="polite" className="mt-4 flex items-center gap-2 rounded-lg border border-[#d9e9db] bg-[#f0f7f0] px-4 py-3 text-[12px] text-[#3d754e]"><Check size={15} />{notice}</p>}
      {error && <p aria-live="polite" className="mt-4 rounded-lg border border-[#f0d5d0] bg-[#fff6f4] px-4 py-3 text-[12px] text-[#a14d3d]">{error}</p>}

      <section className="mt-8" id="requests">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><p className="eyebrow">YOUR ACTIVITY</p><h2 className="mt-1 text-[19px] font-semibold tracking-tight">Recent requests</h2></div>
          <button className="button-secondary min-h-[35px] text-[11px]" onClick={() => { setLoading(true); void loadRequests(); }} type="button"><RefreshCw size={13} /> Refresh</button>
        </div>
        <div className="card overflow-hidden">
          {loading ? <div className="flex items-center justify-center gap-2 py-14 text-[12px] text-[#909b94]"><LoaderCircle className="animate-spin" size={16} />Loading your requests…</div>
            : requests.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff4ef] text-[#70937d]"><Files size={20} /></span>
                <p className="mt-3 text-[14px] font-semibold text-[#36473d]">Your first request starts here.</p>
                <p className="mt-1 text-[12px] text-[#8a958e]">Apply online and follow its progress right from your dashboard.</p>
                <button className="button-secondary mt-4" onClick={() => setShowForm(true)} type="button"><FilePlus2 size={14} /> Start a request</button>
              </div>
            ) : (
              <div className="divide-y divide-[#edf0ed]">
                {requests.slice(0, 8).map((request) => (
                  <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" key={request.id}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f4ef] text-[#60836e]"><Files size={16} /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold text-[#33463b]">{documentNames[request.type] ?? request.type}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles[request.status]}`}>{request.status.replaceAll("_", " ")}</span></div>
                        <p className="mt-1 text-[11px] text-[#87928a]">{request.referenceNo} <span className="px-1 text-[#cdd3ce]">·</span> {request.purpose}</p>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#a0a9a2]"><CalendarDays size={11} /> Submitted {new Date(request.submittedAt).toLocaleDateString("en-PH")}</p>
                        {request.remarks && <p className="mt-1.5 text-[11px] text-[#815b3b]">Staff note: {request.remarks}</p>}
                        {request.uploads.length > 0 && <p className="mt-1 text-[10px] text-[#8f9b93]">{request.uploads.length} supporting file{request.uploads.length === 1 ? "" : "s"}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                      <a className="button-secondary min-h-[34px] text-[10px]" href={`/api/v1/requests/${request.id}/receipt`}><ArrowDownToLine size={13} /> Receipt</a>
                      {request.status === "ISSUED" && <a className="button-primary min-h-[34px] text-[10px]" href={`/api/v1/requests/${request.id}/download`}><ArrowDownToLine size={13} /> Certificate</a>}
                    </div>
                  </article>
                ))}
              </div>
            )}
        </div>
      </section>
      <p className="mt-5 flex items-center gap-1.5 text-[10px] text-[#a1aaa3]"><ShieldCheck size={12} /> Personal records are encrypted and only used to process your barangay services.</p>
    </>
  );
}
