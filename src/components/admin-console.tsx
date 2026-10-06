"use client";

import { useEffect, useState } from "react";
import { Activity, Check, CircleAlert, FileCog, LoaderCircle, LockKeyhole, Plus, RefreshCw, ShieldCheck, UserCheck, UserRoundX, Users } from "lucide-react";

type Staff = { id: string; email: string; isActive: boolean; createdAt: string };
type Settings = {
  name: string;
  municipality: string;
  province: string;
  captainName: string | null;
  officeAddress: string | null;
  contactNumber: string | null;
  certificateValidityDays: number;
  sealObjectKey: string | null;
  signatureObjectKey: string | null;
};
type Audit = { id: string; action: string; entity: string; createdAt: string; actor: { email: string } | null };
type Verification = { id: string; isAuthentic: boolean; tokenHash: string; verifiedAt: string };

const emptySettings: Settings = {
  name: "", municipality: "", province: "", captainName: "", officeAddress: "", contactNumber: "",
  certificateValidityDays: 365, sealObjectKey: null, signatureObjectKey: null,
};
const label = "mb-1.5 block text-[11px] font-semibold text-[#536157]";

export function AdminConsole({ email }: { email: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const [staffResponse, settingsResponse, auditResponse] = await Promise.all([
        fetch("/api/v1/admin/staff", { cache: "no-store" }),
        fetch("/api/v1/admin/settings", { cache: "no-store" }),
        fetch("/api/v1/admin/audit", { cache: "no-store" }),
      ]);
      const [staffData, settingsData, auditData] = await Promise.all([staffResponse.json(), settingsResponse.json(), auditResponse.json()]);
      for (const response of [staffResponse, settingsResponse, auditResponse]) {
        if (!response.ok) throw new Error("The administration data could not be loaded.");
      }
      setStaff(staffData.staff);
      setSettings(settingsData);
      setAudit(auditData.audit);
      setVerifications(auditData.verifications);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The administration data could not be loaded.");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    void Promise.all([
      fetch("/api/v1/admin/staff", { cache: "no-store" }),
      fetch("/api/v1/admin/settings", { cache: "no-store" }),
      fetch("/api/v1/admin/audit", { cache: "no-store" }),
    ])
      .then(async ([staffResponse, settingsResponse, auditResponse]) => {
        const [staffData, settingsData, auditData] = await Promise.all([
          staffResponse.json(), settingsResponse.json(), auditResponse.json(),
        ]);
        if (!staffResponse.ok || !settingsResponse.ok || !auditResponse.ok) {
          throw new Error("The administration data could not be loaded.");
        }
        setStaff(staffData.staff);
        setSettings(settingsData);
        setAudit(auditData.audit);
        setVerifications(auditData.verifications);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The administration data could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/admin/staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail, password: staffPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The staff account could not be created.");
      setStaffEmail("");
      setStaffPassword("");
      setNotice("Staff account created. Share the temporary password securely with the new staff member.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The staff account could not be created.");
    } finally { setBusy(false); }
  }

  async function toggleStaff(member: Staff) {
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/staff/${member.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The account status could not be changed.");
      setNotice(`Staff account ${member.isActive ? "disabled" : "enabled"}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The account status could not be changed.");
    }
  }

  async function uploadAsset(type: "seal" | "signature", file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const sign = await fetch("/api/v1/admin/settings/assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
      });
      const signingResult = await sign.json();
      if (!sign.ok) throw new Error(signingResult.error ?? "The upload could not be started.");
      const upload = await fetch(signingResult.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!upload.ok) throw new Error("The image could not be uploaded to secure storage.");
      setSettings((current) => ({ ...current, [type === "seal" ? "sealObjectKey" : "signatureObjectKey"]: signingResult.objectKey }));
      setNotice(`${type === "seal" ? "Seal" : "Signature"} image uploaded. Save the certificate settings to apply it.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The image could not be uploaded.");
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/v1/admin/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Settings could not be saved.");
      setSettings(result);
      setNotice("Barangay and certificate settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Settings could not be saved.");
    } finally { setBusy(false); }
  }

  const update = (key: keyof Settings, value: string | number) => setSettings((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">SYSTEM ADMINISTRATION</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em] sm:text-[34px]">Barangay settings</h1><p className="mt-1.5 text-[13px] text-[#7d8981]">Manage staff access, official details, and issued-document records.</p></div>
        <button className="button-secondary" onClick={() => { setLoading(true); void load(); }} type="button"><RefreshCw size={14} /> Refresh data</button>
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#e5ebe4] bg-[#f1f5f0] px-4 py-3">
        <LockKeyhole className="mt-0.5 shrink-0 text-[#63836e]" size={15} />
        <p className="text-[11px] leading-5 text-[#66766b]"><span className="font-semibold">Signed in as {email}.</span> Administrative actions and document verification scans are recorded for review.</p>
      </div>
      {error && <p aria-live="polite" className="mt-4 rounded-lg border border-[#f0d5d0] bg-[#fff6f4] px-4 py-3 text-[12px] text-[#a14d3d]">{error}</p>}
      {notice && <p aria-live="polite" className="mt-4 flex items-center gap-2 rounded-lg border border-[#d9e9db] bg-[#f0f7f0] px-4 py-3 text-[12px] text-[#3d754e]"><Check size={14} />{notice}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Staff accounts", value: staff.length, icon: Users },
          { label: "Verification scans", value: verifications.length, icon: ShieldCheck },
          { label: "Logged admin actions", value: audit.length, icon: Activity },
        ].map(({ label: title, value, icon: Icon }) => <div className="card flex items-center gap-3 p-4" key={title}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff4ef] text-[#60836e]"><Icon size={16} /></span><div><p className="text-[10px] text-[#87928a]">{title}</p><p className="mt-0.5 text-[21px] font-semibold text-[#304238]">{loading ? "—" : value}</p></div></div>)}
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">
        <section className="card p-5" id="settings">
          <div className="mb-5 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff4ef] text-[#60836e]"><FileCog size={17} /></span><div><p className="eyebrow">CERTIFICATE IDENTITY</p><h2 className="mt-1 text-[16px] font-semibold">Official barangay details</h2></div></div>
          {loading ? <p className="py-8 text-[11px] text-[#909b94]"><LoaderCircle className="mr-2 inline animate-spin" size={14} />Loading settings…</p> : <form className="space-y-3.5" onSubmit={saveSettings}>
            <label className={label}>Barangay name<input className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => update("name", event.target.value)} required value={settings.name} /></label>
            <div className="grid grid-cols-2 gap-3"><label className={label}>Municipality / city<input className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => update("municipality", event.target.value)} required value={settings.municipality} /></label><label className={label}>Province<input className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => update("province", event.target.value)} required value={settings.province} /></label></div>
            <label className={label}>Punong Barangay<input className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => update("captainName", event.target.value)} value={settings.captainName ?? ""} /></label>
            <label className={label}>Office address<input className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => update("officeAddress", event.target.value)} value={settings.officeAddress ?? ""} /></label>
            <div className="grid grid-cols-2 gap-3"><label className={label}>Contact number<input className="field mt-1.5 min-h-[38px] text-[11px]" onChange={(event) => update("contactNumber", event.target.value)} value={settings.contactNumber ?? ""} /></label><label className={label}>Certificate validity (days)<input className="field mt-1.5 min-h-[38px] text-[11px]" max={3650} min={1} onChange={(event) => update("certificateValidityDays", Number(event.target.value))} required type="number" value={settings.certificateValidityDays} /></label></div>
            <div className="grid grid-cols-2 gap-3">
              {(["seal", "signature"] as const).map((type) => <label className="flex min-h-[70px] cursor-pointer flex-col justify-center rounded-lg border border-dashed border-[#d9e2da] px-3 py-2.5 hover:border-[#9eb8a3]" key={type}><span className="text-[10px] font-semibold text-[#536157]">Official {type} <span className="font-normal text-[#9aa49d]">· PNG, max 2 MB</span></span><span className="mt-1 truncate text-[9px] text-[#91a098]">{settings[type === "seal" ? "sealObjectKey" : "signatureObjectKey"] ? "Image uploaded ✓" : "No image added"}</span><input accept="image/png" className="sr-only" onChange={(event) => void uploadAsset(type, event.target.files?.[0])} type="file" /></label>)}
            </div>
            <div className="flex justify-end border-t border-[#edf0ed] pt-3"><button className="button-primary min-h-[37px] text-[11px]" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />} Save certificate settings</button></div>
          </form>}
        </section>

        <div className="space-y-4">
          <section className="card p-5" id="staff">
            <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff4ef] text-[#60836e]"><Users size={17} /></span><div><p className="eyebrow">ACCESS CONTROL</p><h2 className="mt-1 text-[16px] font-semibold">Staff accounts</h2></div></div>
            <form className="space-y-2.5 rounded-lg bg-[#f8faf7] p-3" onSubmit={createStaff}>
              <p className="text-[10px] font-semibold text-[#69766d]">Add a staff member</p>
              <input autoComplete="off" className="field min-h-[37px] text-[11px]" onChange={(event) => setStaffEmail(event.target.value)} placeholder="Staff email address" required type="email" value={staffEmail} />
              <div className="flex gap-2"><input autoComplete="new-password" className="field min-h-[37px] min-w-0 text-[11px]" minLength={12} onChange={(event) => setStaffPassword(event.target.value)} placeholder="Temporary password (12+ chars)" required type="password" value={staffPassword} /><button className="button-primary min-h-[37px] shrink-0 px-3 text-[10px]" disabled={busy} type="submit"><Plus size={13} /> Create</button></div>
            </form>
            <div className="mt-3 divide-y divide-[#edf0ed]">
              {staff.length === 0 && !loading ? <p className="py-5 text-center text-[10px] text-[#9aa49d]">No staff accounts yet.</p> : staff.map((member) => <div className="flex items-center justify-between gap-2 py-3" key={member.id}><span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-[#4b5a50]">{member.email}</span><span className={`mt-1 inline-flex items-center gap-1 text-[9px] ${member.isActive ? "text-[#598064]" : "text-[#a46b5c]"}`}><span className={`h-1.5 w-1.5 rounded-full ${member.isActive ? "bg-[#64a477]" : "bg-[#ca8272]"}`} />{member.isActive ? "Active" : "Disabled"}</span></span><button className="button-secondary min-h-[30px] px-2.5 text-[9px]" onClick={() => void toggleStaff(member)} type="button">{member.isActive ? <><UserRoundX size={12} /> Disable</> : <><UserCheck size={12} /> Enable</>}</button></div>)}
            </div>
            <p className="mt-2 text-[9px] leading-4 text-[#9aa49d]">Share initial passwords through a secure channel and ask staff to update them.</p>
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf0ed] p-4"><div><p className="eyebrow">SECURITY & COMPLIANCE</p><h2 className="mt-1 text-[15px] font-semibold">Recent activity</h2></div><CircleAlert className="text-[#83978a]" size={16} /></div>
            <div className="max-h-[300px] divide-y divide-[#f0f2ef] overflow-y-auto">
              {[...audit.map((item) => ({ id: item.id, label: item.action.replaceAll("_", " ").toLowerCase(), who: item.actor?.email ?? "System", date: item.createdAt, valid: true })),
                ...verifications.map((item) => ({ id: item.id, label: item.isAuthentic ? "document verified" : "invalid scan", who: `Token …${item.tokenHash.slice(-6)}`, date: item.verifiedAt, valid: item.isAuthentic }))]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)
                .map((item) => <div className="flex items-start gap-2.5 px-4 py-3" key={item.id}><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${item.valid ? "bg-[#70a47e]" : "bg-[#d18370]"}`} /><span className="min-w-0 flex-1"><span className="block text-[10px] font-medium capitalize text-[#536157]">{item.label}</span><span className="mt-1 block truncate text-[9px] text-[#939d96]">{item.who}</span></span><span className="shrink-0 text-[9px] text-[#a0aaa3]">{new Date(item.date).toLocaleDateString("en-PH")}</span></div>)}
              {!loading && !audit.length && !verifications.length && <p className="px-4 py-8 text-center text-[10px] text-[#9aa49d]">No recorded activity yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
