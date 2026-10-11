"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";

const inputClass = "field";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-[#4d5b53]";

function AuthFormContent({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: "", password: "", fullName: "", dateOfBirth: "", address: "", phone: "", civilStatus: "Single",
  });
  const isRegister = mode === "register";
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const safeNext = searchParams.get("next");
  let nextPath = "/";
  if (safeNext && safeNext.startsWith("/") && !safeNext.startsWith("//") && !safeNext.includes("\\")) {
    try {
      const destination = new URL(safeNext, "https://konek.invalid");
      if (destination.origin === "https://konek.invalid") {
        nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
      }
    } catch {
      nextPath = "/";
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isRegister && step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { ...form, privacyAcknowledged } : { email: form.email, password: form.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We could not complete that request.");
      const destination = result.role === "ADMIN" ? "/admin"
        : result.role === "STAFF" ? "/staff"
          : nextPath;
      router.replace(destination);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A connection error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="mb-7 flex items-center gap-2.5" href="/login">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#145b43] text-sm font-semibold text-white">k.</span>
          <span className="text-[14px] font-semibold text-[#253a30]">konek<span className="font-normal">barangay</span></span>
        </Link>
        <div className="mb-6">
            <p className="eyebrow">{isRegister ? `Create your account · Step ${step} of 2` : "Welcome back"}</p>
            <h2 className="mt-2 text-[29px] font-semibold tracking-[-.035em] text-[#23362d]">
              {isRegister ? (step === 1 ? "Let’s get you set up." : "A little about you.") : "Sign in to continue."}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#818b85]">
              {isRegister ? "Access secure, convenient barangay services online." : "Manage your requests and documents in one place."}
            </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
            {isRegister && step === 2 && (
              <>
                <label className={labelClass}>Full name<input autoComplete="name" className={`${inputClass} mt-1.5`} onChange={(event) => update("fullName", event.target.value)} placeholder="As shown on your ID" required value={form.fullName} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>Date of birth<input className={`${inputClass} mt-1.5`} onChange={(event) => update("dateOfBirth", event.target.value)} required type="date" value={form.dateOfBirth} /></label>
                  <label className={labelClass}>Civil status<select className={`${inputClass} mt-1.5`} onChange={(event) => update("civilStatus", event.target.value)} value={form.civilStatus}>
                    {["Single", "Married", "Widowed", "Separated"].map((value) => <option key={value}>{value}</option>)}
                  </select></label>
                </div>
                <label className={labelClass}>Complete address<input autoComplete="street-address" className={`${inputClass} mt-1.5`} onChange={(event) => update("address", event.target.value)} placeholder="House no., street, sitio / purok" required value={form.address} /></label>
                <label className={labelClass}>Mobile number<input autoComplete="tel" className={`${inputClass} mt-1.5`} onChange={(event) => update("phone", event.target.value)} placeholder="+63 9XX XXX XXXX" required value={form.phone} /></label>
                <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-5 text-[#69766e]">
                  <input checked={privacyAcknowledged} className="mt-1 accent-[#145b43]" onChange={(event) => setPrivacyAcknowledged(event.target.checked)} required type="checkbox" />
                  <span>I have read the <Link className="font-semibold text-[#145b43] underline" href="/privacy" rel="noopener noreferrer" target="_blank">Barangay Privacy Notice</Link> and understand how my information will be used.</span>
                </label>
              </>
            )}
            {(!isRegister || step === 1) && (
              <>
                <label className={labelClass}>Email address<input autoComplete="email" className={`${inputClass} mt-1.5`} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" required type="email" value={form.email} /></label>
                <label className={labelClass}>Password
                  <span className="relative mt-1.5 block">
                    <input autoComplete={isRegister ? "new-password" : "current-password"} className={`${inputClass} pr-11`} onChange={(event) => update("password", event.target.value)} placeholder={isRegister ? "At least 12 characters" : "Enter your password"} required type={showPassword ? "text" : "password"} value={form.password} />
                    <button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#909a94]" onClick={() => setShowPassword(!showPassword)} type="button">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
                {isRegister && step === 1 && <p className="-mt-2 text-[11px] text-[#909a94]">Use 12 or more characters to protect your account.</p>}
              </>
            )}
            {error && <p aria-live="polite" className="rounded-lg border border-[#f0d5d0] bg-[#fff6f4] px-3 py-2.5 text-[12px] text-[#a14d3d]">{error}</p>}
            <Button className="mt-2 w-full" disabled={busy} type="submit">
              {busy ? "Please wait…" : isRegister && step === 1 ? <>Continue <ArrowRight size={15} /></> : isRegister ? <>Create account <Check size={15} /></> : <>Sign in <ArrowRight size={15} /></>}
            </Button>
            {isRegister && step === 2 && (
              <button className="button-secondary w-full" onClick={() => setStep(1)} type="button"><ArrowLeft size={14} /> Back to account details</button>
            )}
        </form>
        <p className="mt-6 text-center text-[12px] text-[#7b867f]">
            {isRegister ? "Already registered?" : "New to the resident portal?"}{" "}
            <Link className="font-semibold text-[#145b43] hover:underline" href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
        </p>
        <p className="mt-7 flex items-center justify-center gap-1.5 text-[10px] text-[#9aa39d]"><ShieldCheck size={13} /> Your personal information is protected and encrypted.</p>
      </section>
    </main>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return <Suspense><AuthFormContent mode={mode} /></Suspense>;
}
