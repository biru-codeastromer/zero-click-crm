import { VertexAI } from "@google-cloud/vertexai";
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

const PROJECT_ID = "gen-lang-client-0419608159";
const LOCATION = "asia-south1";
const MODEL_NAME = "gemini-1.5-pro-preview-0514";
const TABLE_FQN = "`gen-lang-client-0419608159.zero_click_crm_dataset.contacts`";

let credentials: any;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
} catch (e) {
  console.error("Failed to parse GCP credentials from env var", e);
}

const vertex_ai = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
  ...(credentials ? { googleAuthOptions: { credentials } } : {})
});
const model = vertex_ai.preview.getGenerativeModel({ model: MODEL_NAME });
const bigquery = new BigQuery({ projectId: PROJECT_ID, ...(credentials ? { credentials } : {}) });


const SEARCH_PROMPT = `You are a BigQuery expert. Convert the user query into a single valid BigQuery SQL for table ${TABLE_FQN}.
Schema: contact_name STRING, company_name STRING, deal_value_usd INT64, sentiment STRING, next_step STRING, follow_up_date DATE, full_summary STRING, at_risk BOOL, transcript STRING, created_at TIMESTAMP.
Rules:
- ONLY return the SQL, nothing else.
- "deals at risk" -> at_risk = TRUE
- Time windows use CURRENT_TIMESTAMP().
- Always ORDER BY created_at DESC.
User: "{{USER_QUERY}}"`;

export async function POST(request: Request) {
  const { query } = await request.json();
  if (!query) return NextResponse.json({ error: "Missing search query" }, { status: 400 });

  try {
    const req = { contents: [{ role: "user", parts: [{ text: SEARCH_PROMPT.replace("{{USER_QUERY}}", String(query)) }] }] };
    const result = await model.generateContent(req);

    const sql = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!sql || !/select/i.test(sql)) {
      return NextResponse.json({ error: "Could not generate SQL for this query" }, { status: 400 });
    }

    const [rows] = await bigquery.query({ query: sql, location: LOCATION });
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("AI Search error:", error);
    return NextResponse.json({ error: "Failed to process AI search", details: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
