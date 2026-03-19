# Security Notes

## AI-Generated SQL Guardrails

`/api/search` prompts Gemini to produce BigQuery SQL, but the output is checked before execution:

- Only a single `SELECT` statement is allowed
- The query must select from the configured CRM table only
- Queries that use `JOIN`, `UNION`, or `WITH` are rejected
- Common DDL/DML keywords are rejected

These guardrails reduce the risk of prompt injection or unintended access to other datasets.

