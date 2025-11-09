// app/api/search/route.ts
import { VertexAI } from "@google-cloud/vertexai";
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

// --- CONFIGURATION ---
const PROJECT_ID = "gen-lang-client-0419608159";
const LOCATION = "asia-south1";
const MODEL_NAME = "gemini-1.5-pro-preview-0514";

const DATASET = "zero_click_crm_dataset";
const TABLE = "contacts";
// ---------------------

// --- Smart Client Initialization ---
let credentials;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
} catch (e) {
  console.error("Failed to parse GCP credentials from env var", e);
}

const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION, credentials });
const model = vertex_ai.preview.getGenerativeModel({ model: MODEL_NAME });
const bigquery = new BigQuery({ projectId: PROJECT_ID, credentials });
// --- End of Smart Init ---

const SEARCH_PROMPT = `You are a Google BigQuery expert.
Your job is to convert a user's natural language query into a valid BigQuery SQL query.
You must query the table: \`gen-lang-client-0419608159.zero_click_crm_dataset.contacts\`
The table schema is:
contact_name:STRING, company_name:STRING, deal_value_usd:INTEGER, sentiment:STRING, next_step:STRING, follow_up_date:DATE, full_summary:STRING, at_risk:BOOLEAN, transcript:STRING, created_at:TIMESTAMP

RULES:
- ONLY respond with the single, valid, complete SQL query.
- DO NOT wrap the query in markdown (''') or add any other text.
- Be smart: "deals at risk" means "at_risk = true".
- "this week" should be relative to the CURRENT_TIMESTAMP().
- Always sort by 'created_at DESC'.

User Query: "{{USER_QUERY}}"
SQL:
`;

export async function POST(request: Request) {
  const { query } = await request.json();

  if (!query) {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 });
  }

  try {
    // 1. --- CALL VERTEX AI TO GENERATE SQL ---
    const prompt = SEARCH_PROMPT.replace("{{USER_QUERY}}", query);
    const req = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    
    const result = await model.generateContent(req);
    const sqlQuery = result.response.candidates[0].content.parts[0].text;
    console.log("Generated SQL:", sqlQuery);

    // 2. --- EXECUTE THE GENERATED SQL ON BIGQUERY ---
    const options = {
      query: sqlQuery,
      location: "asia-south1", // Location of your dataset
    };

    const [rows] = await bigquery.query(options);

    return NextResponse.json(rows);

  } catch (error) {
    console.error("Error in AI Search:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process AI search", details: errorMessage },
      { status: 500 }
    );
  }
}
