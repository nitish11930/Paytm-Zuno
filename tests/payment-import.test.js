import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  database,
  seed,
  cash,
  snapshot,
  addEntry,
  resetDemo,
  exportArchive,
  day,
  reverseEntry,
} from "../server/domain.js";
import {
  parseCsv,
  importColumns,
  previewImport,
  confirmImport,
  classifyPayment,
} from "../server/payment-import.js";
import { voiceLedgerTurn } from "../server/voice-ledger.js";
import { createApp } from "../server/app.js";
const mapping = {
  reference: "reference",
  date: "date",
  amount: "amount",
  status: "status",
  name: "name",
  recordType: "record_type",
};
const csv = (rows) =>
  "reference,date,amount,status,name,record_type\n" + rows.join("\n");
const payment = (ref, amount = 125, date = day(-1)) =>
  `${ref},${date},${amount},SUCCESS,Nikhil,payment`;
const receipt = { category: "receipt", receivedConfirmed: true };
function imported(db, m, rows) {
  const p = previewImport(db, m, csv(rows), mapping, "payment");
  confirmImport(db, m, p.batchId);
  return db
    .prepare("SELECT * FROM imported_payments WHERE merchant=? ORDER BY rowid")
    .all(m);
}

test("CSV quotes, headers, decimal paise and explicit Indian dates are validated", () => {
  assert.equal(
    parseCsv('\ufeffreference,name\r\nP1,"Sharma, Nikhil"').rows[0][1],
    "Sharma, Nikhil",
  );
  for (const value of ["a,a\n1,2", "a,b\n1", 'a,b\n"unclosed,2'])
    assert.throws(() => parseCsv(value), /IMPORT_/);
  const db = database(":memory:");
  seed(db, "m");
  const dmy = day(-1).split("-").reverse().join("/");
  const p = previewImport(
    db,
    "m",
    csv([`p,${dmy},0.01,SUCCESS,Nikhil,payment`]),
    mapping,
    "payment",
    "dmySlash",
  );
  assert.equal(p.rows[0].amount, 1);
  assert.equal(p.rows[0].date, day(-1));
  for (const row of [
    payment("p", "1.001"),
    payment("p", "-1"),
    "p,2026-02-30,10,SUCCESS,Nikhil,payment",
    "p,2026-02-30T12:00:00Z,10,SUCCESS,Nikhil,payment",
    payment("p", 10, day(1)),
    `p,${day()},10,REFUNDED,Nikhil,payment`,
  ])
    assert.throws(
      () => previewImport(db, "m", csv([row]), mapping, "payment"),
      /IMPORT_/,
    );
  assert.throws(
    () =>
      previewImport(
        db,
        "m",
        csv([`p,${day()},"1,2",SUCCESS,Nikhil,payment`]),
        mapping,
        "payment",
      ),
    /IMPORT_INVALID_AMOUNT/,
  );
  assert.throws(
    () =>
      previewImport(
        db,
        "m",
        csv([payment("repeat"), payment("repeat")]),
        mapping,
        "payment",
      ),
    /IMPORT_DUPLICATE_ROWS/,
  );
  assert.equal(
    importColumns(csv([payment("one")])).suggested.reference,
    "reference",
  );
  db.close();
});

test("report import is atomic, scoped, replay-safe and never changes cash by itself", () => {
  const db = database(":memory:");
  seed(db, "m");
  seed(db, "other");
  const before = cash(db, "m");
  const p = previewImport(
    db,
    "m",
    csv([
      payment("P1"),
      `S1,${day()},125,SETTLED,Bank,settlement`,
      `F1,${day()},10,FAILED,No,payment`,
    ]),
    mapping,
    "payment",
  );
  assert.equal(p.skipped, 1);
  assert.throws(
    () => confirmImport(db, "other", p.batchId),
    /ACTION_NOT_FOUND/,
  );
  assert.equal(confirmImport(db, "m", p.batchId).imported, 2);
  assert.equal(confirmImport(db, "m", p.batchId).replayed, true);
  assert.equal(cash(db, "m"), before);
  const second = previewImport(
    db,
    "m",
    csv([payment("P1")]),
    mapping,
    "payment",
  );
  assert.equal(confirmImport(db, "m", second.batchId).duplicates, 1);
  assert.throws(
    () => previewImport(db, "m", csv([payment("P1", 130)]), mapping, "payment"),
    /IMPORT_CONFLICT/,
  );
  assert.equal(exportArchive(db, "m").tables.imported_payments.length, 2);
  const other = previewImport(
    db,
    "other",
    csv([payment("P1")]),
    mapping,
    "payment",
  );
  assert.equal(confirmImport(db, "other", other.batchId).imported, 1);
  const row = db
    .prepare(
      "SELECT * FROM imported_payments WHERE merchant=? AND record_type='settlement'",
    )
    .get("m");
  assert.throws(
    () => classifyPayment(db, "m", row.id, receipt),
    /SETTLEMENT_NOT_INCOME/,
  );
  resetDemo(db, "m");
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM imported_payments WHERE merchant='m'")
      .get().n,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM imported_payments WHERE merchant='other'",
      )
      .get().n,
    1,
  );
  db.close();
});

test("classification preserves historical day and separates receipts, sales, credit and settlement", () => {
  const db = database(":memory:");
  seed(db, "m");
  const before = cash(db, "m");
  const [r] = imported(db, "m", [payment("R1", 125, day(-5))]);
  assert.throws(
    () => classifyPayment(db, "m", r.id, { category: "receipt" }),
    /IMPORT_RECEIPT_CONFIRMATION/,
  );
  const result = classifyPayment(db, "m", r.id, receipt);
  assert.equal(classifyPayment(db, "m", r.id, receipt).replayed, true);
  assert.equal(cash(db, "m"), before + 12500);
  let state = snapshot(db, "m");
  const e = state.entries.find((e) => e.id === result.entryId);
  assert.equal(e.date, day(-5));
  assert.equal(e.source, "report_unverified");
  const book = state.dayBooks.find((b) => b.date === day(-5));
  assert.equal(book.inflow, 12500);
  assert.equal(book.otherReceipts, 12500);
  assert.equal(book.sales, 0);
  reverseEntry(db, "m", e.id, "wrong report classification", randomUUID());
  assert.equal(cash(db, "m"), before);
  assert.equal(
    snapshot(db, "m").paymentInbox[0].reversed,
    "wrong report classification",
  );
  db.close();
});

test("matching manual entry links without duplicate income; another payment requires separate confirmation", () => {
  const db = database(":memory:");
  seed(db, "m");
  seed(db, "other");
  const e = addEntry(db, "m", {
    kind: "sale",
    name: "Nikhil",
    method: "upi",
    amount: 10000,
    requestKey: randomUUID(),
  });
  const [p1, p2] = imported(db, "m", [
    payment("P1", 100, day()),
    payment("P2", 100, day()),
  ]);
  const before = cash(db, "m");
  assert.throws(
    () => classifyPayment(db, "m", p1.id, receipt),
    /IMPORT_POSSIBLE_DUPLICATE/,
  );
  assert.throws(
    () =>
      classifyPayment(db, "other", p1.id, { category: "link", entryId: e.id }),
    /ENTRY_NOT_FOUND/,
  );
  classifyPayment(db, "m", p1.id, { category: "link", entryId: e.id });
  assert.equal(cash(db, "m"), before);
  assert.throws(
    () => classifyPayment(db, "m", p2.id, { category: "link", entryId: e.id }),
    /IMPORT_ALREADY_LINKED/,
  );
  classifyPayment(db, "m", p2.id, { ...receipt, separateConfirmed: true });
  assert.equal(cash(db, "m"), before + 10000);
  db.close();
});

test("imported collection requires linked same-merchant due and updates cash without another sale", () => {
  const db = database(":memory:");
  seed(db, "m");
  seed(db, "other");
  const due = snapshot(db, "m").dues[0],
    foreign = snapshot(db, "other").dues[0];
  const [p] = imported(db, "m", [payment("C1", 50, day())]);
  const before = cash(db, "m"),
    sales = snapshot(db, "m").salesToday;
  assert.throws(
    () =>
      classifyPayment(db, "m", p.id, {
        category: "collection",
        dueId: foreign.id,
        receivedConfirmed: true,
      }),
    /DUE_NOT_FOUND/,
  );
  classifyPayment(db, "m", p.id, {
    category: "collection",
    dueId: due.id,
    receivedConfirmed: true,
  });
  assert.equal(cash(db, "m"), before + 5000);
  assert.equal(snapshot(db, "m").salesToday, sales);
  assert.equal(
    snapshot(db, "m").dues.find((d) => d.id === due.id).outstanding,
    due.outstanding - 5000,
  );
  db.close();
});

test("Hey Zuno prefix works in active sessions without enabling always-on listening", async () => {
  const old = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const db = database(":memory:");
  seed(db, "m");
  try {
    const r = await voiceLedgerTurn(db, "m", {
      text: "Hey Zuno, Nikhil ko 100 udhaar likho",
      language: "hinglish",
      requestKey: randomUUID(),
    });
    assert.equal(r.draft.name, "Nikhil");
    assert.equal(r.draft.amount, 10000);
    assert.equal(r.stage, "promise");
  } finally {
    db.close();
    if (old !== undefined) process.env.SARVAM_API_KEY = old;
  }
});

test("import endpoints enforce authentication, schema and cross-origin protection", async () => {
  const db = database(":memory:"),
    app = createApp(db),
    a = request.agent(app);
  await a
    .post("/api/payments/preview")
    .send({ csv: csv([payment("P")]) })
    .expect(401);
  await a
    .post("/api/auth/login")
    .send({ phone: "9876543210", pin: "123456" })
    .expect(200);
  await a
    .post("/api/payments/preview")
    .set("Origin", "https://evil.example")
    .send({ csv: csv([payment("P")]) })
    .expect(403);
  const r = await a
    .post("/api/payments/preview")
    .send({ csv: csv([payment("P")]), mapping, defaultType: "payment" })
    .expect(200);
  await a
    .post(`/api/payments/imports/${r.body.batchId}/confirm`)
    .send({})
    .expect(200);
  const id = db.prepare("SELECT id FROM imported_payments").get().id;
  await a
    .post(`/api/payments/${id}/classify`)
    .send({ category: "receipt" })
    .expect(400);
  await a.post(`/api/payments/${id}/classify`).send(receipt).expect(200);
  db.close();
});
