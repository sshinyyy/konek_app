"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, FileCheck2, FilePlus2, Files, LoaderCircle, RefreshCw, ShieldCheck, UploadCloud, X } from "lucide-react";
import { getResidentRequestNextStep, requestStatusLabels } from "@/lib/request-presentation";
import { readJsonResponse } from "@/lib/client-response";
import { getSupportingFileIssue, getSupportingFileMimeType } from "@/lib/supporting-file-validation";

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
type RequestPage = {
  requests: ResidentRequest[];
  counts: Record<string, number>;
  totalCount: number;
  nextPage: number | null;
  error?: string;
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
  const result = await readJsonResponse<{ error?: string }>(response, "The request could not be completed.");
  return result.error ?? "The request could not be completed.";
}

export function ResidentDashboard({
  fullName,
  today,
  section = "overview",
}: {
  fullName: string;
  today: string;
  section?: "overview" | "requests";
}) {
  const [requests, setRequests] = useState<ResidentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(section === "requests");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [type, setType] = useState("BARANGAY_CLEARANCE");
  const [purpose, setPurpose] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const requestLoad = useRef<Promise<void> | null>(null);
  const nextPageRef = useRef<number | null | undefined>(undefined);

  const loadRequests = useCallback(() => {
    if (requestLoad.current) return requestLoad.current;
    const pending = (async () => {
      setError("");
      try {
        const response = await fetch("/api/v1/requests?page=0", { cache: "no-store" });
        if (!response.ok) throw new Error(await getError(response));
        const body = await readJsonResponse<RequestPage>(response, "Unable to load requests.");
        setRequests((current) => {
          const firstPageIds = new Set(body.requests.map((request) => request.id));
          return [...body.requests, ...current.filter((request) => !firstPageIds.has(request.id))];
        });
        setTotalCount(body.totalCount);
        setStatusCounts(body.counts);
        if (nextPageRef.current === undefined) {
          nextPageRef.current = body.nextPage;
          setNextPage(body.nextPage);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load requests.");
      } finally {
        setLoading(false);
      }
    })();
    requestLoad.current = pending;
    void pending.finally(() => {
      if (requestLoad.current === pending) requestLoad.current = null;
    });
    return pending;
  }, []);

  async function loadMoreRequests() {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/requests?page=${nextPage}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await getError(response));
      const body = await readJsonResponse<RequestPage>(response, "More requests could not be loaded.");
      setRequests((current) => {
        const existingIds = new Set(current.map((request) => request.id));
        return [...current, ...body.requests.filter((request) => !existingIds.has(request.id))];
      });
      nextPageRef.current = body.nextPage;
      setNextPage(body.nextPage);
      setTotalCount(body.totalCount);
      setStatusCounts(body.counts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "More requests could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadRequests();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadRequests]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalidFile = files.find((file) => getSupportingFileIssue(file));
    if (invalidFile) {
      setError(`${invalidFile.name}: ${getSupportingFileIssue(invalidFile)}`);
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    let createdReferenceNo: string | null = null;
    try {
      const response = await fetch("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, purpose }),
      });
      if (!response.ok) throw new Error(await getError(response));
      const created = await readJsonResponse<{ id: string; referenceNo: string }>(response, "The request could not be submitted.");
      createdReferenceNo = created.referenceNo;
      for (const file of files) {
        const mimeType = getSupportingFileMimeType(file);
        if (!mimeType) throw new Error(`${file.name}: Choose a PDF, JPG, PNG, or WebP file.`);
        const signedResponse = await fetch("/api/v1/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: created.id,
            fileName: file.name,
            mimeType,
            sizeBytes: file.size,
          }),
        });
        if (!signedResponse.ok) throw new Error(await getError(signedResponse));
        const signed = await readJsonResponse<{ id: string; uploadUrl: string }>(signedResponse, `Could not prepare ${file.name} for upload.`);
        const uploadResponse = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
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
      if (createdReferenceNo) {
        setError("");
        setNotice(`Request ${createdReferenceNo} was created, but a supporting file could not be uploaded. Contact the barangay office before submitting another request.`);
        setPurpose("");
        setFiles([]);
        setShowForm(false);
      }
      await loadRequests();
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = (statusCounts.PENDING ?? 0) + (statusCounts.IN_REVIEW ?? 0);
  const issuedCount = statusCounts.ISSUED ?? 0;

  return (
    <>
      {section === "overview" ? <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{today} <span className="px-1.5 text-[#c5cdc6]">·</span> RESIDENT PORTAL</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em] text-[#24372e] sm:text-[34px]">Good day, {fullName.split(" ")[0]}.</h1>
          <p className="mt-1.5 text-[13px] text-[#7d8981]">Submit requests, track progress, and download issued documents.</p>
        </div>
        <Link className="button-primary" href="/requests"><FilePlus2 size={16} /> New request</Link>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total requests", value: totalCount, icon: Files, accent: "text-[#477661]", note: "All-time submissions" },
          { label: "In progress", value: pendingCount, icon: Clock3, accent: "text-[#bc8936]", note: "Awaiting processing" },
          { label: "Documents issued", value: issuedCount, icon: FileCheck2, accent: "text-[#477661]", note: "Ready to download" },
        ].map(({ label, value, icon: Icon, accent, note }) => (
          <div className="card flex items-center justify-between p-4 sm:p-5" key={label}>
            <div><p className="text-[12px] text-[#849087]">{label}</p><p className="mt-1 text-[25px] font-semibold tracking-tight text-[#26392f]">{loading ? "—" : value}</p><p className="mt-0.5 text-[10px] text-[#9aa49c]">{note}</p></div>
            <span className={`flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f1f5f0] ${accent}`}><Icon size={18} /></span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-[#e3e9e4] py-3">
        <p className="flex items-center gap-2 text-[12px] text-[#64746a]"><ShieldCheck size={15} className="text-[#477661]" /> Issued documents include a QR code for authenticity checks.</p>
        <a className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#175b43] hover:underline" href="/verify">Verify a document <ArrowUpRight size={14} /></a>
      </div>
      </> : <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">RESIDENT SERVICES</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em] text-[#24372e] sm:text-[34px]">Your requests</h1><p className="mt-1.5 text-[13px] text-[#7d8981]">Submit an application and follow its progress.</p></div>
        <button className="button-primary" onClick={() => setShowForm((value) => !value)} type="button"><FilePlus2 size={16} /> {showForm ? "Hide form" : "New request"}</button>
      </div>}

      {showForm && (
        <section className="card mt-7 p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div><p className="eyebrow">NEW APPLICATION</p><h2 className="mt-1 text-[19px] font-semibold tracking-tight">Request a document</h2></div>
            <button aria-label="Close request form" className="button-icon flex h-9 w-9 items-center justify-center text-[22px] leading-none text-[#9aa49e]" onClick={() => setShowForm(false)} type="button">×</button>
          </div>
          <form className="mt-5 space-y-4" onSubmit={submitRequest}>
            <p className="rounded-lg border border-[#dce8dc] bg-[#f7faf6] px-3.5 py-3 text-[11px] leading-5 text-[#64746a]">
              Your request details and attached files are shared with authorized barangay staff for processing. Attach only documents needed.{" "}
              <Link className="font-semibold text-[#175b43] underline underline-offset-2" href="/privacy" rel="noopener noreferrer" target="_blank">Read the privacy notice</Link>.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[12px] font-semibold text-[#4d5b53]">Document type
                <select className="field mt-1.5" onChange={(event) => setType(event.target.value)} value={type}>
                  <option value="BARANGAY_CLEARANCE">Barangay clearance</option>
                  <option value="CERTIFICATE_OF_RESIDENCY">Certificate of residency</option>
                  <option value="BARANGAY_ID">Barangay ID</option>
                </select>
              </label>
              <label className="text-[12px] font-semibold text-[#4d5b53]">Purpose of request
                <input aria-describedby="request-purpose-help" className="field mt-1.5" maxLength={500} minLength={3} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Local employment requirement" required value={purpose} />
                <span className="mt-1 block text-[10px] font-normal text-[#8a958e]" id="request-purpose-help">Briefly state why you need this document (3–500 characters).</span>
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-[#4d5b53]">Supporting documents <span className="font-normal text-[#99a29c]">(optional, PDF or image · max 10 MB each)</span>
              <span className="mt-1.5 flex min-h-[76px] cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#d9e2da] bg-[#fbfcfa] px-4 text-[#78867d] hover:border-[#9eb8a3] focus-within:border-[#145b43] focus-within:ring-2 focus-within:ring-[#dce9df]">
                <UploadCloud size={18} className="shrink-0 text-[#6c947b]" />
                <span className="flex-1 text-[12px]">Choose files to attach</span>
                <input accept=".pdf,.jpg,.jpeg,.png,.webp" aria-label="Choose supporting documents" className="sr-only" multiple onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files ?? []);
                  event.currentTarget.value = "";
                  const invalidFiles = selectedFiles.filter((file) => getSupportingFileIssue(file));
                  setError(invalidFiles.map((file) => `${file.name}: ${getSupportingFileIssue(file)}`).join(" "));
                  const validFiles = selectedFiles.filter((file) => !getSupportingFileIssue(file));
                  setFiles((current) => {
                    const existing = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
                    return [...current, ...validFiles.filter((file) => {
                      const key = `${file.name}:${file.size}:${file.lastModified}`;
                      if (existing.has(key)) return false;
                      existing.add(key);
                      return true;
                    })];
                  });
                }} type="file" />
              </span>
              <span className="mt-2 block rounded-md border border-[#f0dfbd] bg-[#fff9ec] px-3 py-2 text-[10px] font-normal leading-4 text-[#896838]">Uploaded files are checked for type and size but are not malware-scanned. Only upload files you trust.</span>
            </label>
            {files.length > 0 && <ul aria-label="Selected supporting documents" className="space-y-1.5">
              {files.map((file, index) => <li className="flex items-center gap-2 rounded-md border border-[#edf0ed] bg-white px-3 py-2 text-[11px] text-[#58675d]" key={`${file.name}:${file.size}:${file.lastModified}`}>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-[10px] text-[#8a958e]">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</span>
                <button aria-label={`Remove ${file.name}`} className="button-icon flex h-8 w-8 shrink-0 items-center justify-center text-[#8a958e]" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} type="button"><X size={14} /></button>
              </li>)}
            </ul>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-4">
              <p className="max-w-[510px] text-[11px] leading-5 text-[#8a958e]">By submitting, you confirm the request information is accurate and ask the barangay to process this document request.</p>
              <button aria-busy={submitting} className="button-primary" disabled={submitting} type="submit">{submitting ? <><LoaderCircle className="animate-spin" size={15} /> Submitting…</> : <>Submit request <ArrowRight size={15} /></>}</button>
            </div>
          </form>
        </section>
      )}

      {notice && <p aria-live="polite" className="mt-4 flex items-center gap-2 rounded-lg border border-[#d9e9db] bg-[#f0f7f0] px-4 py-3 text-[12px] text-[#3d754e]"><Check size={15} />{notice}</p>}
      {error && <p aria-live="polite" className="mt-4 rounded-lg border border-[#f0d5d0] bg-[#fff6f4] px-4 py-3 text-[12px] text-[#a14d3d]">{error}</p>}

      <section className="mt-8" id="requests">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><p className="eyebrow">YOUR ACTIVITY</p><h2 className="mt-1 text-[19px] font-semibold tracking-tight">{section === "overview" ? "Recent requests" : "All requests"}</h2></div>
          <div className="flex items-center gap-2">
            {section === "overview" && <Link className="button-secondary min-h-[35px] text-[11px]" href="/requests">View all <ArrowRight size={13} /></Link>}
            <button aria-busy={loading} className="button-secondary min-h-[35px] text-[11px]" disabled={loading || submitting} onClick={() => { setLoading(true); void loadRequests(); }} type="button"><RefreshCw className={loading ? "animate-spin" : ""} size={13} /> Refresh</button>
          </div>
        </div>
        <div className="card overflow-hidden">
          {loading ? <div className="flex items-center justify-center gap-2 py-14 text-[12px] text-[#909b94]"><LoaderCircle className="animate-spin" size={16} />Loading your requests…</div>
            : totalCount === 0 ? (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff4ef] text-[#70937d]"><Files size={20} /></span>
                <p className="mt-3 text-[14px] font-semibold text-[#36473d]">Your first request starts here.</p>
                <p className="mt-1 text-[12px] text-[#8a958e]">Apply online and follow its progress right from your dashboard.</p>
                <button className="button-secondary mt-4" onClick={() => setShowForm(true)} type="button"><FilePlus2 size={14} /> Start a request</button>
              </div>
            ) : (
              <div className="divide-y divide-[#edf0ed]">
                {(section === "overview" ? requests.slice(0, 4) : requests).map((request) => (
                  <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" key={request.id}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f4ef] text-[#60836e]"><Files size={16} /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold text-[#33463b]">{documentNames[request.type] ?? request.type}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide ${statusStyles[request.status]}`}>{requestStatusLabels[request.status]}</span></div>
                        <p className="mt-1 text-[11px] text-[#87928a]">{request.referenceNo} <span className="px-1 text-[#cdd3ce]">·</span> {request.purpose}</p>
                        <p className="mt-1 text-[11px] font-medium text-[#526b5b]">{getResidentRequestNextStep(request.status, Boolean(request.remarks))}</p>
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
          {section === "requests" && !loading && totalCount > 0 && <div className="flex items-center justify-between gap-2 border-t border-[#edf0ed] px-4 py-3">
            <p className="text-[10px] text-[#89938c]">Showing {requests.length} of {totalCount}</p>
            {nextPage !== null && <button aria-busy={loadingMore} className="button-secondary min-h-[32px] text-[10px]" disabled={loadingMore} onClick={() => void loadMoreRequests()} type="button">{loadingMore ? <LoaderCircle className="animate-spin" size={13} /> : null} Load more</button>}
          </div>}
        </div>
      </section>
      <p className="mt-5 flex items-center gap-1.5 text-[10px] text-[#a1aaa3]"><ShieldCheck size={12} /> Personal records are encrypted and only used to process your barangay services.</p>
    </>
  );
}
