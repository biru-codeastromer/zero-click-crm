// index.js (Your new Cloud Function)
const functions = require('@google-cloud/functions-framework');
const { SpeechClient } = require('@google-cloud/speech');
const { VertexAI } = require('@google-cloud/vertexai');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');

// --- CONFIGURATION ---
const PROJECT_ID = "gen-lang-client-0419608159";
const LOCATION = "asia-south1";
const MODEL_NAME = "gemini-1.5-pro-preview-0514";
const DATASET_ID = "zero_click_crm_dataset";
const TABLE_ID = "contacts";
// ---------------------

// Initialize all clients
const speechClient = new SpeechClient({ projectId: PROJECT_ID });
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = vertex_ai.preview.getGenerativeModel({ model: MODEL_NAME });
const bigquery = new BigQuery({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

// The AI prompt
const SYSTEM_PROMPT = `You are an expert AI assistant for a "Zero-Click CRM".
Your job is to extract structured information from a sales-call or meeting transcript.
The transcript is provided as "TRANSCRIPT:".
Strictly extract the following information. If a field is not mentioned, return "null".
Respond ONLY with a valid JSON object in the following format:

{
  "contact_name": "string",
  "company_name": "string",
  "deal_value_usd": "integer (Look for '$' or '₹' values. If '₹', convert to USD at 80:1 rate, e.g., ₹80,000 = 1000)",
  "sentiment": "string (options: 'Positive', 'Neutral', 'Negative')",
  "next_step": "string (the main action item for the salesperson)",
  "follow_up_date": "string (format as YYYY-MM-DD, or null)",
  "full_summary": "string (a 1-2 sentence summary of the call)",
  "at_risk": "boolean (true if the deal has any problems, false otherwise)"
}
`;

// This is the Cloud Function that will be triggered
functions.cloudEvent('processAudio', async (cloudEvent) => {
  const file = cloudEvent.data;
  const bucketName = file.bucket;
  const fileName = file.name;
  const gcsUri = `gs://${bucketName}/${fileName}`;

  console.log(`Processing file: ${fileName}`);

  try {
    // 1. --- SPEECH-TO-TEXT ---
    const audio = { uri: gcsUri };
    const config = {
      encoding: 'MP3', // Change this if you upload WAV/M4A
      sampleRateHertz: 16000, // Common for voice
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
    };
    const request = { audio: audio, config: config };

    console.log("Sending to Speech-to-Text...");
    const [operation] = await speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();

    const transcript = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    if (!transcript) {
      throw new Error("Empty transcript from Speech-to-Text.");
    }
    console.log(`Transcript: ${transcript}`);

    // 2. --- VERTEX AI (GEMINI) ---
    const aiReq = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: `TRANSCRIPT: ${transcript}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    };

    console.log("Sending to Vertex AI...");
    const result = await model.generateContent(aiReq);
    const aiResponse = result.response;

    if (!aiResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid AI response structure from Vertex AI");
    }

    const jsonText = aiResponse.candidates[0].content.parts[0].text;
    console.log("AI Response:", jsonText);
    const structuredData = JSON.parse(jsonText);

    // 3. --- BIGQUERY INSERT ---
    const newRow = {
      ...structuredData,
      transcript: transcript,
      created_at: new Date().toISOString(),
    };

    // Clean up nulls for BigQuery
    Object.keys(newRow).forEach(key => {
      if (newRow[key] === null) {
        newRow[key] = undefined;
      }
    });

    console.log("Inserting into BigQuery...");
    await bigquery
      .dataset(DATASET_ID)
      .table(TABLE_ID)
      .insert([newRow]);

    console.log(`Successfully processed and inserted ${fileName}`);

  } catch (error) {
    console.error(`Failed to process ${fileName}:`, error);
  }
});