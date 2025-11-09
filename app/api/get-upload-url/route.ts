// app/api/get-upload-url/route.ts
import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";

// --- CONFIGURATION ---
const PROJECT_ID = "gen-lang-client-0419608159";
const BUCKET_NAME = "zero-click-uploads-gen-lang-client-0419608159";
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

const storage = new Storage({ projectId: PROJECT_ID, credentials });
// --- End of Smart Init ---

export async function POST(request: Request) {
  try {
    const { fileName, fileType } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: "Missing fileName or fileType" }, { status: 400 });
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(fileName);

    const options = {
      version: 'v4' as 'v4',
      action: 'write' as 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType,
    };

    // Get a signed URL for uploading
    const [url] = await file.getSignedUrl(options);

    return NextResponse.json({ url });

  } catch (error) {
    console.error("Error creating signed URL:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create signed URL", details: errorMessage },
      { status: 500 }
    );
  }
}
