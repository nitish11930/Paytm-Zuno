import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server/app.js";
import { database } from "../server/domain.js";
import { randomUUID } from "node:crypto";
test("API authentication, validation, isolation, CSRF and voice missing-key behavior", async () => {
  const db = database(":memory:");
  const app = createApp(db);
  const a = request.agent(app),
    b = request.agent(app);
  await a.get("/api/state").expect(401);
  await a.post("/api/auth/login").send({ phone: "x", pin: "1" }).expect(401);
  const login = await a
    .post("/api/auth/login")
    .send({ phone: "9876543210", pin: "123456" })
    .expect(200);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
  await b
    .post("/api/auth/login")
    .send({ phone: "9876543210", pin: "123456" })
    .expect(200);
  const before = (await a.get("/api/state")).body;
  const other = (await b.get("/api/state")).body;
  assert.notEqual(before.merchant.id, other.merchant.id);
  await a
    .post("/api/entries")
    .set("Origin", "https://evil.example")
    .send({})
    .expect(403);
  await a.post("/api/entries").send({ kind: "sale", amount: -100 }).expect(400);
  await a
    .post("/api/entries")
    .send({
      kind: "sale",
      amount: 10000,
      name: "<script>alert(1)</script>",
      method: "cash",
      requestKey: randomUUID(),
    })
    .expect(201);
  assert.equal((await b.get("/api/state")).body.cash, other.cash);
  const saved = process.env.SARVAM_API_KEY;
  delete process.env.SARVAM_API_KEY;
  const voice = await a
    .post("/api/voice/speak")
    .send({ text: "Hello", language: "english" })
    .expect(503);
  assert.equal(voice.body.error, "VOICE_NOT_CONFIGURED");
  if (saved) process.env.SARVAM_API_KEY = saved;
  await a.post("/api/auth/logout").send({}).expect(200);
  await a.get("/api/state").expect(401);
  db.close();
});
