"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { animate, stagger } from "animejs";
import { Activity, BadgeCheck, Files, LayoutDashboard, LoaderCircle, LogOut, Menu, Settings2, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const nav = role === "RESIDENT"
    ? [
        { href: "/", label: "Overview", icon: LayoutDashboard },
        { href: "/requests", label: "Requests", icon: Files },
        { href: "/profile", label: "My profile", icon: UserRound },
        { href: "/verify", label: "Verify", icon: ShieldCheck },
      ]
    : role === "STAFF"
      ? [
          { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
          { href: "/staff/profile", label: "My profile", icon: UserRound },
          { href: "/verify", label: "Verify", icon: BadgeCheck },
        ]
      : [
          { href: "/admin", label: "Overview", icon: LayoutDashboard },
          { href: "/staff", label: "Requests", icon: Files },
          { href: "/admin/staff", label: "Staff", icon: Users },
          { href: "/admin/settings", label: "Setup", icon: Settings2 },
          { href: "/admin/activity", label: "Activity", icon: Activity },
          { href: "/verify", label: "Verify", icon: ShieldCheck },
        ];
  const pageTitle = pathname === "/" ? "Overview"
    : pathname === "/requests" ? "My requests"
      : pathname === "/profile" || pathname === "/staff/profile" ? "My profile"
        : pathname === "/verify" ? "Document verification"
          : pathname === "/admin/staff" ? "Staff accounts"
            : pathname === "/admin/settings" ? "Barangay setup"
              : pathname === "/admin/activity" ? "Activity log"
                : pathname === "/staff" ? "Request queue"
                  : pathname === "/admin" ? "Administration"
                    : "Workspace";
  const section = role === "ADMIN" ? "System administration"
    : role === "STAFF" ? "Staff workspace"
      : "Resident portal";

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const items = contentRef.current?.children;
    if (!items?.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const contentAnimation = animate(
      Array.from(items).filter((item): item is HTMLElement => item instanceof HTMLElement),
      {
        opacity: [0, 1],
        y: [12, 0],
        delay: stagger(45),
        duration: 420,
        ease: "outCubic",
      },
    );

    return () => {
      contentAnimation.revert();
    };
  }, [pathname]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animations = new WeakMap<SVGElement, ReturnType<typeof animate>>();
    function animateControlIcon(target: EventTarget | null) {
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(".nav-link, .button-primary, .button-secondary, .button-danger, .button-icon");
      if (!control || control.matches(":disabled, [aria-busy='true']")) return;

      const icon = control.querySelector("svg");
      if (!(icon instanceof SVGElement)) return;
      animations.get(icon)?.revert();
      animations.set(icon, animate(icon, {
        rotate: [0, -8, 8, 0],
        scale: [1, 1.1, 1],
        duration: 360,
        ease: "outCubic",
      }));
    }
    function onPointerOver(event: PointerEvent) {
      if (event.relatedTarget instanceof Node) {
        const control = event.target instanceof Element ? event.target.closest(".nav-link, .button-primary, .button-secondary, .button-danger, .button-icon") : null;
        if (control?.contains(event.relatedTarget)) return;
      }
      animateControlIcon(event.target);
    }
    function onFocusIn(event: FocusEvent) {
      animateControlIcon(event.target);
    }

    shell.addEventListener("pointerover", onPointerOver);
    shell.addEventListener("focusin", onFocusIn);
    return () => {
      shell.removeEventListener("pointerover", onPointerOver);
      shell.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell" ref={shellRef}>
      {mobileMenuOpen && <button aria-label="Close navigation menu" className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)} type="button" />}
      <aside aria-label="Workspace navigation" className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`} id="workspace-navigation">
        <Link className="sidebar-brand mb-7 flex items-center gap-3 px-2" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#145b43] text-white">
            <span className="text-[19px] font-semibold">k.</span>
          </span>
          <span>
            <span className="block text-[15px] font-bold tracking-tight text-[#243a30]">konek<span className="font-normal">barangay</span></span>
            <span className="mt-0.5 block text-[10px] tracking-[.13em] text-[#88928c]">COMMUNITY SERVICES</span>
          </span>
        </Link>
        <button aria-label="Close navigation menu" className="button-icon mobile-sidebar-close" onClick={() => setMobileMenuOpen(false)} type="button">
          <X size={18} />
        </button>
        <p className="sidebar-label mb-2 px-3 text-[9px] font-bold tracking-[.12em] text-[#929d95]">WORKSPACE</p>
        <nav aria-label="Pages" className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link aria-current={active ? "page" : undefined} className={`nav-link ${active ? "active" : ""}`} href={href} key={href} onClick={() => setMobileMenuOpen(false)}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer mt-auto border-t border-[#edf0ed] pt-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff3ed] text-[11px] font-bold text-[#486658]">
              {fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-[#34443b]">{fullName}</span>
              <span className="block truncate text-[11px] text-[#8a948e]">{email}</span>
            </span>
          </div>
          <button aria-busy={signingOut} className="nav-link w-full cursor-pointer bg-transparent text-left" disabled={signingOut} onClick={signOut} type="button">
            {signingOut ? <LoaderCircle className="animate-spin" size={16} /> : <LogOut size={16} />}<span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-heading min-w-0">
            <button
              aria-controls="workspace-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="button-icon mobile-menu-toggle"
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <p className="hidden text-[10px] font-semibold uppercase tracking-[.13em] text-[#8b978f] sm:block">{section}</p>
            <p className="truncate text-[13px] font-semibold text-[#35473c]">{pageTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-[11px] font-medium text-[#64756b] sm:flex"><span className="h-2 w-2 rounded-full bg-[#59a77a]" /> Secure services</span>
          </div>
        </header>
        {signOutError && <p aria-live="polite" className="mx-5 mt-3 rounded-md bg-[#fff5f2] px-3 py-2 text-[11px] text-[#a14d3d]">{signOutError}</p>}
        <main className="content-wrap" ref={contentRef}>{children}</main>
      </div>
    </div>
  );
}
