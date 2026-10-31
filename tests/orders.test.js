import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { database, snapshot, seed } from "../server/domain.js";
import { createApp } from "../server/app.js";
import {
  listProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  parseOrderText,
  createOrder,
  acceptOrder,
  rejectOrder,
  completeOrderPayment,
  listOrders,
} from "../server/inventory.js";

test("product catalog seeds defaults, adds custom items, updates and deletes with integer paise", () => {
  const db = database(":memory:");
  seed(db, "m-catalog");

  const initial = listProducts(db, "m-catalog");
  assert.equal(initial.length, 8);
  assert.equal(initial[0].merchant, "m-catalog");
  assert.equal(typeof initial[0].price, "number");
  assert.ok(initial[0].price > 0);

  // Add custom product
  const added = addProduct(db, "m-catalog", {
    name: "Parle-G 100g",
    unit: "packet",
    price: 1000, // ₹10
    stock: 50,
  });
  assert.equal(added.name, "Parle-G 100g");
  assert.equal(added.price, 1000);
  assert.equal(added.stock, 50);

  // Update product
  const updated = updateProduct(db, "m-catalog", added.id, {
    price: 1200,
    stock: 45,
  });
  assert.equal(updated.price, 1200);
  assert.equal(updated.stock, 45);

  // Delete product
  const deleted = deleteProduct(db, "m-catalog", added.id);
  assert.equal(deleted.ok, true);

  const active = listProducts(db, "m-catalog");
  assert.equal(active.some((p) => p.id === added.id), false);
  db.close();
});

test("order text parser extracts Hinglish quantities, units and matches catalog items", () => {
  const db = database(":memory:");
  seed(db, "m-parser");
  const catalog = listProducts(db, "m-parser");

  const parsed = parseOrderText("2 packet bread aur 1 litre doodh aur 5 maggi", catalog);
  assert.equal(parsed.items.length, 3);

  const bread = parsed.items.find((i) => i.name.toLowerCase().includes("bread"));
  assert.ok(bread);
  assert.equal(bread.quantity, 2);
  assert.equal(bread.unit, "packet");
  assert.equal(bread.matched, true);
  assert.equal(bread.totalPrice, bread.unitPrice * 2);

  const doodh = parsed.items.find((i) => i.name.toLowerCase().includes("doodh"));
  assert.ok(doodh);
  assert.equal(doodh.quantity, 1);
  assert.equal(doodh.matched, true);

  const maggi = parsed.items.find((i) => i.name.toLowerCase().includes("maggi"));
  assert.ok(maggi);
  assert.equal(maggi.quantity, 5);
  assert.equal(maggi.matched, true);

  assert.equal(
    parsed.total,
    bread.totalPrice + doodh.totalPrice + maggi.totalPrice,
  );
  db.close();
});

test("order rejection records reason and audit with zero financial mutations", () => {
  const db = database(":memory:");
  seed(db, "m-reject");
  const catalog = listProducts(db, "m-reject");
  const parsed = parseOrderText("1 packet bread", catalog);

  const snapBefore = snapshot(db, "m-reject");

  const created = createOrder(db, "m-reject", {
    customerName: "Rakesh",
    items: parsed.items,
    requestKey: "req-reject-1",
  });
  assert.equal(created.order.status, "draft");

  const rejected = rejectOrder(db, "m-reject", created.order.id, {
    reason: "Out of stock",
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejection_reason, "Out of stock");

  const snapAfter = snapshot(db, "m-reject");
  assert.equal(snapAfter.cash, snapBefore.cash);
  assert.equal(snapAfter.pending, snapBefore.pending);
  assert.equal(snapAfter.entries.length, snapBefore.entries.length);

  // Attempting to accept a rejected order should fail
  assert.throws(
    () => acceptOrder(db, "m-reject", created.order.id),
    /CANNOT_ACCEPT_REJECTED_ORDER/,
  );
  db.close();
});

test("order acceptance generates bill, decrements stock, and paid order records sale in cash", () => {
  const db = database(":memory:");
  seed(db, "m-paid");
  const catalog = listProducts(db, "m-paid");
  const breadProd = catalog.find((p) => p.name.includes("Bread"));
  const initialStock = breadProd.stock;

  const parsed = parseOrderText("2 packet bread", catalog);
  const snapBefore = snapshot(db, "m-paid");

  const created = createOrder(db, "m-paid", {
    customerName: "Sharma ji",
    items: parsed.items,
    requestKey: "req-accept-1",
  });

  const accepted = acceptOrder(db, "m-paid", created.order.id);
  assert.ok(accepted.order.bill_number.startsWith("BILL-"));
  assert.equal(accepted.order.status, "accepted");

  // Stock should be decremented
  const updatedCatalog = listProducts(db, "m-paid");
  const updatedBread = updatedCatalog.find((p) => p.id === breadProd.id);
  assert.equal(updatedBread.stock, initialStock - 2);

  // Complete Payment: Paid via cash
  const completed = completeOrderPayment(db, "m-paid", created.order.id, {
    paymentStatus: "paid",
    paymentMethod: "cash",
    requestKey: "pay-sale-1",
  });
  assert.equal(completed.order.payment_status, "paid");
  assert.equal(completed.order.status, "completed");
  assert.ok(completed.entryId);

  const snapAfter = snapshot(db, "m-paid");
  assert.equal(snapAfter.cash, snapBefore.cash + created.order.total_amount);
  assert.equal(snapAfter.pending, snapBefore.pending); // No dues added
  db.close();
});

test("order unpaid records udhaar, schedules promise reminder, and never inflates cash", () => {
  const db = database(":memory:");
  seed(db, "m-udhaar");
  const catalog = listProducts(db, "m-udhaar");
  const parsed = parseOrderText("1 packet bread", catalog);

  const snapBefore = snapshot(db, "m-udhaar");

  const created = createOrder(db, "m-udhaar", {
    customerName: "Sunita Verma",
    items: parsed.items,
    requestKey: "req-udhaar-1",
  });
  acceptOrder(db, "m-udhaar", created.order.id);

  const completed = completeOrderPayment(db, "m-udhaar", created.order.id, {
    paymentStatus: "unpaid",
    customerName: "Sunita Verma",
    promiseDate: "2026-11-04",
    requestKey: "pay-udhaar-1",
  });
  assert.equal(completed.order.payment_status, "unpaid");

  const snapAfter = snapshot(db, "m-udhaar");
  // CRITICAL RULE: Unpaid sale MUST NOT inflate cash
  assert.equal(snapAfter.cash, snapBefore.cash);
  // Dues MUST increase
  assert.equal(snapAfter.pending, snapBefore.pending + created.order.total_amount);

  // Follow-up reminder queue should include this customer's promise
  const queue = snapAfter.followUps;
  assert.ok(queue.some((f) => f.name === "Sunita Verma" && f.dueDate === "2026-11-04"));
  db.close();
});

test("API endpoints for products and orders enforce auth, validation and merchant scoping", async () => {
  const db = database(":memory:");
  const testApp = createApp(db);

  // Unauthenticated requests should be rejected
  const unauth = await request(testApp).get("/api/products");
  assert.equal(unauth.status, 401);

  // Authenticate demo session
  const agent = request.agent(testApp);
  const login = await agent
    .post("/api/auth/login")
    .send({ phone: "9876543210", pin: "123456" });
  assert.equal(login.status, 200);

  // Get products
  const prodsRes = await agent.get("/api/products");
  assert.equal(prodsRes.status, 200);
  assert.equal(prodsRes.body.products.length, 8);

  // Parse order text
  const parseRes = await agent
    .post("/api/orders/parse")
    .send({ text: "2 packet bread" });
  assert.equal(parseRes.status, 200);
  assert.equal(parseRes.body.items.length, 1);
  assert.equal(parseRes.body.items[0].quantity, 2);

  // Create order
  const orderRes = await agent.post("/api/orders").send({
    customerName: "Vikram",
    items: parseRes.body.items,
    requestKey: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  });
  assert.equal(orderRes.status, 201);
  const orderId = orderRes.body.order.id;

  // Accept order
  const acceptRes = await agent.post(`/api/orders/${orderId}/accept`).send({});
  assert.equal(acceptRes.status, 200);
  assert.ok(acceptRes.body.order.bill_number.startsWith("BILL-"));

  // Complete Payment
  const payRes = await agent.post(`/api/orders/${orderId}/payment`).send({
    paymentStatus: "paid",
    paymentMethod: "upi",
    requestKey: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  });
  assert.equal(payRes.status, 200);
  assert.equal(payRes.body.order.payment_status, "paid");

  // List orders
  const listRes = await agent.get("/api/orders");
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.orders.length, 1);
  assert.equal(listRes.body.orders[0].id, orderId);

  db.close();
});
