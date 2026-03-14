declare namespace NodeJS {
  interface ProcessEnv {
    GCP_PROJECT_ID?: string;
    GCS_UPLOAD_BUCKET?: string;
    BQ_LOCATION?: string;
    BQ_DATASET?: string;
    BQ_TABLE?: string;
    VERTEX_LOCATION?: string;
    VERTEX_MODEL?: string;
    GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
    GOOGLE_APPLICATION_CREDENTIALS?: string;
    DEBUG_SQL?: "1" | "0";
  }
}

export {};

