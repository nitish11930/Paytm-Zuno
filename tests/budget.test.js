import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("provider daily call budget persists across module restarts and prevents an extra upstream call", async () => {
  const dir = mkdtempSync(join(tmpdir(), "munim-budget-"));
  const old = {
    key: process.env.SARVAM_API_KEY,
    db: process.env.SARVAM_BUDGET_DB,
    limit: process.env.SARVAM_DAILY_CALL_LIMIT,
    fetch: global.fetch,
  };
  process.env.SARVAM_API_KEY = "synthetic-test-key";
  process.env.SARVAM_BUDGET_DB = join(dir, "budget.sqlite");
  process.env.SARVAM_DAILY_CALL_LIMIT = "1";
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const first = await import("../server/voice.js?budget-one");
    await first.sarvamRequest("/test", { method: "POST" });
    const restarted = await import("../server/voice.js?budget-two");
    await assert.rejects(
      () => restarted.sarvamRequest("/test", { method: "POST" }),
      /VOICE_BUDGET_EXHAUSTED/,
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = old.fetch;
    for (const [name, v] of [
      ["SARVAM_API_KEY", old.key],
      ["SARVAM_BUDGET_DB", old.db],
      ["SARVAM_DAILY_CALL_LIMIT", old.limit],
    ]) {
      if (v === undefined) delete process.env[name];
      else process.env[name] = v;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
