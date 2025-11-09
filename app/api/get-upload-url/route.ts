import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import crypto from "crypto";

const PROJECT_ID = "gen-lang-client-0419608159";
const BUCKET_NAME = "zero-click-uploads-gen-lang-client-0419608159";
const ALLOWED = new Set(["audio/mpeg","audio/wav","audio/x-wav","audio/mp4","audio/m4a","audio/aac","audio/3gpp"]);
const MAX_MB = 50;

let credentials: any;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
} catch (e) {
  console.error("Failed to parse GCP credentials from env var", e);
}
const storage = new Storage({ projectId: PROJECT_ID, credentials });

export async function POST(request: Request) {
  try {
    const { fileType, originalName } = await request.json();

    if (!fileType || !ALLOWED.has(fileType))
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

    // Create a safe key: uploads/YYYY/MM/DD/<random>__sanitizedName
    const date = new Date();
    const prefix = `uploads/${date.getUTCFullYear()}/${(date.getUTCMonth()+1).toString().padStart(2,"0")}/${date.getUTCDate().toString().padStart(2,"0")}`;
    const rand = crypto.randomBytes(8).toString("hex");
    const safeName = (originalName || "audio").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const objectKey = `${prefix}/${rand}__${safeName}`;

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(objectKey);

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      contentType: fileType
    });

    return NextResponse.json({ url, objectKey, maxBytes: MAX_MB * 1024 * 1024 });
  } catch (error: any) {
    console.error("Error creating signed URL:", error);
    return NextResponse.json(
      { error: "Failed to create signed URL", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
