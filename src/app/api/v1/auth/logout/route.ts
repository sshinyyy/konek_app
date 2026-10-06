import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
