// app/api/get-entries/route.ts
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

const bigquery = new BigQuery({ projectId: "gen-lang-client-0419608159" });
const DATASET = "zero_click_crm_dataset";
const TABLE = "contacts";

export async function GET() {
  try {
    // Note: Using your full Project ID here.
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