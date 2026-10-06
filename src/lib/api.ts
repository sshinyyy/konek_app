import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("Database connection failed", error);
    return NextResponse.json(
      { error: "This service is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "An unexpected server error occurred." }, { status: 500 });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  if (new URL(origin).origin !== requestOrigin) {
    throw new ApiError(403, "Cross-origin requests are not permitted.");
  }
}
