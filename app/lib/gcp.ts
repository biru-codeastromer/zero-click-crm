import fs from "node:fs";

export type GcpCredentials = Record<string, unknown>;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

export function loadGcpCredentials(): GcpCredentials | undefined {
  try {
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (rawJson) return JSON.parse(rawJson) as GcpCredentials;

    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (path) return JSON.parse(fs.readFileSync(path, "utf8")) as GcpCredentials;
  } catch (error) {
    console.error("Failed to load GCP credentials:", error);
  }

  return undefined;
}

export function getGcpProjectId(): string {
  return requireEnv("GCP_PROJECT_ID");
}

export function getGcsUploadBucket(): string {
  return requireEnv("GCS_UPLOAD_BUCKET");
}

export function getBigQueryConfig(): {
  projectId: string;
  location: string;
  dataset: string;
  table: string;
} {
  return {
    projectId: getGcpProjectId(),
    location: requireEnv("BQ_LOCATION"),
    dataset: requireEnv("BQ_DATASET"),
    table: requireEnv("BQ_TABLE"),
  };
}

export function getVertexConfig(): {
  projectId: string;
  location: string;
  model: string;
} {
  return {
    projectId: getGcpProjectId(),
    location: requireEnv("VERTEX_LOCATION"),
    model: requireEnv("VERTEX_MODEL"),
  };
}
