import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomBytes, randomUUID } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ path: "privacy/supabase.env", quiet: true });

import {
  createPostgresPool,
  createPostgresRepository,
} from "../server/postgres.js";
import { createApp } from "../server/app.js";

test("Supabase PostgreSQL persistence and concurrency integration", async (t) => {
  if (!process.env.SUPABASE_DB_URL) {
    t.skip("SUPABASE_DB_URL not configured, skipping live Supabase test");
    return;
  }

  const pool = createPostgresPool({ max: 5 });
  const repo = createPostgresRepository(pool);
  const testMerchant = `test-pg-${randomBytes(6).toString("hex")}`;

  try {
    // 1. Connection and schema check
    const checkRes = await pool.query("SELECT current_schema(), version()");
    assert.ok(checkRes.rows.length > 0, "PostgreSQL connected");

    // 2. Seed an isolated test merchant
    await repo.seed(testMerchant);
    const snap1 = await repo.snapshot(testMerchant);
    assert.equal(snap1.merchant.id, testMerchant);
    assert.equal(snap1.merchant.shop, "Ramesh Kirana");
    assert.equal(snap1.cash, 1200000); // 1200000 opening + 85000 + 35000 - 120000
    assert.equal(snap1.dues.length, 4);
    await repo.updateShop(testMerchant, {
      shop: "Setup test",
      owner: "Test owner",
      language: "english",
    });
    assert.equal((await repo.snapshot(testMerchant)).merchant.setup, 1);

    // 3. Add an entry with promised repayment date
    const udhaarEntry = await repo.addEntry(testMerchant, {
      kind: "udhaar",
      amount: 150000,
      name: "Suresh Gupta",
      method: "cash",
      dueDate: "2026-11-15",
      requestKey: randomUUID(),
    });
    assert.ok(udhaarEntry.id);
    assert.equal(udhaarEntry.amount, 150000);

    // Dues should now have 5 items
    const dues = await repo.dues(testMerchant);
    assert.equal(dues.length, 5);
    const sureshDue = dues.find((d) => d.name === "Suresh Gupta");
    assert.ok(sureshDue);
    assert.equal(sureshDue.outstanding, 150000);

    // 4. Over-collection concurrency protection (FOR UPDATE row lock)
    // Attempt two simultaneous collections that individually fit, but together exceed 150000
    const colReq1 = repo.addEntry(testMerchant, {
      kind: "collection",
      amount: 100000,
      name: "Suresh Gupta",
      method: "cash",
      dueId: sureshDue.id,
      requestKey: randomUUID(),
    });

    const colReq2 = repo.addEntry(testMerchant, {
      kind: "collection",
      amount: 80000,
      name: "Suresh Gupta",
      method: "cash",
      dueId: sureshDue.id,
      requestKey: randomUUID(),
    });

    const results = await Promise.allSettled([colReq1, colReq2]);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(
      succeeded.length,
      1,
      "Exactly one concurrent collection must succeed",
    );
    assert.equal(
      rejected.length,
      1,
      "The exceeding concurrent collection must be rejected",
    );
    assert.match(rejected[0].reason.message, /COLLECTION_EXCEEDS_DUE/);

    // Verify remaining due in Supabase
    const updatedDues = await repo.dues(testMerchant);
    const updatedSuresh = updatedDues.find((d) => d.id === sureshDue.id);
    assert.equal(updatedSuresh.outstanding, 50000); // 150000 - 100000

    // 5. Reverse entry: cannot reverse an udhaar entry with active collections
    await assert.rejects(
      () =>
        repo.reverseEntry(
          testMerchant,
          udhaarEntry.id,
          "Entered in error",
          randomUUID(),
        ),
      (err) => err.message === "CANNOT_REVERSE_COLLECTED_DUE",
    );

    // Add an expense entry and reverse it with idempotency
    const expEntry = await repo.addEntry(testMerchant, {
      kind: "expense",
      amount: 5000,
      name: "Tea & snacks",
      method: "cash",
      requestKey: randomUUID(),
    });
    const revKey = randomUUID();
    const rev1 = await repo.reverseEntry(
      testMerchant,
      expEntry.id,
      "Entered twice",
      revKey,
    );
    assert.equal(rev1.ok, true);
    // Replay with same key must succeed idempotently
    const revReplay = await repo.reverseEntry(
      testMerchant,
      expEntry.id,
      "Entered twice",
      revKey,
    );
    assert.equal(revReplay.ok, true);
  } finally {
    // 6. Clean up test merchant
    await repo.resetDemo(testMerchant);
    await pool.end();
  }
});

test("Express API with Supabase PostgreSQL repository", async (t) => {
  if (!process.env.SUPABASE_DB_URL) {
    t.skip("SUPABASE_DB_URL not configured, skipping live Supabase test");
    return;
  }

  const pool = createPostgresPool({ max: 5 });
  const repo = createPostgresRepository(pool);
  const app = createApp(repo);
  const agent = request.agent(app);

  let merchantId = null;

  try {
    // 1. Health check exposes provider without secrets
    const healthRes = await agent.get("/api/health").expect(200);
    assert.equal(healthRes.body.ok, true);
    assert.equal(healthRes.body.databaseProvider, "postgres");
    assert.equal(
      healthRes.body.supabaseUrl,
      undefined,
      "Never leak credentials",
    );

    // 2. Login creates authenticated session in PostgreSQL
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ phone: "9876543210", pin: "123456" })
      .expect(200);
    assert.equal(loginRes.body.ok, true);

    // 3. State retrieves full snapshot from Supabase
    const stateRes = await agent.get("/api/state").expect(200);
    assert.ok(stateRes.body.merchant);
    merchantId = stateRes.body.merchant.id;
    assert.ok(merchantId);
    assert.equal(stateRes.body.dues.length, 4);

    // 4. Products & Orders flow
    const prodRes = await agent
      .post("/api/products")
      .send({ name: "Basmati Rice 1kg", unit: "kg", price: 12000, stock: 25 })
      .expect(201);
    assert.equal(prodRes.body.product.name, "Basmati Rice 1kg");
    assert.equal(prodRes.body.product.stock, 25);
    const prodId = prodRes.body.product.id;

    // Create an order
    const orderRes = await agent
      .post("/api/orders")
      .send({
        customerName: "Vikram Singh",
        items: [
          {
            productId: prodId,
            name: "Basmati Rice 1kg",
            quantity: 2,
            unitPrice: 12000,
          },
        ],
        requestKey: randomUUID(),
      })
      .expect(201);
    assert.equal(orderRes.body.order.status, "draft");
    assert.equal(orderRes.body.order.total_amount, 24000);
    const orderId = orderRes.body.order.id;

    // Accept order (generates bill and decrements stock)
    const acceptRes = await agent
      .post(`/api/orders/${orderId}/accept`)
      .send({})
      .expect(200);
    assert.equal(acceptRes.body.order.status, "accepted");
    assert.match(acceptRes.body.order.bill_number, /^BILL-/);

    // Verify stock was decremented in Supabase
    const prodsList = await agent.get("/api/products").expect(200);
    const riceProd = prodsList.body.products.find((p) => p.id === prodId);
    assert.equal(riceProd.stock, 23); // 25 - 2

    // Complete order payment as cash sale
    const payRes = await agent
      .post(`/api/orders/${orderId}/payment`)
      .send({
        paymentStatus: "paid",
        paymentMethod: "cash",
        requestKey: randomUUID(),
      })
      .expect(200);
    assert.equal(payRes.body.order.status, "completed");
    assert.equal(payRes.body.order.payment_status, "paid");

    // Cash sale must be reflected in ledger
    const finalState = await agent.get("/api/state").expect(200);
    assert.equal(finalState.body.cash, 1200000 + 24000); // 1224000
  } finally {
    if (merchantId) {
      await repo.resetDemo(merchantId);
    }
    await pool.end();
  }
});

test("PostgreSQL voice flow records fields, accepts date replies, saves once and starts a second entry", async (t) => {
  if (!process.env.SUPABASE_DB_URL) return t.skip("Supabase not configured");
  const oldKey = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const pool = createPostgresPool({ max: 3 }),
    repo = createPostgresRepository(pool);
  const merchant = `voice-parity-${randomBytes(6).toString("hex")}`;
  const turn = (text, prev, requestKey = randomUUID()) =>
    repo.voiceLedgerTurn(merchant, {
      text,
      language: "hinglish",
      requestKey,
      ...(prev ? { draftId: prev.draftId, version: prev.version } : {}),
    });
  try {
    await repo.seed(merchant);
    let r = await turn("Hey Zuno Nikhil ko 200 udhaar likho");
    assert.equal(r.stage, "promise");
    assert.equal(r.draft.amount, 20000);
    assert.equal(r.draft.name, "Nikhil");
    r = await turn("teen din baad", r);
    assert.equal(r.stage, "confirm");
    assert.match(r.draft.dueDate, /^\d{4}-\d{2}-\d{2}$/);
    r = await turn("haan", r);
    assert.equal(r.stage, "confirm");
    const previous = r,
      key = randomUUID();
    r = await turn("haan save karo", previous, key);
    assert.equal(r.stage, "saved");
    assert.ok(r.draft.entryId);
    assert.deepEqual(await turn("haan save karo", previous, key), r);
    assert.deepEqual(await repo.currentVoiceLedger(merchant), r);
    const state = await repo.snapshot(merchant);
    assert.ok(state.entries.some((e) => e.id === r.draft.entryId));
    assert.ok(state.dues.some((d) => d.id === r.draft.entryId));
    let second = await turn("sale record karo");
    assert.equal(second.stage, "amount");
    second = await turn("50", second);
    assert.equal(second.stage, "name");
    second = await turn("Counter", second);
    assert.equal(second.stage, "method");
    second = await turn("cash", second);
    assert.equal(second.stage, "confirm");
    second = await turn("cancel", second);
    assert.equal(second.stage, "cancelled");
    const broken = await turn("hello");
    assert.equal(broken.stage, "kind");
    const recovered = await turn("Manoj ko 100 udhaar likho", broken);
    assert.equal(recovered.stage, "promise");
    assert.equal(recovered.draft.amount, 10000);
  } finally {
    await repo.resetDemo(merchant);
    await pool.end();
    if (oldKey !== undefined) process.env.SARVAM_API_KEY = oldKey;
  }
});
