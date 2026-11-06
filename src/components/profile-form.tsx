"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, LoaderCircle, LockKeyhole, Save } from "lucide-react";
import { readJsonResponse } from "@/lib/client-response";

const label = "mb-1.5 block text-[12px] font-semibold text-[#4d5b53]";
const blank = {
  firstName: "", middleName: "", lastName: "", suffix: "", dateOfBirth: "",
  houseNumber: "", street: "", purokSitio: "", barangay: "",
  cityMunicipality: "", province: "", postalCode: "",
  phone: "", civilStatus: "Single", gender: "",
};
type ProfileData = typeof blank & { address?: string; legacyAddress?: string };

export function ProfileForm({ email }: { email: string }) {
  const [form, setForm] = useState(blank);
  const [legacyAddress, setLegacyAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/v1/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Your profile could not be loaded.");
        const profile = await readJsonResponse<ProfileData>(response, "Your profile could not be loaded.");
        setForm({
          firstName: profile.firstName ?? "",
          middleName: profile.middleName ?? "",
          lastName: profile.lastName ?? "",
          suffix: profile.suffix ?? "",
          dateOfBirth: profile.dateOfBirth ?? "",
          houseNumber: profile.houseNumber ?? "",
          street: profile.street ?? "",
          purokSitio: profile.purokSitio ?? "",
          barangay: profile.barangay ?? "",
          cityMunicipality: profile.cityMunicipality ?? "",
          province: profile.province ?? "",
          postalCode: profile.postalCode ?? "",
          phone: profile.phone ?? "",
          civilStatus: profile.civilStatus ?? "Single",
          gender: profile.gender ?? "",
        });
        setLegacyAddress(profile.legacyAddress ?? "");
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
      const result = await readJsonResponse<{ error?: string }>(response, "Your profile could not be updated.");
      if (!response.ok) throw new Error(result.error ?? "Your profile could not be updated.");
      setLegacyAddress("");
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
          <div><p className="text-[13px] font-semibold text-[#394a40]">Encrypted personal information</p><p className="mt-1 text-[11px] leading-5 text-[#8b968f]">Sensitive resident details are encrypted at rest and visible only to you and authorized staff. <Link className="font-semibold text-[#175b43] underline underline-offset-2" href="/privacy" rel="noopener noreferrer" target="_blank">Read the privacy notice</Link>.</p></div>
        </div>
        {loading ? <p className="flex items-center gap-2 py-8 text-[12px] text-[#859189]"><LoaderCircle className="animate-spin" size={15} />Loading profile…</p> : (
          <form className="space-y-4" onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>First Name:<input autoComplete="given-name" className="field mt-1.5" onChange={(event) => update("firstName", event.target.value)} required value={form.firstName} /></label>
              <label className={label}>Last Name:<input autoComplete="family-name" className="field mt-1.5" onChange={(event) => update("lastName", event.target.value)} required value={form.lastName} /></label>
            </div>
            <label className={label}>Middle Name: <span className="font-normal text-[#8b968f]">(optional)</span><input autoComplete="additional-name" className="field mt-1.5" onChange={(event) => update("middleName", event.target.value)} value={form.middleName} /></label>
            <label className={label}>Suffix <span className="font-normal text-[#8b968f]">(optional; choose or type your own)</span><input autoComplete="honorific-suffix" className="field mt-1.5" list="profile-suffix-options" maxLength={20} onChange={(event) => update("suffix", event.target.value)} value={form.suffix} /><datalist id="profile-suffix-options">{["Jr.", "Sr.", "II", "III", "IV", "V"].map((suffix) => <option key={suffix} value={suffix} />)}</datalist></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Email address<input className="field mt-1.5 bg-[#f7f9f6] text-[#818c84]" disabled value={email} /></label>
              <label className={label}>Date of birth<input className="field mt-1.5" onChange={(event) => update("dateOfBirth", event.target.value)} required type="date" value={form.dateOfBirth} /></label>
            </div>
            {legacyAddress && <p className="rounded-lg bg-[#f7f9f6] px-3 py-2.5 text-[11px] leading-5 text-[#6f7c73]">Previously saved address: {legacyAddress}. Please fill in the detailed address fields below.</p>}
            <fieldset className="space-y-3 rounded-xl border border-[#e8ede8] p-3.5">
              <legend className="px-1 text-[12px] font-semibold text-[#4d5b53]">Complete home address</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>House / Building / Unit No.:<input autoComplete="address-line1" className="field mt-1.5" onChange={(event) => update("houseNumber", event.target.value)} required value={form.houseNumber} /></label>
                <label className={label}>Street:<input className="field mt-1.5" onChange={(event) => update("street", event.target.value)} required value={form.street} /></label>
                <label className={label}>Purok / Sitio:<input className="field mt-1.5" onChange={(event) => update("purokSitio", event.target.value)} required value={form.purokSitio} /></label>
                <label className={label}>Barangay:<input autoComplete="address-level3" className="field mt-1.5" onChange={(event) => update("barangay", event.target.value)} required value={form.barangay} /></label>
                <label className={label}>City / Municipality:<input autoComplete="address-level2" className="field mt-1.5" onChange={(event) => update("cityMunicipality", event.target.value)} required value={form.cityMunicipality} /></label>
                <label className={label}>Province:<input autoComplete="address-level1" className="field mt-1.5" onChange={(event) => update("province", event.target.value)} required value={form.province} /></label>
                <label className={label}>Postal code:<input autoComplete="postal-code" className="field mt-1.5" inputMode="numeric" maxLength={4} onChange={(event) => update("postalCode", event.target.value)} pattern="[0-9]{4}" required value={form.postalCode} /></label>
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Mobile number<input className="field mt-1.5" onChange={(event) => update("phone", event.target.value)} required value={form.phone} /></label>
              <label className={label}>Civil status<select className="field mt-1.5" onChange={(event) => update("civilStatus", event.target.value)} value={form.civilStatus}>{["Single", "Married", "Widowed", "Separated"].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            <label className={label}>Gender<select className="field mt-1.5" onChange={(event) => update("gender", event.target.value)} required value={form.gender}><option disabled value="">Select gender</option>{["Male", "Female"].map((value) => <option key={value}>{value}</option>)}</select></label>
            {error && <p aria-live="polite" className="rounded-lg bg-[#fff5f2] px-3 py-2.5 text-[12px] text-[#a14d3d]">{error}</p>}
            {message && <p aria-live="polite" className="flex items-center gap-2 rounded-lg bg-[#eff7ef] px-3 py-2.5 text-[12px] text-[#42764f]"><Check size={14} />{message}</p>}
            <div className="flex justify-end border-t border-[#edf0ed] pt-4"><button aria-busy={busy} className="button-primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />} Save profile</button></div>
          </form>
        )}
      </div>
      <p className="mt-3 px-1 text-[10px] leading-5 text-[#a0aaa3]">To change your email address or password, contact the barangay office.</p>
    </div>
  );
}
