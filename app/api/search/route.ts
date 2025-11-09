import { VertexAI } from "@google-cloud/vertexai";
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";
import fs from "node:fs";

const PROJECT_ID = "gen-lang-client-0419608159";

const VERTEX_LOCATION = "us-central1";
const BQ_LOCATION = "asia-south1";

const MODEL_NAME = "gemini-2.5-flash";
const TABLE_FQN = "`gen-lang-client-0419608159.zero_click_crm_dataset.contacts`";

let credentials: any | undefined = undefined;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
    credentials = JSON.parse(raw);
  }
} catch (e) {
  console.error("Failed to load GCP credentials:", e);
}

const vertex_ai = new VertexAI({
  project: PROJECT_ID,
  location: VERTEX_LOCATION,
  ...(credentials ? { googleAuthOptions: { credentials } } : {})
});

const model =
  (vertex_ai as any).preview?.getGenerativeModel
    ? (vertex_ai as any).preview.getGenerativeModel({ model: MODEL_NAME })
    : (vertex_ai as any).generativeModels.getGenerativeModel({ model: MODEL_NAME });

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  ...(credentials ? { credentials } : {})
});

const SEARCH_PROMPT = `
You are a BigQuery expert. Convert the user's request into ONE valid BigQuery Standard SQL query for table:
${TABLE_FQN}

Schema:
- contact_name STRING
- company_name STRING
- deal_value_usd INT64
- sentiment STRING
- next_step STRING
- follow_up_date DATE
- full_summary STRING
- at_risk BOOL
- transcript STRING
- created_at TIMESTAMP

Rules:
- Return ONLY the SQL. No prose, no code fences, no backticks.
- Use Standard SQL (not Legacy).
- Interpret "deals at risk" as at_risk = TRUE.
- "last X days/weeks/months" is relative to CURRENT_TIMESTAMP().
- Always ORDER BY created_at DESC.
- Limit to 50 rows.

Examples:

User: deals at risk in last 30 days
SQL:
SELECT *
FROM ${TABLE_FQN}
WHERE at_risk = TRUE
  AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY created_at DESC
LIMIT 50;

User: conversations with CTOs last month
SQL:
SELECT *
FROM ${TABLE_FQN}
WHERE LOWER(full_summary) LIKE '%cto%'
  AND created_at >= TIMESTAMP_SUB(TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH), INTERVAL 1 MONTH)
ORDER BY created_at DESC
LIMIT 50;

User: "{{USER_QUERY}}"
SQL:
`;

function cleanSql(s: string | undefined): string {
  if (!s) return "";
  let t = s.trim();

  t = t.replace(/^```[\s\S]*?\n/, "").replace(/```$/g, "").trim();

  if (t.startsWith("`") && t.endsWith("`")) t = t.slice(1, -1).trim();

  const idx = t.toUpperCase().indexOf("SELECT ");
  if (idx > 0) t = t.slice(idx);

  return t;
}

export async function POST(request: Request) {
  const { query } = await request.json();
  if (!query) return NextResponse.json({ error: "Missing search query" }, { status: 400 });

  try {
    const req = {
      contents: [{ role: "user", parts: [{ text: SEARCH_PROMPT.replace("{{USER_QUERY}}", String(query)) }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    };

    const result = await (model as any).generateContent(req);
    const raw = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const sql = cleanSql(raw);

    if (!/^SELECT\b/i.test(sql)) {
      console.error("Model did not return a SELECT. Raw:", raw);
      return NextResponse.json({ error: "Could not generate valid SQL for this query." }, { status: 400 });
    }

    const [rows] = await bigquery.query({ query: sql, location: BQ_LOCATION });
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("AI Search error:", error);
    return NextResponse.json(
      { error: "Failed to process AI search", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
