"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, LockKeyhole, Save } from "lucide-react";

const label = "mb-1.5 block text-[12px] font-semibold text-[#4d5b53]";
const blank = { fullName: "", dateOfBirth: "", address: "", phone: "", civilStatus: "Single" };

export function ProfileForm({ email }: { email: string }) {
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Your profile could not be loaded.");
        setForm(await response.json());
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Your profile could not be loaded.");
      } finally { setLoading(false); }
    })();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/v1/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your profile could not be updated.");
      setMessage("Your profile has been updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your profile could not be updated.");
    } finally { setBusy(false); }
  }

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-[760px]">
      <div><p className="eyebrow">ACCOUNT SETTINGS</p><h1 className="mt-2 text-[30px] font-semibold tracking-[-.04em]">Your resident profile</h1><p className="mt-1.5 text-[13px] text-[#7d8981]">Keep your information current for faster document processing.</p></div>
      <div className="card mt-6 p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-3 border-b border-[#edf0ed] pb-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff4ef] text-[#62856e]"><LockKeyhole size={16} /></span>
          <div><p className="text-[13px] font-semibold text-[#394a40]">Encrypted personal information</p><p className="mt-1 text-[11px] leading-5 text-[#8b968f]">Sensitive resident details are encrypted at rest and visible only to you and authorized staff.</p></div>
        </div>
        {loading ? <p className="flex items-center gap-2 py-8 text-[12px] text-[#859189]"><LoaderCircle className="animate-spin" size={15} />Loading profile…</p> : (
          <form className="space-y-4" onSubmit={save}>
            <label className={label}>Full name<input className="field mt-1.5" onChange={(event) => update("fullName", event.target.value)} required value={form.fullName} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Email address<input className="field mt-1.5 bg-[#f7f9f6] text-[#818c84]" disabled value={email} /></label>
              <label className={label}>Date of birth<input className="field mt-1.5" onChange={(event) => update("dateOfBirth", event.target.value)} required type="date" value={form.dateOfBirth} /></label>
            </div>
            <label className={label}>Complete address<input className="field mt-1.5" onChange={(event) => update("address", event.target.value)} required value={form.address} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Mobile number<input className="field mt-1.5" onChange={(event) => update("phone", event.target.value)} required value={form.phone} /></label>
              <label className={label}>Civil status<select className="field mt-1.5" onChange={(event) => update("civilStatus", event.target.value)} value={form.civilStatus}>{["Single", "Married", "Widowed", "Separated"].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            {error && <p aria-live="polite" className="rounded-lg bg-[#fff5f2] px-3 py-2.5 text-[12px] text-[#a14d3d]">{error}</p>}
            {message && <p aria-live="polite" className="flex items-center gap-2 rounded-lg bg-[#eff7ef] px-3 py-2.5 text-[12px] text-[#42764f]"><Check size={14} />{message}</p>}
            <div className="flex justify-end border-t border-[#edf0ed] pt-4"><button className="button-primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />} Save profile</button></div>
          </form>
        )}
      </div>
      <p className="mt-3 px-1 text-[10px] leading-5 text-[#a0aaa3]">To change your email address or password, contact the barangay office.</p>
    </div>
  );
}
