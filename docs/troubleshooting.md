# Troubleshooting

## `next: command not found`

Run `npm install` first, then `npm run dev`.

## Signed upload fails (403 / CORS)

- Ensure `GCS_UPLOAD_BUCKET` exists and your service account has write access.
- Confirm the bucket CORS policy allows `PUT` from your web origin if needed.

## `/api/get-entries` fails

- Verify `BQ_LOCATION`, `BQ_DATASET`, `BQ_TABLE`.
- Ensure the BigQuery table exists (see `docs/bq_schema.sql`) and IAM permissions allow `bigquery.jobs.create` + table read.

## `/api/search` fails

- Verify `VERTEX_LOCATION` and `VERTEX_MODEL`.
- If SQL is rejected, enable `DEBUG_SQL=1` to log the generated SQL and rejection reason.

