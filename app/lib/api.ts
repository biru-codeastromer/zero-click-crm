import { NextResponse } from "next/server";
import type { ApiError } from "@/app/lib/types";

export function jsonError(status: number, error: string, details?: string) {
  const body: ApiError = details ? { error, details } : { error };
  return NextResponse.json(body, { status });
}
