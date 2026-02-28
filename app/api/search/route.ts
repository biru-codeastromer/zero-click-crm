import { VertexAI } from "@google-cloud/vertexai";
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";
import { getBigQueryConfig, getVertexConfig, loadGcpCredentials } from "@/app/lib/gcp";
import { jsonError } from "@/app/lib/api";
import { cleanSql, enforceSafeSql } from "@/app/lib/sqlGuard";

const { projectId, location: bqLocation, dataset, table } = getBigQueryConfig();
const vertex = getVertexConfig();
const TABLE_FQN = `\`${projectId}.${dataset}.${table}\``;
const credentials = loadGcpCredentials();

const vertex_ai = new VertexAI({
  project: vertex.projectId,
  location: vertex.location,
  ...(credentials ? { googleAuthOptions: { credentials } } : {})
});

const model =
  (vertex_ai as any).preview?.getGenerativeModel
    ? (vertex_ai as any).preview.getGenerativeModel({ model: vertex.model })
    : (vertex_ai as any).generativeModels.getGenerativeModel({ model: vertex.model });

const bigquery = new BigQuery({
  projectId,
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

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;
  const query =
    typeof body === "object" && body !== null && typeof (body as any).query === "string"
      ? (body as any).query
      : "";
  const trimmed = query.trim();
  if (!trimmed) return jsonError(400, "Missing search query");
  if (trimmed.length > 500) return jsonError(400, "Query too long");

  try {
    const req = {
      contents: [{ role: "user", parts: [{ text: SEARCH_PROMPT.replace("{{USER_QUERY}}", trimmed) }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    };

    const result = await (model as any).generateContent(req);
    const raw = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const sql = cleanSql(raw);

    const safe = enforceSafeSql(sql, { tableFqn: TABLE_FQN });
    if (!safe.ok) {
      if (process.env.DEBUG_SQL === "1") console.error("Rejected SQL:", { raw, sql, reason: safe.error });
      return jsonError(400, safe.error);
    }
    if (process.env.DEBUG_SQL === "1") console.log("Executing SQL:", safe.sql);

    const [rows] = await bigquery.query({ query: safe.sql, location: bqLocation });
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("AI Search error:", error);
    return jsonError(500, "Failed to process AI search", error?.message ?? "Unknown error");
  }
}
