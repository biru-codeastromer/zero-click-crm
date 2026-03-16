# Cloud Function Backend

This folder contains the Google Cloud Function that runs the voice ingestion pipeline:

`GCS upload` → `Speech-to-Text` → `Gemini JSON extraction` → `BigQuery insert`

## Configuration

The function reads the same environment variables as the Next.js app:

- `GCP_PROJECT_ID`
- `VERTEX_LOCATION`, `VERTEX_MODEL`
- `BQ_DATASET`, `BQ_TABLE`

## Notes

- The function is triggered by a GCS "object finalized" event.
- Audio support is best for `.wav`, `.mp3`, `.ogg`, `.webm` (and some `.m4a/.mp4` depending on Speech-to-Text codec support).
- For failed runs, configure retries and/or a dead-letter topic in GCP to avoid silent drops.

