import { NextResponse } from "next/server";
import { jsonError } from "@/app/lib/api";
import { getEnv } from "@/app/lib/gcp";

const REQUIRED = ["GCP_PROJECT_ID", "GCS_UPLOAD_BUCKET", "BQ_LOCATION", "BQ_DATASET", "BQ_TABLE", "VERTEX_LOCATION", "VERTEX_MODEL"];

export async function GET() {
  const missing = REQUIRED.filter((k) => !getEnv(k));
  if (missing.length) return jsonError(500, "Missing required env vars", missing.join(", "));
  return NextResponse.json({ ok: true });
}

