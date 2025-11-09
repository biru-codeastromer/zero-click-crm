import { NextResponse } from "next/server";
import fs from "node:fs";

export async function GET() {
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "(not set)";
  let email = "(n/a)";
  let canRead = false;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const j = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      email = j.client_email || "(no client_email)";
      canRead = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
      const j = JSON.parse(raw);
      email = j.client_email || "(no client_email)";
      canRead = true;
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, filePath, error: e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, filePath, email, canRead });
}
