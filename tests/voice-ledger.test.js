import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { database, seed, cash, dues, resetDemo } from "../server/domain.js";
import {
  voiceLedgerTurn,
  initializeVoiceLedger,
} from "../server/voice-ledger.js";
import { createApp } from "../server/app.js";

const message = (text, previous, key = randomUUID()) => ({
  text,
  language: "hinglish",
  requestKey: key,
  ...(previous ? { draftId: previous.draftId, version: previous.version } : {}),
});
test("multi-turn voice ledger confirms once, isolates drafts and rejects stale turns", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  initializeVoiceLedger(db);
  seed(db, "owner");
  seed(db, "stranger");
  try {
    const before = cash(db, "owner");
    let r = await voiceLedgerTurn(
      db,
      "owner",
      message("Nikhil ko 200 udhaar likho"),
    );
    assert.equal(r.stage, "promise");
    r = await voiceLedgerTurn(db, "owner", message("date nahi", r));
    assert.equal(r.stage, "confirm");
    assert.equal(cash(db, "owner"), before);
    await assert.rejects(
      voiceLedgerTurn(db, "stranger", message("haan save karo", r)),
      /ACTION_NOT_FOUND/,
    );
    let oldDraft = r;
    r = await voiceLedgerTurn(db, "owner", message("haan", r));
    assert.equal(r.stage, "confirm");
    await assert.rejects(
      voiceLedgerTurn(db, "owner", message("haan save karo", oldDraft)),
      /VOICE_DRAFT_CHANGED/,
    );
    const input = message("haan save karo", r);
    r = await voiceLedgerTurn(db, "owner", input);
    assert.equal(r.stage, "saved");
    assert.equal(cash(db, "owner"), before);
    assert.deepEqual(await voiceLedgerTurn(db, "owner", input), r);
    assert.equal(
      dues(db, "owner").filter((d) => d.name === "Nikhil").length,
      1,
    );
    await assert.rejects(
      voiceLedgerTurn(db, "owner", { ...input, text: "cancel" }),
      /IDEMPOTENCY_CONFLICT/,
    );
    resetDemo(db, "owner");
    assert.equal(
      db
        .prepare("SELECT COUNT(*) n FROM voice_drafts WHERE merchant=?")
        .get("owner").n,
      0,
    );
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});
test("missing fields are clarified, explicit completed method required, cancellation saves nothing", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  initializeVoiceLedger(db);
  seed(db, "m");
  try {
    let r = await voiceLedgerTurn(db, "m", message("sale record karo"));
    assert.equal(r.stage, "amount");
    r = await voiceLedgerTurn(db, "m", message("50", r));
    assert.equal(r.stage, "name");
    r = await voiceLedgerTurn(db, "m", message("Counter", r));
    assert.equal(r.stage, "method");
    r = await voiceLedgerTurn(db, "m", message("not paid", r));
    assert.equal(r.stage, "method");
    r = await voiceLedgerTurn(db, "m", message("cash", r));
    assert.equal(r.stage, "confirm");
    const before = cash(db, "m");
    r = await voiceLedgerTurn(db, "m", message("cancel", r));
    assert.equal(r.stage, "cancelled");
    assert.equal(cash(db, "m"), before);
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});
test("unmatched owner audio is blocked before Sarvam and no draft is created", async () => {
  const db = database(":memory:");
  const app = createApp(db, {
    ownerVerifier: async () => {
      const e = new Error("OWNER_VOICE_MISMATCH");
      e.status = 403;
      throw e;
    },
  });
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ phone: "9876543210", pin: "123456" })
    .expect(200);
  await agent
    .post("/api/voice/ledger/audio")
    .field("language", "hinglish")
    .field("requestKey", randomUUID())
    .attach("audio", Buffer.from("unverified"), {
      filename: "sample.wav",
      contentType: "audio/wav",
    })
    .expect(403);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM voice_drafts").get().n, 0);
  db.close();
});

test("cash sale requires final confirmation, expiry blocks saving and quantity replies stay unresolved", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  seed(db, "m");
  try {
    let r = await voiceLedgerTurn(db, "m", message("sale record karo"));
    r = await voiceLedgerTurn(db, "m", message("two packets", r));
    assert.equal(r.stage, "amount");
    r = await voiceLedgerTurn(db, "m", message("two hundred rupees", r));
    assert.equal(r.draft.amount, 20000);
    r = await voiceLedgerTurn(db, "m", message("Counter", r));
    r = await voiceLedgerTurn(db, "m", message("cash", r));
    assert.equal(r.stage, "confirm");
    const before = cash(db, "m");
    r = await voiceLedgerTurn(db, "m", message("confirm save", r));
    assert.equal(cash(db, "m"), before + 20000);
    assert.ok(r.draft.entryId);
    let expired = await voiceLedgerTurn(
      db,
      "m",
      message("Nikhil ko 100 udhaar likho"),
    );
    db.prepare("UPDATE voice_drafts SET expires=0 WHERE id=?").run(
      expired.draftId,
    );
    await assert.rejects(
      voiceLedgerTurn(db, "m", message("haan save karo", expired)),
      /VOICE_DRAFT_CHANGED/,
    );
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});
