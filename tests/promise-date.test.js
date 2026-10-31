import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { extractPromise } from "../server/promise-date.js";
import { voiceLedgerTurn } from "../server/voice-ledger.js";
import {
  database,
  seed,
  dues,
  followUpQueue,
  cash,
  addEntry,
  propose,
  execute,
  day,
} from "../server/domain.js";
const turn = (text, r) => ({
  text,
  language: "hinglish",
  requestKey: randomUUID(),
  ...(r ? { draftId: r.draftId, version: r.version } : {}),
});
const credit = (name, date) => ({
  kind: "udhaar",
  name,
  amount: 10000,
  method: "cash",
  requestKey: randomUUID(),
  dueDate: date,
});
test("promise dates handle English/Hindi/Hinglish, rollover and invalid/ambiguous dates", () => {
  for (const text of [
    "teen din baad",
    "तीन दिन में",
    "in three days",
    "३ दिन बाद",
  ]) {
    assert.equal(extractPromise(text, "2026-10-31").date, "2026-11-03");
  }
  assert.equal(extractPromise("tomorrow", "2026-12-31").date, "2027-01-01");
  assert.equal(extractPromise("2 weeks", "2026-10-31").date, "2026-11-14");
  for (const text of [
    "2026-02-30",
    "2026-10-30",
    "400 din baad",
    "3 din ya 4 din",
    "next month",
  ]) {
    assert.equal(extractPromise(text, "2026-10-31").date, null);
  }
  assert.ok(
    !extractPromise("100 rupees, 3 din baad", "2026-10-31").text.includes(
      "3 din",
    ),
  );
});
test("voice udhaar captures promised date before explicit save, not as a rupee amount", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  seed(db, "m");
  try {
    let r = await voiceLedgerTurn(
      db,
      "m",
      turn("Nikhil ko 100 udhaar likho 3 din baad denge"),
    );
    assert.equal(r.stage, "confirm");
    assert.equal(r.draft.amount, 10000);
    assert.equal(r.draft.dueDate, day(3));
    assert.ok(r.answer.includes(day(3)));
    const before = cash(db, "m");
    r = await voiceLedgerTurn(db, "m", turn("haan save karo", r));
    assert.equal(r.stage, "saved");
    assert.equal(cash(db, "m"), before);
    assert.equal(followUpQueue(db, "m")[0].dueDate, day(3));
    let next = await voiceLedgerTurn(db, "m", turn("Ravi ko 200 udhaar likho"));
    assert.equal(next.stage, "promise");
    next = await voiceLedgerTurn(db, "m", turn("next month", next));
    assert.equal(next.stage, "promise");
    next = await voiceLedgerTurn(db, "m", turn("teen din baad", next));
    assert.equal(next.stage, "confirm");
    assert.equal(next.draft.amount, 20000);
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});
test("due-specific reminders require unpaid confirmation, stay scoped, reuse pending drafts and invalidate on payment", () => {
  const db = database(":memory:");
  seed(db, "m");
  seed(db, "other");
  const d = addEntry(db, "m", credit("Nikhil", day()));
  const future = addEntry(db, "m", credit("Ravi", day(3)));
  assert.throws(
    () => propose(db, "m", { dueId: d.id }),
    /PAYMENT_CHECK_REQUIRED/,
  );
  assert.throws(
    () => propose(db, "other", { dueId: d.id, unpaidConfirmed: true }),
    /DUE_NOT_FOUND/,
  );
  assert.throws(
    () => propose(db, "m", { dueId: future.id, unpaidConfirmed: true }),
    /FOLLOW_UP_NOT_DUE/,
  );
  const all = propose(db, "m");
  assert.equal(
    all.payload.some((r) => r.id.split(",").includes(future.id)),
    false,
  );
  const p = propose(db, "m", { dueId: d.id, unpaidConfirmed: true });
  assert.equal(p.payload.length, 1);
  assert.equal(p.payload[0].amount, 10000);
  assert.equal(p.payload[0].scopeDueId, d.id);
  assert.equal(
    propose(db, "m", { dueId: d.id, unpaidConfirmed: true }).id,
    p.id,
  );
  addEntry(db, "m", {
    kind: "collection",
    dueId: d.id,
    amount: 4000,
    name: "Nikhil",
    method: "cash",
    requestKey: randomUUID(),
  });
  assert.throws(() => execute(db, "m", p.id, true), /PROPOSAL_CHANGED/);
  const fresh = propose(db, "m", { dueId: d.id, unpaidConfirmed: true });
  assert.equal(fresh.payload[0].amount, 6000);
  const before = cash(db, "m");
  execute(db, "m", fresh.id, true);
  assert.equal(cash(db, "m"), before);
  addEntry(db, "m", {
    kind: "collection",
    dueId: d.id,
    amount: 6000,
    name: "Nikhil",
    method: "cash",
    requestKey: randomUUID(),
  });
  assert.equal(
    followUpQueue(db, "m").some((f) => f.dueId === d.id),
    false,
  );
  assert.throws(
    () => propose(db, "m", { dueId: d.id, unpaidConfirmed: true }),
    /DUE_NOT_FOUND/,
  );
  db.close();
});
