import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";
import { getBigQueryConfig, loadGcpCredentials } from "@/app/lib/gcp";
import { jsonError } from "@/app/lib/api";

const { projectId, location, dataset, table } = getBigQueryConfig();
const credentials = loadGcpCredentials();

const bigquery = new BigQuery({
  projectId,
  ...(credentials ? { credentials } : {})
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const parsed = limitParam ? Number(limitParam) : 50;
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(200, parsed)) : 50;
    const [rows] = await bigquery.query({
      query: `SELECT * FROM \`${projectId}.${dataset}.${table}\` ORDER BY created_at DESC LIMIT ${Number.isFinite(limit) ? Math.floor(limit) : 50}`,
      location
    });
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Error fetching from BigQuery:", error);
    return jsonError(500, "Failed to fetch entries", error?.message ?? "Unknown error");
  }
}
