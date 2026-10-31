import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  database,
  seed,
  cash,
  dues,
  resetDemo,
  addEntry,
  day,
} from "../server/domain.js";
import {
  voiceLedgerTurn,
  initializeVoiceLedger,
  currentVoiceLedger,
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
test("tap-to-speak audio still requires an authenticated merchant", async () => {
  const db = database(":memory:");
  try {
    await request(createApp(db))
      .post("/api/voice/ledger/audio")
      .field("language", "hinglish")
      .field("requestKey", randomUUID())
      .attach("audio", Buffer.from("sample"), {
        filename: "sample.wav",
        contentType: "audio/wav",
      })
      .expect(401);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM voice_drafts").get().n, 0);
  } finally {
    db.close();
  }
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

test("reopening voice restores the exact pending question and saved outcome, scoped by merchant", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  seed(db, "m");
  seed(db, "other");
  try {
    let r = await voiceLedgerTurn(
      db,
      "m",
      message("Hey Zuno Nikhil ko 100 udhaar likho"),
    );
    assert.equal(r.stage, "promise");
    assert.deepEqual(currentVoiceLedger(db, "m"), r);
    assert.equal(currentVoiceLedger(db, "other"), null);
    r = await voiceLedgerTurn(db, "m", message("teen din baad", r));
    assert.equal(r.stage, "confirm");
    assert.deepEqual(currentVoiceLedger(db, "m"), r);
    r = await voiceLedgerTurn(db, "m", message("confirm save", r));
    assert.equal(currentVoiceLedger(db, "m").draft.entryId, r.draft.entryId);
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});

test("due-day voice followup checks receipt first and saves a scoped draft without pretending WhatsApp delivery", async () => {
  const db = database(":memory:");
  seed(db, "m");
  const due = addEntry(db, "m", {
    kind: "udhaar",
    name: "Nikhil",
    amount: 10000,
    method: "cash",
    dueDate: day(),
    requestKey: randomUUID(),
  });
  const before = cash(db, "m");
  let r = await voiceLedgerTurn(db, "m", {
    ...message("check payment"),
    followUpDueId: due.id,
  });
  assert.equal(r.stage, "payment_check");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM proposals").get().n, 0);
  r = await voiceLedgerTurn(db, "m", message("not sure", r));
  assert.equal(r.stage, "payment_check");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM proposals").get().n, 0);
  r = await voiceLedgerTurn(db, "m", message("nahi diye", r));
  assert.equal(r.stage, "reminder_review");
  assert.ok(r.draft.message.includes("Nikhil"));
  r = await voiceLedgerTurn(db, "m", message("WhatsApp pe bhej do", r));
  assert.equal(r.stage, "delivery_pending");
  assert.ok(r.answer.includes("connected nahi"));
  assert.equal(cash(db, "m"), before);
  assert.equal(
    db
      .prepare("SELECT status FROM proposals WHERE id=?")
      .get(r.draft.proposalId).status,
    "pending",
  );
  db.close();
});

test("payment during voice reminder review prevents stale recovery action", async () => {
  const db = database(":memory:");
  seed(db, "m");
  const due = addEntry(db, "m", {
    kind: "udhaar",
    name: "Nikhil",
    amount: 10000,
    method: "cash",
    dueDate: day(),
    requestKey: randomUUID(),
  });
  let r = await voiceLedgerTurn(db, "m", {
    ...message("check payment"),
    followUpDueId: due.id,
  });
  r = await voiceLedgerTurn(db, "m", message("not received", r));
  assert.equal(r.stage, "reminder_review");
  addEntry(db, "m", {
    kind: "collection",
    name: "Nikhil",
    dueId: due.id,
    amount: 10000,
    method: "cash",
    requestKey: randomUUID(),
  });
  r = await voiceLedgerTurn(db, "m", message("send on WhatsApp", r));
  assert.equal(r.stage, "complete");
  db.close();
});

test("audio route carries clarification through to a saved ledger entry and safe replay", async () => {
  const oldKey = process.env.SARVAM_API_KEY,
    oldFetch = global.fetch;
  process.env.SARVAM_API_KEY = "dummy-test-key";
  const spoken = [
    "Hey Zuno Nikhil ko 100 udhaar likho",
    "teen din baad",
    "हाँ सेव कर दो",
  ];
  let stt = 0;
  global.fetch = async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("speech-to-text")
        ? { transcript: spoken[stt++] }
        : {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    topic: "entry",
                    kind: "udhaar",
                    amount: 100,
                    name: "Nikhil",
                    method: "cash",
                    negated: false,
                  }),
                },
              },
            ],
          },
  });
  const db = database(":memory:"),
    app = createApp(db),
    a = request.agent(app);
  try {
    await a
      .post("/api/auth/login")
      .send({ phone: "9876543210", pin: "123456" })
      .expect(200);
    const send = (prior, key, bytes) => {
      let req = a
        .post("/api/voice/ledger/audio")
        .field("language", "hinglish")
        .field("requestKey", key);
      if (prior)
        req = req
          .field("draftId", prior.draftId)
          .field("version", String(prior.version));
      return req.attach("audio", Buffer.from(bytes), {
        filename: "mock.wav",
        contentType: "audio/wav",
      });
    };
    let r = (await send(null, randomUUID(), "one").expect(200)).body;
    assert.equal(r.stage, "promise");
    r = (await send(r, randomUUID(), "two").expect(200)).body;
    assert.equal(r.stage, "confirm");
    const previous = r,
      key = randomUUID();
    r = (await send(previous, key, "three").expect(200)).body;
    assert.equal(r.stage, "saved");
    assert.ok(r.draft.entryId);
    assert.deepEqual((await send(previous, key, "three").expect(200)).body, r);
    assert.equal(stt, 3);
    const state = (await a.get("/api/state").expect(200)).body;
    assert.ok(state.entries.some((e) => e.id === r.draft.entryId));
    assert.ok(state.dues.some((d) => d.id === r.draft.entryId));
    assert.equal(
      (await a.get("/api/voice/ledger/current").expect(200)).body.stage,
      "saved",
    );
  } finally {
    db.close();
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = oldKey;
  }
});

test("repayment question is concise and a saved entry allows a separate new draft", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  seed(db, "next");
  initializeVoiceLedger(db);
  try {
    let r = await voiceLedgerTurn(
      db,
      "next",
      message("Sharma ko 200 udhaar likho"),
    );
    assert.equal(r.stage, "promise");
    assert.equal(r.answer, "Udhaar kab lautayenge? Koi date tay hai?");
    r = await voiceLedgerTurn(db, "next", message("teen din baad", r));
    r = await voiceLedgerTurn(db, "next", message("confirm save", r));
    assert.equal(r.stage, "saved");
    const next = await voiceLedgerTurn(
      db,
      "next",
      message("Nikhil ko 100 udhaar likho"),
    );
    assert.equal(next.stage, "promise");
    assert.notEqual(next.draftId, r.draftId);
    assert.equal(next.draft.amount, 10000);
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});
