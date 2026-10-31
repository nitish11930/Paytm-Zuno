import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  database,
  snapshot,
  seed,
  cash,
  dues,
  forecast,
  addEntry,
  propose,
  execute,
  resetDemo,
  followUpQueue,
  exportArchive,
} from "../server/domain.js";
import { parseIntent } from "../server/voice.js";
const input = (values) => ({
  kind: "sale",
  amount: 10000,
  name: "Counter",
  method: "cash",
  requestKey: randomUUID(),
  ...values,
});
test("cash excludes unpaid dues and day-3 shortfall reconciles exactly", () => {
  const db = database(":memory:");
  seed(db, "m");
  assert.equal(cash(db, "m"), 1200000);
  assert.equal(
    dues(db, "m").reduce((s, d) => s + d.outstanding, 0),
    1000000,
  );
  assert.equal(forecast(db, "m").points[2].balance, -1800000);
  assert.ok(forecast(db, "m", "conservative").points[2].balance < -1800000);
  db.close();
});
test("collections are capped, linked, atomic and idempotent", () => {
  const db = database(":memory:");
  seed(db, "m");
  const due = dues(db, "m")[0];
  const value = input({ kind: "collection", amount: 50000, dueId: due.id });
  const a = addEntry(db, "m", value);
  assert.equal(addEntry(db, "m", value).id, a.id);
  assert.equal(cash(db, "m"), 1250000);
  assert.equal(
    dues(db, "m").find((d) => d.id === due.id).outstanding,
    due.outstanding - 50000,
  );
  assert.throws(
    () =>
      addEntry(
        db,
        "m",
        input({ kind: "collection", amount: due.outstanding, dueId: due.id }),
      ),
    /COLLECTION_EXCEEDS_DUE/,
  );
  db.close();
});
test("reminder approval and repeated approval never add money or duplicate audit", () => {
  const db = database(":memory:");
  seed(db, "m");
  const p = propose(db, "m");
  execute(db, "m", p.id, true);
  assert.equal(execute(db, "m", p.id, true).replayed, true);
  assert.equal(cash(db, "m"), 1200000);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM audit WHERE event='reminder_simulated'",
      )
      .get().n,
    1,
  );
  db.close();
});
test("reject, stale and expired approvals", () => {
  const db = database(":memory:");
  seed(db, "m");
  const p = propose(db, "m");
  assert.equal(execute(db, "m", p.id, false).status, "rejected");
  const stale = propose(db, "m");
  addEntry(
    db,
    "m",
    input({ kind: "collection", amount: 100, dueId: dues(db, "m")[0].id }),
  );
  assert.throws(() => execute(db, "m", stale.id, true), /PROPOSAL_CHANGED/);
  const expired = propose(db, "m");
  db.prepare("UPDATE proposals SET expires=0 WHERE id=?").run(expired.id);
  assert.throws(() => execute(db, "m", expired.id, true), /APPROVAL_EXPIRED/);
  db.close();
});
test("merchant isolation for collections and approvals; reset only own data", () => {
  const db = database(":memory:");
  seed(db, "a");
  seed(db, "b");
  assert.throws(
    () =>
      addEntry(
        db,
        "a",
        input({ kind: "collection", dueId: dues(db, "b")[0].id }),
      ),
    /DUE_NOT_FOUND/,
  );
  const p = propose(db, "b");
  assert.throws(() => execute(db, "a", p.id, true), /ACTION_NOT_FOUND/);
  resetDemo(db, "a");
  assert.equal(cash(db, "b"), 1200000);
  db.close();
});
test("speech parser supports digits and Hindi words; ambiguous figures require review", () => {
  assert.equal(parseIntent("Sharma ji ko 2000 udhaar likho").amount, 200000);
  assert.equal(parseIntent("शर्मा जी को दो हजार उधार लिखो").amount, 200000);
  assert.equal(
    parseIntent("Sharma ji ko do hazaar udhaar likho").amount,
    200000,
  );
  assert.equal(parseIntent("500 nahi 1500").amount, null);
  assert.equal(parseIntent("शर्मा जी को २००० उधार").amount, 200000);
  assert.equal(parseIntent("hello").amount, null);
});
test("same customer gets one reminder covering multiple outstanding entries", () => {
  const db = database(":memory:");
  seed(db, "m");
  addEntry(
    db,
    "m",
    input({
      kind: "udhaar",
      name: "Sharma ji",
      amount: 50000,
      customerId: snapshot(db, "m").dues.find((d) => d.name === "Sharma ji")
        .customerId,
    }),
  );
  const p = propose(db, "m");
  assert.equal(p.payload.length, 4);
  assert.equal(p.payload.find((r) => r.name === "Sharma ji").amount, 250000);
  db.close();
});

test("personalized reminder snapshots use exact dues and become stale after shop changes", () => {
  const db = database(":memory:");
  seed(db, "friendly");
  db.prepare("UPDATE merchants SET shop=?,language=? WHERE id=?").run(
    "Gupta Kirana",
    "hindi",
    "friendly",
  );
  const p = propose(db, "friendly");
  for (const row of p.payload) {
    assert.ok(row.message.includes(row.name));
    assert.ok(row.message.includes("Gupta Kirana"));
    assert.ok(
      row.message.includes(
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format(row.amount / 100),
      ),
    );
    assert.ok(row.message.includes("भुगतान कर चुके"));
  }
  db.prepare("UPDATE merchants SET shop=? WHERE id=?").run(
    "New Shop",
    "friendly",
  );
  assert.throws(() => execute(db, "friendly", p.id, true), /PROPOSAL_CHANGED/);
  db.close();
});

test("dated dues queue tracks remaining amount, isolation, replay and closed dues", () => {
  const db = database(":memory:");
  seed(db, "dated");
  seed(db, "other");
  const entry = input({
    kind: "udhaar",
    amount: 20000,
    name: "Nikhil",
    dueDate: "2026-11-03",
  });
  const d = addEntry(db, "dated", entry);
  assert.equal(addEntry(db, "dated", entry).id, d.id);
  assert.throws(
    () => addEntry(db, "dated", { ...entry, dueDate: "2026-11-04" }),
    /IDEMPOTENCY_CONFLICT/,
  );
  assert.throws(
    () =>
      addEntry(db, "dated", input({ kind: "udhaar", dueDate: "2026-02-30" })),
    /INVALID_DUE_DATE/,
  );
  assert.throws(
    () => addEntry(db, "dated", input({ dueDate: "2026-11-03" })),
    /INVALID_DUE_DATE/,
  );
  assert.equal(followUpQueue(db, "dated", "2026-11-02")[0].status, "scheduled");
  assert.equal(
    followUpQueue(db, "dated", "2026-11-03")[0].status,
    "payment_check_required",
  );
  assert.equal(followUpQueue(db, "other").length, 0);
  addEntry(
    db,
    "dated",
    input({ kind: "collection", dueId: d.id, amount: 5000 }),
  );
  assert.equal(followUpQueue(db, "dated")[0].outstanding, 15000);
  assert.equal(exportArchive(db, "dated").tables.due_terms.length, 1);
  addEntry(
    db,
    "dated",
    input({ kind: "collection", dueId: d.id, amount: 15000 }),
  );
  assert.equal(followUpQueue(db, "dated").length, 0);
  resetDemo(db, "dated");
  assert.equal(followUpQueue(db, "dated").length, 0);
  db.close();
});
