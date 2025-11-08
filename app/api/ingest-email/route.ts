// app/api/ingest-email/route.ts
import { VertexAI } from "@google-cloud/vertexai";
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

// --- CONFIGURATION ---
const PROJECT_ID = "gen-lang-client-0419608159"; // Your Project ID
const LOCATION = "asia-south1"; // Mumbai
const MODEL_NAME = "gemini-1.5-pro-preview-0514";

const DATASET_ID = "zero_click_crm_dataset";
const TABLE_ID = "contacts";
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

const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION, credentials });
const model = vertex_ai.preview.getGenerativeModel({ model: MODEL_NAME });
const bigquery = new BigQuery({ projectId: PROJECT_ID, credentials });
// --- End of Smart Init ---

// NEW PROMPT FOR EMAILS
const SYSTEM_PROMPT = `You are an expert AI assistant for a "Zero-Click CRM".
Your job is to extract structured information from a raw email body.
The user is a busy salesperson. The email is provided as "EMAIL:".
Strictly extract the following information. If a field is not mentioned, return "null".
Respond ONLY with a valid JSON object in the following format:

{
  "contact_name": "string (The name of the *other* person, not the CRM user)",
  "company_name": "string (The other person's company)",
  "deal_value_usd": "integer (Look for '$' or '₹' values. If '₹', convert to USD at 80:1 rate, e.g., ₹80,000 = 1000)",
  "sentiment": "string (options: 'Positive', 'Neutral', 'Negative')",
  "next_step": "string (The main action item for the salesperson)",
  "follow_up_date": "string (format as YYYY-MM-DD, or null)",
  "full_summary": "string (a 1-2 sentence summary of the email)",
  "at_risk": "boolean (true if the deal has any problems, false otherwise)"
}
`;

export async function POST(request: Request) {
  const { emailBody } = await request.json();

  if (!emailBody) {
    return NextResponse.json({ error: "Missing emailBody" }, { status: 400 });
  }

  try {
    // 1. --- CALL VERTEX AI (THE "BRAIN") ---
    const req = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [{ role: "user", parts: [{ text: `EMAIL: ${emailBody}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    const result = await model.generateContent(req);
    const response = result.response;
    
    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid AI response structure from Vertex AI");
    }

    const jsonText = response.candidates[0].content.parts[0].text;
    console.log("AI Response:", jsonText);
    const structuredData = JSON.parse(jsonText);

    // 2. --- INSERT INTO BIGQUERY (THE "DATABASE") ---
    const newRow = {
      ...structuredData,
      transcript: `[EMAIL] ${emailBody.substring(0, 500)}...`, // Store a snippet
      created_at: new Date().toISOString(),
    };

    // Clean up nulls for BigQuery (it prefers 'undefined' to 'null')
    Object.keys(newRow).forEach(key => {
      if (newRow[key as keyof typeof newRow] === null) {
        newRow[key as keyof typeof newRow] = undefined;
      }
    });

    await bigquery
      .dataset(DATASET_ID)
      .table(TABLE_ID)
      .insert([newRow]);

    console.log("Successfully inserted email data into BigQuery");

    // 3. --- RETURN THE DATA TO THE FRONTEND ---
    return NextResponse.json(newRow);

  } catch (error) {
    console.error("Error processing email request:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process email request", details: errorMessage },
      { status: 500 }
    );
  }
}