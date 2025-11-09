const functions = require('@google-cloud/functions-framework');
const { SpeechClient } = require('@google-cloud/speech');
const { VertexAI } = require('@google-cloud/vertexai');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

const PROJECT_ID = "gen-lang-client-0419608159";
const LOCATION = "asia-south1";
const MODEL_NAME = "gemini-1.5-pro-preview-0514";
const DATASET_ID = "zero_click_crm_dataset";
const TABLE_ID = "contacts";

const speechClient = new SpeechClient({ projectId: PROJECT_ID });
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = vertex_ai.preview.getGenerativeModel({ model: MODEL_NAME });
const bigquery = new BigQuery({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

const SYSTEM_PROMPT = `You are an expert AI assistant for a "Zero-Click CRM".
Extract JSON with the following fields. Return a single compact JSON object. Use null where unknown.
{
  "contact_name": "string",
  "company_name": "string",
  "deal_value_usd": "integer (parse $, or convert ₹ to USD using 80:1)",
  "sentiment": "Positive|Neutral|Negative",
  "next_step": "string",
  "follow_up_date": "YYYY-MM-DD or null",
  "full_summary": "1-2 sentence string",
  "at_risk": "boolean"
}`;

functions.cloudEvent('processAudio', async (cloudEvent) => {
  const file = cloudEvent.data;
  const bucketName = file.bucket;
  const fileName = file.name;
  const gcsUri = `gs://${bucketName}/${fileName}`;
  console.log(`Processing file: ${fileName}`);

  try {
    // 1) STT (auto-detect, punctuation on)
    const [operation] = await speechClient.longRunningRecognize({
      audio: { uri: gcsUri },
      config: {
        languageCode: 'en-US',
        enableAutomaticPunctuation: true
        // No encoding/sample rate -> let API infer from file
      }
    });
    const [response] = await operation.promise();
    const transcript = (response.results || [])
      .map(r => r.alternatives?.[0]?.transcript || "")
      .filter(Boolean)
      .join('\n');

    if (!transcript) throw new Error("Empty transcript from Speech-to-Text.");

    // 2) Gemini extraction
    const aiReq = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: `TRANSCRIPT:\n${transcript}` }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
    };

    const result = await model.generateContent(aiReq);
    const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Invalid AI response structure.");
    let structuredData;
    try { structuredData = JSON.parse(text); } catch (_) { throw new Error("AI did not return valid JSON"); }

    // Coerce / sanitize
    const usd = Number(structuredData.deal_value_usd);
    const atRisk = typeof structuredData.at_risk === 'boolean' ? structuredData.at_risk : null;
    const follow = structuredData.follow_up_date && /^\d{4}-\d{2}-\d{2}$/.test(structuredData.follow_up_date) ? structuredData.follow_up_date : null;

    const newRow = {
      contact_name: structuredData.contact_name ?? null,
      company_name: structuredData.company_name ?? null,
      deal_value_usd: Number.isFinite(usd) ? usd : null,
      sentiment: structuredData.sentiment ?? null,
      next_step: structuredData.next_step ?? null,
      follow_up_date: follow,
      full_summary: structuredData.full_summary ?? null,
      at_risk: atRisk,
      transcript,
      created_at: new Date().toISOString()
    };

    // Insert to BigQuery
    await bigquery.dataset(DATASET_ID).table(TABLE_ID).insert([newRow]);
    console.log(`Inserted row for ${fileName}`);
  } catch (err) {
    console.error(`Failed to process ${fileName}:`, err);
  }
});
