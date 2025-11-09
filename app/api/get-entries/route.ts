// app/api/get-entries/route.ts
import { BigQuery } from "@google-cloud/bigquery";
import { VertexAI } from "@google-cloud/vertexai"; // Import for consistency
import { NextResponse } from "next/server";

// --- CONFIGURATION ---
const PROJECT_ID = "gen-lang-client-0419608159";
const LOCATION = "asia-south1";
const DATASET = "zero_click_crm_dataset";
const TABLE = "contacts";
// ---------------------

// --- Smart Client Initialization ---
let credentials;
try {
  // Check for Vercel environment variable
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
  // If not on Vercel, it will automatically use the local GOOGLE_APPLICATION_CREDENTIALS file
} catch (e) {
  console.error("Failed to parse GCP credentials from env var", e);
}

// We init both, even if we only use one, to keep the logic standard
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION, credentials });
const bigquery = new BigQuery({ projectId: PROJECT_ID, credentials });
// --- End of Smart Init ---

export async function GET() {
  try {
    const query = `SELECT *
      FROM \`gen-lang-client-0419608159.${DATASET}.${TABLE}\`
      ORDER BY created_at DESC
      LIMIT 50`; // Limit to 50 for the demo

    const options = {
      query: query,
      location: "asia-south1", // Location of your dataset
    };

    const [rows] = await bigquery.query(options);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching from BigQuery:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch entries", details: errorMessage },
      { status: 500 }
    );
  }
}
