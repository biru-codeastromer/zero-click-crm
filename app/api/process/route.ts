import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { NextResponse } from "next/server";

const MODEL_NAME = "gemini-pro";
const API_KEY = process.env.GEMINI_API_KEY || "";

// This is our "Secret Sauce" Prompt, adapted for the new model
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
  "follow_up_date": "string (format as YYYY-MM-DD)",
  "full_summary": "string (a 1-2 sentence summary of the call)",
  "at_risk": "boolean (true if the deal has any problems, false otherwise)"
}
`;

export async function POST(request: Request) {
  const { transcript } = await request.json();

  if (!transcript) {
    return NextResponse.json(
      { error: "Missing transcript" },
      { status: 400 }
    );
  }

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.1, // We want deterministic, structured output
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    };

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      // ... add other categories if needed
    ];

    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }], // Our system prompt
        },
        {
          role: "model",
          parts: [
            { text: "OK. I am ready. Please provide the transcript." },
          ], // This "primes" the model
        },
      ],
    });

    // Now, send the user's transcript
    const result = await chat.sendMessage(`TRANSCRIPT: ${transcript}`);

    const response = result.response;
    const jsonText = response.text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim(); // Clean up markdown
      
    console.log("AI Response:", jsonText);

    // Parse the JSON text to make sure it's valid before sending
    const structuredData = JSON.parse(jsonText);

    return NextResponse.json(structuredData);

  } catch (error) {
    console.error("Error processing AI request:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 }
    );
  }
}