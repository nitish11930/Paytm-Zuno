process.env.SARVAM_BUDGET_DB = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import { understand } from "../server/understanding.js";
import { parseIntent } from "../server/voice.js";
test("validated model understanding handles received dues, ambiguous digits, fallback and cancellation", async () => {
  const saved = process.env.SARVAM_API_KEY,
    original = global.fetch;
  process.env.SARVAM_API_KEY = "dummy-test-key";
  try {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                topic: "dues",
                kind: "collection",
                amount: 500,
                name: "Sharma ji",
                method: null,
                negated: false,
              }),
            },
          },
        ],
      }),
    });
    const r = await understand("Sharma ji se 500 udhaar receive hua");
    assert.equal(r.model, true);
    assert.equal(r.topic, "entry");
    assert.equal(r.kind, "collection");
    assert.equal(r.amount, 50000);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                topic: "entry",
                kind: "sale",
                amount: 900,
                name: "Counter",
                method: "cash",
                negated: false,
              }),
            },
          },
        ],
      }),
    });
    assert.equal((await understand("Record sale of 500 rupees")).amount, null);
    global.fetch = async () => ({ ok: false, status: 503 });
    const f = await understand("Sharma ji se 500 udhaar receive hua");
    assert.equal(f.model, false);
    assert.equal(f.kind, "collection");
    assert.equal(parseIntent("unpaid sale of 500").kind, "udhaar");
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                topic: "reminders",
                kind: null,
                amount: null,
                name: "",
                method: null,
                negated: true,
              }),
            },
          },
        ],
      }),
    });
    assert.equal((await understand("Reminders mat bhejna")).negated, true);
  } finally {
    global.fetch = original;
    if (saved === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = saved;
  }
});
