import test from "node:test";
import assert from "node:assert/strict";
import { cleanSql, enforceSafeSql } from "@/app/lib/sqlGuard";

const TABLE_FQN = "`p.d.t`";

test("cleanSql strips code fences and leading chatter", () => {
  const raw = "Here you go:\n```sql\nSELECT * FROM `p.d.t` LIMIT 1;\n```";
  assert.equal(cleanSql(raw), "SELECT * FROM `p.d.t` LIMIT 1;");
});

test("enforceSafeSql blocks non-select", () => {
  const out = enforceSafeSql("DELETE FROM `p.d.t` WHERE 1=1", { tableFqn: TABLE_FQN });
  assert.equal(out.ok, false);
});

test("enforceSafeSql blocks non-whitelisted table", () => {
  const out = enforceSafeSql("SELECT * FROM `p.d.other` LIMIT 1", { tableFqn: TABLE_FQN });
  assert.deepEqual(out, { ok: false, error: "Query must select from the CRM table" });
});

test("enforceSafeSql allows simple select from the CRM table", () => {
  const out = enforceSafeSql("SELECT * FROM `p.d.t` ORDER BY created_at DESC LIMIT 50", { tableFqn: TABLE_FQN });
  assert.equal(out.ok, true);
});
