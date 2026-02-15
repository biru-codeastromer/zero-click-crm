import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";
import { getBigQueryConfig, loadGcpCredentials } from "@/app/lib/gcp";

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
    const limit = Math.max(1, Math.min(200, limitParam ? Number(limitParam) : 50));
    const [rows] = await bigquery.query({
      query: `SELECT * FROM \`${projectId}.${dataset}.${table}\` ORDER BY created_at DESC LIMIT ${Number.isFinite(limit) ? Math.floor(limit) : 50}`,
      location
    });
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Error fetching from BigQuery:", error);
    return NextResponse.json(
      { error: "Failed to fetch entries", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
