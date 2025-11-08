import { VertexAI } from "@google-cloud/vertexai";
import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

// --- CONFIGURATION ---
const PROJECT_ID = "gen-lang-client-0419608159"; // Your Project ID
const LOCATION = "asia-south1"; // Mumbai
const MODEL_NAME = "gemini-1.5-pro-preview-0514"; // Use a powerful model

const DATASET_ID = "zero_click_crm_dataset";
const TABLE_ID = "contacts";
// ---------------------

// Initialize clients. They automatically find the service-account.json
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = vertex_ai.preview.getGenerativeModel({ model: MODEL_NAME });
const bigquery = new BigQuery({ projectId: PROJECT_ID });

// System prompt from your previous file, slightly improved
const SYSTEM_PROMPT = `You are an expert AI assistant for a "Zero-Click CRM".
Your job is to extract structured information from a salesperson's voice-memo transcript.
The user speaks casually. The transcript is provided as "TRANSCRIPT:".
Strictly extract the following information. If a field is not mentioned, return "null".
Respond ONLY with a valid JSON object in the following format:

{
  "contact_name": "string",
  "company_name": "string",
  "deal_value_usd": "integer",
  "sentiment": "string (options: 'Positive', 'Neutral', 'Negative')",
  "next_step": "string (the main action item for the salesperson)",
  "follow_up_date": "string (format as YYYY-MM-DD, or null)",
  "full_summary": "string (a 1-2 sentence summary of the call)",
  "at_risk": "boolean (true if the deal has any problems, false otherwise)"
}
`;

export async function POST(request: Request) {
  const { transcript } = await request.json();

  if (!transcript) {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
  }

  try {
    // 1. --- CALL VERTEX AI (THE "BRAIN") ---
    const req = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [{ role: "user", parts: [{ text: `TRANSCRIPT: ${transcript}` }] }],
      generationConfig: {
        responseMimeType: "application/json", // Force JSON output!
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
      transcript: transcript, // Add the full transcript
      created_at: new Date().toISOString(), // Add a timestamp
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

    console.log("Successfully inserted into BigQuery");

    // 3. --- RETURN THE DATA TO THE FRONTEND ---
    return NextResponse.json(newRow);

  } catch (error) {
    console.error("Error processing request:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process request", details: errorMessage },
      { status: 500 }
    );
  }
}