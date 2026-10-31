import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import {
  database,
  seed,
  snapshot,
  addEntry,
  reverseEntry,
  propose,
  exportArchive,
  day,
} from "../server/domain.js";
import { addSchedule, changeSchedule, schedules } from "../server/planning.js";
import { renderAnswer } from "../server/advisor.js";
import { createApp } from "../server/app.js";
import { backup, verify } from "../scripts/backup.mjs";
const entry = (v) => ({
  kind: "sale",
  amount: 50000,
  name: "Counter",
  method: "cash",
  requestKey: randomUUID(),
  ...v,
});
const creds = { phone: "9876543210", pin: "123456" };
test("logout revokes device access; private key recovers exact workspace across devices and rotates", async () => {
  const db = database(":memory:");
  const app = createApp(db),
    a = request.agent(app),
    b = request.agent(app);
  await a.post("/api/auth/login").send(creds).expect(200);
  const original = (await a.get("/api/state")).body.merchant.id;
  const key = (await a.post("/api/auth/recovery-key").send({}).expect(200)).body
    .key;
  assert.equal(
    db.prepare("SELECT hash FROM workspace_access").get().hash,
    createHash("sha256").update(key).digest("hex"),
  );
  await a.post("/api/auth/logout").send({}).expect(200);
  await a.get("/api/state").expect(401);
  await a.post("/api/auth/login").send(creds).expect(200);
  assert.notEqual((await a.get("/api/state")).body.merchant.id, original);
  await b.post("/api/auth/login").send({ recoveryKey: key }).expect(200);
  assert.equal((await b.get("/api/state")).body.merchant.id, original);
  const replacement = (await b.post("/api/auth/recovery-key").send({})).body
    .key;
  await request(app)
    .post("/api/auth/login")
    .send({ recoveryKey: key })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ recoveryKey: replacement })
    .expect(200);
  db.close();
});
test("scheduled collection reduces due, never inflates sales, replays once and reversal restores plan", () => {
  const db = database(":memory:");
  seed(db, "m");
  const before = snapshot(db, "m"),
    due = before.dues[0];
  const plan = addSchedule(db, "m", {
    direction: "in",
    kind: "collection",
    dueId: due.id,
    label: "Due payment",
    amount: due.amount,
    date: day(2),
    requestKey: randomUUID(),
  });
  const payload = entry({
    kind: "collection",
    amount: due.amount,
    dueId: due.id,
    scheduleId: plan.id,
    scheduleVersion: plan.version,
  });
  const saved = addEntry(db, "m", payload);
  addEntry(db, "m", payload);
  const after = snapshot(db, "m");
  assert.equal(after.cash, before.cash + due.amount);
  assert.equal(after.pending, before.pending - due.amount);
  assert.equal(after.salesToday, before.salesToday);
  reverseEntry(db, "m", saved.id, "Mistaken receipt", randomUUID());
  const restored = snapshot(db, "m");
  assert.equal(restored.pending, before.pending);
  assert.equal(restored.cash, before.cash);
  const pending = restored.forecast.schedule.find((r) => r.id === plan.id);
  assert.ok(pending.version > plan.version);
  assert.throws(
    () => addEntry(db, "m", { ...payload, requestKey: randomUUID() }),
    /PLAN_CHANGED/,
  );
  db.close();
});
test("other receipt affects cash but not sales and cannot be disguised as scheduled sale", () => {
  const db = database(":memory:");
  seed(db, "m");
  const before = snapshot(db, "m");
  const plan = addSchedule(db, "m", {
    direction: "in",
    kind: "receipt",
    label: "Owner capital",
    amount: 50000,
    date: day(1),
    requestKey: randomUUID(),
  });
  assert.throws(
    () =>
      addEntry(
        db,
        "m",
        entry({ scheduleId: plan.id, scheduleVersion: plan.version }),
      ),
    /SCHEDULE_MISMATCH/,
  );
  addEntry(
    db,
    "m",
    entry({
      kind: "receipt",
      scheduleId: plan.id,
      scheduleVersion: plan.version,
    }),
  );
  const after = snapshot(db, "m");
  assert.equal(after.cash, before.cash + 50000);
  assert.equal(after.salesToday, before.salesToday);
  db.close();
});
test("stale edit and stale payment confirmation reject without overwriting or recording money", () => {
  const db = database(":memory:");
  seed(db, "m");
  const item = snapshot(db, "m").forecast.schedule.find(
    (r) => r.direction === "out",
  );
  changeSchedule(db, "m", item.id, {
    version: item.version,
    label: "Changed supplier",
    amount: item.amount,
    date: day(10),
  });
  assert.throws(
    () =>
      changeSchedule(db, "m", item.id, {
        version: item.version,
        label: item.label,
        amount: 100,
        date: item.date,
      }),
    /PLAN_CHANGED/,
  );
  const n = snapshot(db, "m").entries.length;
  assert.throws(
    () =>
      addEntry(
        db,
        "m",
        entry({
          kind: "expense",
          name: item.label,
          amount: item.amount,
          scheduleId: item.id,
          scheduleVersion: item.version,
        }),
      ),
    /INSUFFICIENT_CASH|PLAN_CHANGED/,
  );
  const small = addSchedule(db, "m", {
    direction: "out",
    label: "Old supplier",
    amount: 10000,
    date: day(2),
    requestKey: randomUUID(),
  });
  changeSchedule(db, "m", small.id, {
    version: small.version,
    label: "New supplier",
    amount: 10000,
    date: day(3),
  });
  assert.throws(
    () =>
      addEntry(
        db,
        "m",
        entry({
          kind: "expense",
          amount: 10000,
          name: small.label,
          scheduleId: small.id,
          scheduleVersion: small.version,
        }),
      ),
    /PLAN_CHANGED/,
  );
  assert.equal(snapshot(db, "m").entries.length, n);
  assert.equal(
    schedules(db, "m").find((r) => r.id === item.id).label,
    "Changed supplier",
  );
  db.close();
});
test("same-name people remain separate while debts explicitly linked to one customer aggregate", () => {
  const db = database(":memory:");
  seed(db, "m");
  addEntry(
    db,
    "m",
    entry({ kind: "udhaar", name: "Same Name", amount: 10000 }),
  );
  addEntry(
    db,
    "m",
    entry({ kind: "udhaar", name: "Same Name", amount: 20000 }),
  );
  const due = snapshot(db, "m").dues.find(
    (d) => d.name === "Same Name" && d.amount === 10000,
  );
  addEntry(
    db,
    "m",
    entry({
      kind: "udhaar",
      name: "Same Name",
      customerId: due.customerId,
      amount: 5000,
    }),
  );
  const recipients = propose(db, "m").payload.filter(
    (r) => r.name === "Same Name",
  );
  assert.equal(recipients.length, 2);
  assert.deepEqual(
    recipients.map((r) => r.amount).sort((a, b) => a - b),
    [15000, 20000],
  );
  seed(db, "other");
  assert.throws(
    () =>
      addEntry(
        db,
        "other",
        entry({
          kind: "udhaar",
          name: "Same Name",
          customerId: due.customerId,
        }),
      ),
    /CUSTOMER_CHANGED/,
  );
  db.close();
});
test("assistant uses selected conservative scenario and exposes corresponding evidence", () => {
  const db = database(":memory:");
  seed(db, "m");
  const expected = renderAnswer(
    db,
    "m",
    { topic: "forecast" },
    "english",
    "expected",
  );
  const conservative = renderAnswer(
    db,
    "m",
    { topic: "forecast" },
    "english",
    "conservative",
  );
  assert.notEqual(
    expected.evidence.gap.balance,
    conservative.evidence.gap.balance,
  );
  assert.notEqual(expected.answer, conservative.answer);
  assert.equal(
    conservative.evidence.gap.balance,
    snapshot(db, "m", "conservative").forecast.firstGap.balance,
  );
  db.close();
});
test("complete archive includes all audit, reversal and linkage records but no auth secrets", () => {
  const db = database(":memory:");
  seed(db, "m");
  for (let i = 0; i < 105; i++) addEntry(db, "m", entry({ amount: 1 }));
  const row = addEntry(db, "m", entry({ amount: 10 }));
  reverseEntry(db, "m", row.id, "Wrong receipt", randomUUID());
  const archive = exportArchive(db, "m");
  assert.ok(archive.audit.length > 100);
  assert.equal(
    archive.audit.length,
    db.prepare("SELECT COUNT(*) n FROM audit WHERE merchant=?").get("m").n,
  );
  assert.equal(archive.tables.entry_voids.length, 1);
  assert.ok(archive.tables.customers.length);
  assert.equal(archive.tables.sessions, undefined);
  assert.equal(archive.tables.workspace_access, undefined);
  db.close();
});
test("configured HTTPS origin works while untrusted origin stays blocked", async () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://munim.example";
  const db = database(":memory:");
  try {
    const a = request.agent(createApp(db));
    await a
      .post("/api/auth/login")
      .set("Origin", "https://munim.example")
      .send(creds)
      .expect(200);
    await a
      .post("/api/actions/propose")
      .set("Origin", "https://munim.example")
      .send({})
      .expect(201);
    await a
      .post("/api/actions/propose")
      .set("Origin", "https://evil.example")
      .send({})
      .expect(403);
  } finally {
    if (old === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = old;
    db.close();
  }
});
test("EMI estimates use reducing balance, handle zero interest and reject invalid inputs", async () => {
  const db = database(":memory:");
  const a = request.agent(createApp(db));
  await a.post("/api/auth/login").send(creds);
  const v = (
    await a
      .post("/api/loan/estimate")
      .send({ amount: 5000000, months: 12, annualRate: 18 })
      .expect(200)
  ).body;
  assert.equal(v.emi, 458400);
  assert.equal(v.total, v.emi * 12);
  assert.equal(v.interest, v.total - 5000000);
  const zero = (
    await a
      .post("/api/loan/estimate")
      .send({ amount: 120000, months: 12, annualRate: 0 })
  ).body;
  assert.equal(zero.emi, 10000);
  assert.equal(zero.interest, 0);
  await a
    .post("/api/loan/estimate")
    .send({ amount: 100, months: 0, annualRate: -1 })
    .expect(400);
  db.close();
});
test("owner-only SQLite backup restores full ledger and history into a new verified file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "munim-restore-"));
  const source = join(dir, "original.sqlite"),
    target = join(dir, "backup.sqlite"),
    restored = join(dir, "restored.sqlite");
  try {
    const db = database(source);
    seed(db, "m");
    snapshot(db, "m");
    addEntry(db, "m", entry({ amount: 12345 }));
    const expected = exportArchive(db, "m");
    await backup(source, target);
    db.close();
    verify(target);
    await backup(target, restored);
    const recovered = database(restored);
    const actual = exportArchive(recovered, "m");
    assert.equal(actual.cash, expected.cash);
    assert.deepEqual(actual.tables, expected.tables);
    assert.equal(statSync(restored).mode & 0o777, 0o600);
    recovered.close();
    await assert.rejects(() => backup(target, restored), /target must be new/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("schedule create replay stays idempotent after a later edit", () => {
  const db = database(":memory:");
  seed(db, "m");
  snapshot(db, "m");
  const input = {
    direction: "out",
    label: "Rent",
    amount: 10000,
    date: day(2),
    requestKey: randomUUID(),
  };
  const row = addSchedule(db, "m", input);
  changeSchedule(db, "m", row.id, {
    version: row.version,
    label: "Rent revised",
    amount: 20000,
    date: day(3),
  });
  assert.equal(addSchedule(db, "m", input).id, row.id);
  assert.equal(addSchedule(db, "m", input).amount, 20000);
  assert.throws(
    () => addSchedule(db, "m", { ...input, amount: 12345 }),
    /IDEMPOTENCY_CONFLICT/,
  );
  db.close();
});

test("opposite replay cannot report a previously rejected action as approved", async () => {
  const db = database(":memory:");
  const a = request.agent(createApp(db));
  await a.post("/api/auth/login").send(creds);
  const proposal = (await a.post("/api/actions/propose").send({})).body;
  await a
    .post(`/api/actions/${proposal.id}/decision`)
    .send({ approve: false })
    .expect(200);
  const response = await a
    .post(`/api/actions/${proposal.id}/decision`)
    .send({ approve: true })
    .expect(409);
  assert.equal(response.body.error, "ACTION_ALREADY_DECIDED");
  db.close();
});

test("hosted friend test requires invitation code for fresh and recovery login without weakening session scope", async () => {
  const old = process.env.TEST_ACCESS_CODE;
  process.env.TEST_ACCESS_CODE = "synthetic-private-test-code";
  const db = database(":memory:");
  try {
    const app = createApp(db),
      a = request.agent(app);
    assert.equal((await a.get("/api/health")).body.testAccessRequired, true);
    await a.post("/api/auth/login").send(creds).expect(401);
    await a
      .post("/api/auth/login")
      .send({ ...creds, testAccessCode: "wrong" })
      .expect(401);
    await a
      .post("/api/auth/login")
      .send({ ...creds, testAccessCode: process.env.TEST_ACCESS_CODE })
      .expect(200);
    await a.get("/api/state").expect(200);
    const key = (await a.post("/api/auth/recovery-key").send({})).body.key;
    await request(app)
      .post("/api/auth/login")
      .send({ recoveryKey: key })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ recoveryKey: key, testAccessCode: process.env.TEST_ACCESS_CODE })
      .expect(200);
  } finally {
    if (old === undefined) delete process.env.TEST_ACCESS_CODE;
    else process.env.TEST_ACCESS_CODE = old;
    db.close();
  }
});
