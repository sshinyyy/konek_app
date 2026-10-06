import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const publicPaths = ["/login", "/register", "/verify", "/privacy"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/api/v1/auth/") ||
    pathname === "/api/v1/verify"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isApi = pathname.startsWith("/api/");
  if (!session) {
    if (isApi) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const staffPath =
    pathname === "/staff" ||
    /^\/api\/v1\/requests\/[^/]+\/decision\/?$/.test(pathname);
  const adminPath = pathname === "/admin";
  if (
    (staffPath && !["STAFF", "ADMIN"].includes(session.role)) ||
    (adminPath && session.role !== "ADMIN")
  ) {
    return isApi
      ? NextResponse.json({ error: "You do not have permission to access this resource." }, { status: 403 })
      : NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
