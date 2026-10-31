process.env.SARVAM_BUDGET_DB = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  database,
  seed,
  snapshot,
  addEntry,
  reverseEntry,
  forecast,
  day,
  resetDemo,
} from "../server/domain.js";
import { addSchedule, changeSchedule, schedules } from "../server/planning.js";
import { voiceAnswer, assistantAnswer } from "../server/advisor.js";
import { createApp } from "../server/app.js";
const entry = (v) => ({
  kind: "sale",
  amount: 50000,
  name: "Counter",
  method: "cash",
  requestKey: randomUUID(),
  ...v,
});
test("planning inputs are persisted, rescheduling changes forecast without changing cash", () => {
  const db = database(":memory:");
  seed(db, "a");
  const f = forecast(db, "a"),
    rent = f.obligations.find((o) => o.label === "Shop rent");
  assert.equal(f.points[2].balance, -1800000);
  changeSchedule(db, "a", rent.id, {
    version: rent.version,
    label: rent.label,
    amount: rent.amount,
    date: day(6),
  });
  assert.equal(forecast(db, "a").points[2].balance, -600000);
  assert.equal(snapshot(db, "a").cash, 1200000);
  assert.equal(forecast(db, "a").points[5].balance, -1440000);
  db.close();
});
test("expected receipts are not cash; recording a scheduled receipt consumes it once; reversal restores it", () => {
  const db = database(":memory:");
  seed(db, "a");
  const item = addSchedule(db, "a", {
    direction: "in",
    label: "Confirmed incoming invoice",
    amount: 50000,
    date: day(2),
    requestKey: randomUUID(),
  });
  assert.equal(snapshot(db, "a").cash, 1200000);
  const before = forecast(db, "a").points[2].balance;
  const paid = addEntry(
    db,
    "a",
    entry({ scheduleId: item.id, scheduleVersion: item.version }),
  );
  assert.equal(snapshot(db, "a").cash, 1250000);
  assert.equal(forecast(db, "a").points[2].balance, before);
  assert.equal(
    schedules(db, "a").some((r) => r.id === item.id),
    false,
  );
  reverseEntry(db, "a", paid.id, "Mistaken receipt", randomUUID());
  assert.equal(snapshot(db, "a").cash, 1200000);
  assert.equal(
    schedules(db, "a").some((r) => r.id === item.id),
    true,
  );
  db.close();
});
test("reversal preserves history, restores dues, protects collected credit and is idempotent", () => {
  const db = database(":memory:");
  seed(db, "a");
  const due = snapshot(db, "a").dues[0];
  const payment = addEntry(
    db,
    "a",
    entry({ kind: "collection", dueId: due.id }),
  );
  assert.throws(
    () => reverseEntry(db, "a", due.id, "Wrong due", randomUUID()),
    /REVERSE_COLLECTIONS_FIRST/,
  );
  const key = randomUUID();
  reverseEntry(db, "a", payment.id, "Wrong amount", key);
  assert.equal(
    reverseEntry(db, "a", payment.id, "Wrong amount", key).replayed,
    true,
  );
  assert.equal(snapshot(db, "a").pending, 1000000);
  reverseEntry(db, "a", due.id, "Duplicate due", randomUUID());
  assert.equal(snapshot(db, "a").pending, 1000000 - due.amount);
  assert.ok(snapshot(db, "a").entries.find((e) => e.id === due.id).reversed);
  db.close();
});
test("idempotency rejects changed financial details and tenant scope protects plan/reversals", () => {
  const db = database(":memory:");
  seed(db, "a");
  seed(db, "b");
  const v = entry({});
  const r = addEntry(db, "a", v);
  assert.throws(
    () => addEntry(db, "a", { ...v, amount: 90000 }),
    /IDEMPOTENCY_CONFLICT/,
  );
  assert.throws(
    () => reverseEntry(db, "b", r.id, "Wrong", randomUUID()),
    /ENTRY_NOT_FOUND/,
  );
  const other = forecast(db, "b").obligations[0];
  assert.throws(
    () => changeSchedule(db, "a", other.id, { status: "cancelled" }),
    /PLAN_ITEM_NOT_FOUND/,
  );
  db.close();
});
test("overdue payments remain in projection and cancelled receipts no longer appear", () => {
  const db = database(":memory:");
  seed(db, "a");
  const payment = forecast(db, "a").obligations[0];
  changeSchedule(db, "a", payment.id, {
    version: payment.version,
    label: payment.label,
    date: day(-1),
    amount: payment.amount,
  });
  assert.equal(forecast(db, "a").points[0].outflow, payment.amount);
  const receipt = schedules(db, "a").find((r) => r.direction === "in");
  changeSchedule(db, "a", receipt.id, {
    status: "cancelled",
    version: receipt.version,
  });
  assert.equal(
    schedules(db, "a").some((r) => r.id === receipt.id),
    false,
  );
  db.close();
});
test("business questions explain drivers, residual gap and refusal without creating entries", () => {
  const db = database(":memory:");
  seed(db, "a");
  const n = snapshot(db, "a").entries.length;
  const why = voiceAnswer(db, "a", "Why is my cash short?", "english");
  assert.match(why.answer, /Supplier payment/);
  assert.match(why.answer, /18,000/);
  const plan = voiceAnswer(db, "a", "What should I do?", "english");
  assert.match(plan.answer, /8,000/);
  assert.equal(plan.suggestedAction, "review_reminders");
  assert.match(
    voiceAnswer(db, "a", "Reminders mat bhejna", "hinglish").answer,
    /Koi action nahi/,
  );
  assert.equal(snapshot(db, "a").entries.length, n);
  db.close();
});
test("sign-out revokes device resume; public demo login opens an isolated fresh shop", async () => {
  const db = database(":memory:");
  const app = createApp(db),
    a = request.agent(app),
    b = request.agent(app);
  const creds = { phone: "9876543210", pin: "123456" };
  await a.post("/api/auth/login").send(creds).expect(200);
  const first = (await a.get("/api/state")).body;
  await a.post("/api/auth/logout").send({}).expect(200);
  await a.post("/api/auth/login").send(creds).expect(200);
  assert.notEqual(
    (await a.get("/api/state")).body.merchant.id,
    first.merchant.id,
  );
  await b.post("/api/auth/login").send(creds);
  assert.notEqual(
    (await b.get("/api/state")).body.merchant.id,
    first.merchant.id,
  );
  await a.post("/api/demo/reset").send({}).expect(200);
  db.close();
});
test("malformed date is rejected by the API", async () => {
  const db = database(":memory:");
  const a = request.agent(createApp(db));
  await a.post("/api/auth/login").send({ phone: "9876543210", pin: "123456" });
  await a
    .post("/api/schedule")
    .send({
      direction: "out",
      label: "Rent",
      amount: 100,
      date: "2026-02-31",
      requestKey: randomUUID(),
    })
    .expect(400);
  db.close();
});
