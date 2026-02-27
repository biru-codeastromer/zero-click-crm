const DEFAULT_ALLOWED_COLUMNS = [
  "contact_name",
  "company_name",
  "deal_value_usd",
  "sentiment",
  "next_step",
  "follow_up_date",
  "full_summary",
  "at_risk",
  "transcript",
  "created_at",
] as const;

export type SqlGuardConfig = {
  tableFqn: string; // backticked
  allowedColumns?: readonly string[];
};

export function cleanSql(input: string | undefined): string {
  if (!input) return "";
  let s = input.trim();
  s = s.replace(/^```[\s\S]*?\n/, "").replace(/```$/g, "").trim();
  if (s.startsWith("`") && s.endsWith("`")) s = s.slice(1, -1).trim();
  const idx = s.toUpperCase().indexOf("SELECT ");
  if (idx > 0) s = s.slice(idx);
  return s.trim();
}

export function enforceSafeSql(
  sql: string,
  config: SqlGuardConfig
): { ok: true; sql: string } | { ok: false; error: string } {
  let s = sql.trim();
  if (!s) return { ok: false, error: "Empty SQL" };

  const allowedColumns = new Set(config.allowedColumns ?? DEFAULT_ALLOWED_COLUMNS);

  const semiCount = (s.match(/;/g) || []).length;
  if (semiCount > 1) return { ok: false, error: "Multiple statements are not allowed" };
  if (semiCount === 1 && !s.endsWith(";")) return { ok: false, error: "Multiple statements are not allowed" };
  if (s.endsWith(";")) s = s.slice(0, -1).trim();

  if (!/^SELECT\b/i.test(s)) return { ok: false, error: "Only SELECT queries are allowed" };
  if (/\b(WITH|UNION|JOIN)\b/i.test(s)) return { ok: false, error: "Query shape not allowed" };
  if (/\b(INFORMATION_SCHEMA|__TABLES__|__TABLES_SUMMARY__)\b/i.test(s))
    return { ok: false, error: "System tables are not allowed" };
  if (/\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|EXECUTE)\b/i.test(s))
    return { ok: false, error: "Only read-only queries are allowed" };

  const tableFqn = config.tableFqn;
  const tablePattern = new RegExp(String.raw`\\bFROM\\s+${escapeRegExp(tableFqn)}\\b`, "i");
  if (!tablePattern.test(s)) return { ok: false, error: "Query must select from the CRM table" };

  const fqnMatches = s.match(/`?[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+`?/g) || [];
  for (const fqn of fqnMatches) {
    const normalized = fqn.replace(/`/g, "");
    const allowed = tableFqn.replace(/`/g, "");
    if (normalized !== allowed) return { ok: false, error: "Query references a non-whitelisted table" };
  }

  const backticked = s.match(/`([^`]+)`/g) || [];
  for (const token of backticked) {
    const inner = token.slice(1, -1);
    if (inner === tableFqn.replace(/`/g, "")) continue;
    if (!allowedColumns.has(inner)) return { ok: false, error: `Disallowed identifier: ${inner}` };
  }

  return { ok: true, sql: s };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
