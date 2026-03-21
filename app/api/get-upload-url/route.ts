import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import crypto from "crypto";

import { getGcpProjectId, getGcsUploadBucket, loadGcpCredentials } from "@/app/lib/gcp";
import { ALLOWED_AUDIO_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/app/lib/upload";
import { jsonError } from "@/app/lib/api";

const projectId = getGcpProjectId();
const bucketName = getGcsUploadBucket();
const credentials = loadGcpCredentials();
const storage = new Storage({ projectId, ...(credentials ? { credentials } : {}) });

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const { fileType, originalName, fileSize } =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    if (typeof fileType !== "string" || !ALLOWED_AUDIO_MIME_TYPES.has(fileType))
      return jsonError(400, "Unsupported file type");

    if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
      return jsonError(400, "Missing file size");
    }
    if (fileSize > MAX_UPLOAD_BYTES) return jsonError(400, "File too large");

    const date = new Date();
    const prefix = `uploads/${date.getUTCFullYear()}/${(date.getUTCMonth()+1).toString().padStart(2,"0")}/${date.getUTCDate().toString().padStart(2,"0")}`;
    const rand = crypto.randomBytes(8).toString("hex");
    const safeName = (typeof originalName === "string" && originalName ? originalName : "audio")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80);
    const objectKey = `${prefix}/${rand}__${safeName}`;

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectKey);

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000,
      contentType: fileType
    });

    return NextResponse.json({ url, objectKey, maxBytes: MAX_UPLOAD_BYTES });
  } catch (error: any) {
    console.error("Error creating signed URL:", error);
    return jsonError(500, "Failed to create signed URL", error?.message ?? "Unknown error");
  }
}
