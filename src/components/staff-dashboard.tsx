"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, Clock3, FileCheck2, Files, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRound, X } from "lucide-react";

type Row = {
  id: string;
  referenceNo: string;
  type: string;
  status: "PENDING" | "IN_REVIEW" | "ISSUED" | "REJECTED" | "APPROVED";
  purpose: string;
  remarks: string | null;
  submittedAt: string;
  uploads: { id: string; fileName: string; status: string; sizeBytes: number }[];
  resident?: { fullName: string; address: string; phone: string; email: string; dateOfBirth: string; civilStatus: string };
};

const titles: Record<string, string> = {
  BARANGAY_CLEARANCE: "Barangay clearance",
  CERTIFICATE_OF_RESIDENCY: "Certificate of residency",
  BARANGAY_ID: "Barangay ID",
};
const badge: Record<Row["status"], string> = {
  PENDING: "bg-[#fff4df] text-[#986c21]",
  IN_REVIEW: "bg-[#edf3fb] text-[#55739b]",
  APPROVED: "bg-[#e8f3ec] text-[#38704e]",
  ISSUED: "bg-[#e8f3ec] text-[#38704e]",
  REJECTED: "bg-[#fcece8] text-[#a45442]",
};

type StaffProfile = { fullName: string; jobTitle: string; phone: string };
type RequestPage = {
  requests: Row[];
  counts: Record<string, number>;
  totalCount: number;
  nextPage: number | null;
};

export function StaffDashboard({
  staffName,
  initialProfile,
  section = "dashboard",
}: {
  staffName: string;
  initialProfile: StaffProfile;
  section?: "dashboard" | "profile";
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [profile, setProfile] = useState(initialProfile);
  const [selected, setSelected] = useState<Row | null>(null);
  const [remarks, setRemarks] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hasDisplayName = !staffName.includes("@");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/requests?page=0", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Requests could not be loaded.");
      }
      const body = await response.json() as RequestPage;
      setRows(body.requests);
      setNextPage(body.nextPage);
      setTotalCount(body.totalCount);
      setStatusCounts(body.counts);
      setSelected((previous) => previous ? body.requests.find((row: Row) => row.id === previous.id) ?? null : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Requests could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (section === "profile") return;
    void fetch("/api/v1/requests?page=0", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Requests could not be loaded.");
        return body as RequestPage;
      })
      .then((body) => {
        setRows(body.requests);
        setNextPage(body.nextPage);
        setTotalCount(body.totalCount);
        setStatusCounts(body.counts);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Requests could not be loaded."))
      .finally(() => setLoading(false));
  }, [section]);

  async function loadMore() {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/requests?page=${nextPage}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "More requests could not be loaded.");
      }
      const body = await response.json() as RequestPage;
      setRows((current) => {
        const existingIds = new Set(current.map((row) => row.id));
        return [...current, ...body.requests.filter((row) => !existingIds.has(row.id))];
      });
      setNextPage(body.nextPage);
      setTotalCount(body.totalCount);
      setStatusCounts(body.counts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "More requests could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  const counts = {
    pending: statusCounts.PENDING ?? 0,
    review: statusCounts.IN_REVIEW ?? 0,
    issued: statusCounts.ISSUED ?? 0,
    rejected: statusCounts.REJECTED ?? 0,
  };
  const visible = rows.filter((row) => (filter === "ALL" || row.status === filter) &&
    (!search || `${row.referenceNo} ${row.resident?.fullName ?? ""} ${row.type}`.toLowerCase().includes(search.toLowerCase())));

  async function process(action: "review" | "issue" | "reject") {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/requests/${selected.id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "review" ? { action } : { action, remarks }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "This request could not be updated.");
      setNotice(action === "issue" ? `Document ${body.referenceNo} issued with QR verification.` : action === "reject" ? "Request declined and resident notified in their portal." : "Request moved into review.");
      setRemarks("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This request could not be updated.");
    } finally { setBusy(false); }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/staff/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Your staff profile could not be saved.");
      setNotice("Your staff profile has been saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your staff profile could not be saved.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">{section === "dashboard" ? "REQUEST PROCESSING" : "STAFF WORKSPACE"}</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em] sm:text-[34px]">{section === "dashboard" ? hasDisplayName ? `Good day, ${staffName.split(" ")[0]}.` : "Request queue" : "Your staff profile"}</h1><p className="mt-1.5 text-[13px] text-[#7d8981]">{section === "dashboard" ? "Review resident requests and issue verified documents." : "Manage the staff details shown in your workspace."}</p></div>
        {section === "dashboard" && <button aria-busy={loading} className="button-secondary" disabled={loading || busy} onClick={() => { setLoading(true); void refresh(); }} type="button"><RefreshCw className={loading ? "animate-spin" : ""} size={14} /> Refresh queue</button>}
      </div>

      {section === "dashboard" && <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { title: "Awaiting review", count: counts.pending, icon: Clock3, tone: "text-[#b98532]" },
          { title: "In review", count: counts.review, icon: Search, tone: "text-[#607fa4]" },
          { title: "Documents issued", count: counts.issued, icon: FileCheck2, tone: "text-[#508064]" },
          { title: "Declined", count: counts.rejected, icon: Files, tone: "text-[#a66758]" },
        ].map(({ title, count, icon: Icon, tone }) => <div className="card flex items-center gap-3 p-4" key={title}><span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[#f2f5f1] ${tone}`}><Icon size={17} /></span><div><p className="text-[10px] text-[#87928a]">{title}</p><p className="mt-0.5 text-[22px] font-semibold text-[#304238]">{loading ? "—" : count}</p></div></div>)}
      </div>}

      {section === "profile" && <section className="card mt-6 max-w-[820px] p-5 sm:p-7">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff4ef] text-[#60836e]"><UserRound size={17} /></span>
          <div><p className="eyebrow">YOUR ACCOUNT</p><h2 className="mt-1 text-[16px] font-semibold">Staff profile</h2><p className="mt-1 text-[11px] text-[#87928a]">Add the details shown in your staff workspace.</p></div>
        </div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
          <label className="text-[11px] font-semibold text-[#536157]">Full name
            <input autoComplete="name" className="field mt-1.5 min-h-[38px] text-[11px]" maxLength={150} minLength={2} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} required value={profile.fullName} />
          </label>
          <label className="text-[11px] font-semibold text-[#536157]">Job title
            <input autoComplete="organization-title" className="field mt-1.5 min-h-[38px] text-[11px]" maxLength={150} minLength={2} onChange={(event) => setProfile((current) => ({ ...current, jobTitle: event.target.value }))} placeholder="e.g. Barangay Secretary" required value={profile.jobTitle} />
          </label>
          <label className="text-[11px] font-semibold text-[#536157]">Contact number
            <input autoComplete="tel" className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} pattern="\+?[0-9 ()-]{7,20}" placeholder="+63 9XX XXX XXXX" required value={profile.phone} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-4 sm:col-span-2">
            <p className="text-[10px] text-[#87928a]">Your name and contact number are encrypted in storage.</p>
            <button className="button-primary min-h-[36px] text-[10px]" disabled={savingProfile} type="submit">{savingProfile ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />} Save profile</button>
          </div>
        </form>
      </section>}

      {notice && <p aria-live="polite" className="mt-4 flex items-center gap-2 rounded-lg border border-[#d9e9db] bg-[#f0f7f0] px-4 py-3 text-[12px] text-[#3d754e]"><Check size={14} />{notice}</p>}
      {error && <p aria-live="polite" className="mt-4 rounded-lg border border-[#f0d5d0] bg-[#fff6f4] px-4 py-3 text-[12px] text-[#a14d3d]">{error}</p>}

      {section === "dashboard" && <div className="mt-7 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.78fr)]">
        <section className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ed] p-4">
            <div><p className="eyebrow">APPLICATIONS</p><h2 className="mt-1 text-[16px] font-semibold">Request queue</h2></div>
            <label className="relative min-w-[150px] flex-1 sm:max-w-[190px]"><Search className="absolute left-2.5 top-2.5 text-[#9aa49d]" size={14} /><input aria-label="Search requests" className="field min-h-[34px] pl-8 text-[11px]" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or ref." value={search} /></label>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-[#edf0ed] px-3 py-2">
            {[["ALL", "All"], ["PENDING", "Pending"], ["IN_REVIEW", "In review"], ["ISSUED", "Issued"], ["REJECTED", "Declined"]].map(([value, label]) => (
              <button className={`shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${filter === value ? "bg-[#eaf2eb] text-[#175b43]" : "text-[#828d86] hover:bg-[#f6f8f5]"}`} key={value} onClick={() => setFilter(value)} type="button">{label}</button>
            ))}
          </div>
          {loading ? <div className="flex justify-center py-12"><LoaderCircle className="animate-spin text-[#83958a]" size={17} /></div>
            : visible.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f4ef] text-[#799481]"><Files size={18} /></span><p className="mt-3 text-[12px] font-semibold text-[#526057]">No matching requests</p><p className="mt-1 text-[10px] text-[#9ba49e]">Try another filter or check back later.</p></div>
              : <div className="max-h-[610px] divide-y divide-[#edf0ed] overflow-y-auto">
                {visible.map((row) => <button aria-pressed={selected?.id === row.id} className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#fafbf9] ${selected?.id === row.id ? "bg-[#f5f8f4]" : ""}`} key={row.id} onClick={() => { setSelected(row); setRemarks(""); }} type="button">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eff4ef] text-[#638470]"><Files size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="truncate text-[11px] font-semibold text-[#35463b]">{row.resident?.fullName ?? "Resident"}</span><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${badge[row.status]}`}>{row.status.replaceAll("_", " ")}</span></span><span className="mt-1 block truncate text-[10px] text-[#89938c]">{titles[row.type] ?? row.type} · {row.referenceNo}</span><span className="mt-1 block text-[9px] text-[#a1aaa3]">{new Date(row.submittedAt).toLocaleDateString("en-PH")}</span></span><ArrowRight className="mt-2 shrink-0 text-[#a5afa8]" size={14} />
                </button>)}
              </div>}
          {!loading && totalCount > 0 && <div className="flex items-center justify-between gap-2 border-t border-[#edf0ed] px-4 py-3">
            <p className="text-[10px] text-[#89938c]">Showing {rows.length} of {totalCount}</p>
            {nextPage !== null && <button aria-busy={loadingMore} className="button-secondary min-h-[32px] text-[10px]" disabled={loadingMore} onClick={() => void loadMore()} type="button">{loadingMore ? <LoaderCircle className="animate-spin" size={13} /> : null} Load more</button>}
          </div>}
        </section>

        <section className="card overflow-hidden">
          {selected ? <>
            <div className="border-b border-[#edf0ed] bg-[#fbfcfa] p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="eyebrow">REQUEST DETAILS</p><h2 className="mt-1 text-[16px] font-semibold leading-5">{titles[selected.type] ?? selected.type}</h2></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${badge[selected.status]}`}>{selected.status.replaceAll("_", " ")}</span></div>
              <p className="mt-2 text-[10px] text-[#89938c]">{selected.referenceNo}</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-start gap-2"><UserRound className="mt-0.5 shrink-0 text-[#75917f]" size={14} /><div><p className="text-[11px] font-semibold text-[#425348]">{selected.resident?.fullName ?? "Resident"}</p><p className="mt-0.5 break-all text-[10px] text-[#8c978f]">{selected.resident?.email}</p></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[9px] uppercase tracking-wide text-[#9aa49d]">Address</p><p className="mt-1 text-[10px] leading-4 text-[#57665c]">{selected.resident?.address ?? "—"}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-[#9aa49d]">Contact</p><p className="mt-1 text-[10px] text-[#57665c]">{selected.resident?.phone ?? "—"}</p><p className="mt-1 text-[9px] text-[#9aa49d]">DOB · {selected.resident?.dateOfBirth ?? "—"}</p></div>
              </div>
              <div className="rounded-lg bg-[#f7f9f6] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-[#9aa49d]">Stated purpose</p><p className="mt-1.5 text-[11px] leading-5 text-[#506056]">{selected.purpose}</p></div>
              <div>
                <p className="mb-2 text-[10px] font-semibold text-[#68756d]">Supporting requirements</p>
                {selected.uploads.length === 0 ? <p className="text-[10px] text-[#9aa49d]">No files attached.</p> : <>
                  <p className="mb-2 rounded-md border border-[#f0dfbd] bg-[#fff9ec] px-2.5 py-2 text-[9px] leading-4 text-[#896838]">Files are not malware-scanned. Open only if you trust the resident and file.</p>
                  <div className="space-y-1.5">{selected.uploads.map((file) => <a className="flex items-center justify-between rounded-md border border-[#edf0ed] px-2.5 py-2 text-[10px] text-[#58675d] hover:bg-[#f8faf7]" href={`/api/v1/uploads/${file.id}/download`} key={file.id}><span className="min-w-0 truncate">{file.fileName}{file.status === "COMPLETE" && <span className="ml-2 rounded bg-[#fff1d9] px-1 py-0.5 text-[8px] font-semibold text-[#896838]">NOT SCANNED</span>}</span><ArrowDownToLine className="ml-2 shrink-0 text-[#789181]" size={13} /></a>)}</div>
                </>}
              </div>
              {selected.remarks && <div className="rounded-lg bg-[#fff8ed] p-3 text-[10px] text-[#896838]">Staff remarks: {selected.remarks}</div>}
              {["PENDING", "IN_REVIEW"].includes(selected.status) && <>
                <label className="block text-[10px] font-semibold text-[#68756d]">Review note <span className="font-normal text-[#9aa49d]">(required if declining)</span><textarea className="field mt-1.5 min-h-[66px] resize-y text-[11px]" onChange={(event) => setRemarks(event.target.value)} placeholder="Add a note for the resident…" value={remarks} /></label>
                <div className="grid grid-cols-2 gap-2">
                  {selected.status === "PENDING" && <button aria-busy={busy} className="button-secondary min-h-[36px] text-[10px]" disabled={busy} onClick={() => void process("review")} type="button">{busy ? <LoaderCircle className="animate-spin" size={13} /> : <Search size={13} />} Start review</button>}
                  <button className="button-danger min-h-[36px] text-[10px]" disabled={busy || remarks.trim().length < 3} onClick={() => void process("reject")} type="button"><X size={13} /> Decline</button>
                  <button aria-busy={busy} className="button-primary col-span-2 min-h-[37px] text-[10px]" disabled={busy} onClick={() => void process("issue")} type="button">{busy ? <LoaderCircle className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Approve & issue with QR</button>
                </div>
              </>}
              {selected.status === "ISSUED" && <div className="flex items-center gap-2 rounded-lg bg-[#eff7ef] p-3 text-[10px] text-[#42764f]"><FileCheck2 size={15} /> Digitally verifiable certificate issued.</div>}
            </div>
          </> : <div className="flex min-h-[280px] flex-col items-center justify-center px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f4ef] text-[#799481]"><Files size={18} /></span><p className="mt-3 text-[12px] font-semibold text-[#526057]">Select a request to review</p><p className="mt-1 max-w-[210px] text-[10px] leading-4 text-[#9ba49e]">Resident details and supporting documents will appear here.</p></div>}
        </section>
      </div>}
      <p className="mt-5 flex items-center gap-1.5 text-[10px] text-[#a1aaa3]"><ShieldCheck size={12} /> All staff actions are recorded in the system audit log.</p>
    </>
  );
}
