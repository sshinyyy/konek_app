"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, Files, LayoutDashboard, LogOut, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

type Props = {
  role: "RESIDENT" | "STAFF" | "ADMIN";
  email: string;
  fullName: string;
  children: ReactNode;
};

export function AppShell({ role, email, fullName, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signOutError, setSignOutError] = useState("");
  const nav = role === "RESIDENT"
    ? [
        { href: "/", label: "Overview", icon: LayoutDashboard },
        { href: "/#requests", label: "Requests", icon: Files },
        { href: "/profile", label: "My profile", icon: UserRound },
        { href: "/verify", label: "Verify", icon: ShieldCheck },
      ]
    : role === "STAFF"
      ? [
          { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
          { href: "/verify", label: "Verify", icon: BadgeCheck },
        ]
      : [
          { href: "/admin", label: "Overview", icon: LayoutDashboard },
          { href: "/admin#staff", label: "Staff", icon: UserRound },
          { href: "/admin#settings", label: "Setup", icon: Settings2 },
          { href: "/verify", label: "Verify", icon: ShieldCheck },
        ];
  const section = pathname === "/staff" ? "Staff workspace"
    : pathname === "/admin" ? "System administration"
      : pathname === "/profile" ? "My profile"
        : role === "STAFF" ? "Staff workspace"
          : role === "ADMIN" ? "System administration"
            : "Resident portal";

  async function signOut() {
    setSignOutError("");
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="sidebar-brand mb-8 flex items-center gap-3 px-2" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#145b43] text-white">
            <span className="text-[19px] font-semibold">k.</span>
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight text-[#243a30]">konek<span className="font-normal">barangay</span></span>
            <span className="mt-0.5 block text-[10px] tracking-[.13em] text-[#88928c]">COMMUNITY SERVICES</span>
          </span>
        </Link>
        <p className="sidebar-label mb-2 px-3 text-[10px] font-bold tracking-[.13em] text-[#a0aaa3]">WORKSPACE</p>
        <nav className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = !href.includes("#") && pathname === href;
            return (
              <Link className={`nav-link ${active ? "active" : ""}`} href={href} key={href}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer mt-auto border-t border-[#edf0ed] pt-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff3ed] text-[12px] font-bold text-[#486658]">
              {fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-[#34443b]">{fullName}</span>
              <span className="block truncate text-[11px] text-[#8a948e]">{email}</span>
            </span>
          </div>
          <button className="nav-link w-full cursor-pointer bg-transparent text-left" onClick={signOut} type="button">
            <LogOut size={16} /><span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <p className="text-[12px] text-[#808b84]">{section}<span className="px-2 text-[#c7cec8]">/</span><span className="text-[#46554c]">{pathname === "/" ? "Overview" : pathname.slice(1).replaceAll("/", " ")}</span></p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-[11px] font-medium text-[#64756b]"><span className="h-2 w-2 rounded-full bg-[#59a77a]" /> Secure resident services</span>
            <button aria-label="Sign out" className="button-secondary min-h-[34px] px-2.5 text-[10px] md:hidden" onClick={signOut} type="button"><LogOut size={14} /></button>
          </div>
        </header>
        {signOutError && <p aria-live="polite" className="mx-5 mt-3 rounded-md bg-[#fff5f2] px-3 py-2 text-[11px] text-[#a14d3d]">{signOutError}</p>}
        <main className="content-wrap">{children}</main>
      </div>
    </div>
  );
}
