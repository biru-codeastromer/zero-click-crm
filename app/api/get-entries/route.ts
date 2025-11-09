import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

const PROJECT_ID = "gen-lang-client-0419608159";
const LOCATION = "asia-south1";
const DATASET = "zero_click_crm_dataset";
const TABLE = "contacts";

let credentials: any;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
} catch (e) {
  console.error("Failed to parse GCP credentials from env var", e);
}

const bigquery = new BigQuery({ projectId: PROJECT_ID, credentials });

export async function GET() {
  try {
    const [rows] = await bigquery.query({
      query: `SELECT * FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` ORDER BY created_at DESC LIMIT 50`,
      location: LOCATION
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
