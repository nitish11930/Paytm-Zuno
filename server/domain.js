import { day, cash, DomainError } from "./core.js";
export { day, cash, DomainError } from "./core.js";
import { planForecast, recommendations } from "./planning.js";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

export function database(path = "data/munim.sqlite") {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`CREATE TABLE IF NOT EXISTS merchants(id TEXT PRIMARY KEY, shop TEXT NOT NULL, owner TEXT NOT NULL, opening INTEGER NOT NULL, language TEXT NOT NULL DEFAULT 'hinglish', setup INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), kind TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), name TEXT NOT NULL, method TEXT NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL, due_id TEXT REFERENCES entries(id), source TEXT NOT NULL, request_key TEXT NOT NULL, UNIQUE(merchant,request_key));
 CREATE TABLE IF NOT EXISTS obligations(id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), label TEXT NOT NULL, amount INTEGER NOT NULL, date TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY, merchant TEXT NOT NULL REFERENCES merchants(id), payload TEXT NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),event TEXT NOT NULL,detail TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),expires INTEGER NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS entry_voids(entry_id TEXT PRIMARY KEY REFERENCES entries(id),merchant TEXT NOT NULL REFERENCES merchants(id),reason TEXT NOT NULL,request_key TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(merchant,request_key));
 CREATE TABLE IF NOT EXISTS schedule(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),direction TEXT NOT NULL,label TEXT NOT NULL,amount INTEGER NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL,request_key TEXT NOT NULL,UNIQUE(merchant,request_key));
 CREATE TABLE IF NOT EXISTS planning_initialized(merchant TEXT PRIMARY KEY REFERENCES merchants(id));
 CREATE TABLE IF NOT EXISTS entry_schedule(entry_id TEXT PRIMARY KEY REFERENCES entries(id),schedule_id TEXT NOT NULL REFERENCES schedule(id));
 CREATE TABLE IF NOT EXISTS demo_devices(hash TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),expires INTEGER NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),name TEXT NOT NULL,legacy INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS entry_customers(entry_id TEXT PRIMARY KEY REFERENCES entries(id),customer_id TEXT NOT NULL REFERENCES customers(id));
 CREATE TABLE IF NOT EXISTS workspace_access(hash TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id));
 CREATE TABLE IF NOT EXISTS schedule_requests(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(merchant,request_key));`);
  for (const [name, definition] of [
    ["version", "INTEGER NOT NULL DEFAULT 1"],
    ["kind", "TEXT NOT NULL DEFAULT 'sale'"],
    ["due_id", "TEXT"],
  ]) {
    if (
      !db
        .prepare("PRAGMA table_info(schedule)")
        .all()
        .some((c) => c.name === name)
    )
      db.exec(`ALTER TABLE schedule ADD COLUMN ${name} ${definition}`);
  }
  db.prepare(
    "UPDATE schedule SET kind='expense' WHERE direction='out' AND kind='sale'",
  ).run();
  return db;
}
const log = (db, m, event, detail) =>
  db
    .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
    .run(
      randomUUID(),
      m,
      event,
      JSON.stringify(detail),
      new Date().toISOString(),
    );
export function seed(db, m) {
  db.transaction(() => {
    db.prepare("INSERT INTO merchants VALUES(?,?,?,?,?,?)").run(
      m,
      "Ramesh Kirana",
      "Ramesh Kumar",
      1200000,
      "hinglish",
      0,
    );
    const insert = db.prepare(
      "INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (const [i, name, amount] of [
      [1, "Sharma ji", 200000],
      [2, "Priya", 300000],
      [3, "Amit", 250000],
      [4, "Neha", 250000],
    ])
      insert.run(
        `due-${m}-${i}`,
        m,
        "udhaar",
        amount,
        name,
        "cash",
        day(-i),
        "",
        null,
        "merchant",
        `seed-due-${i}`,
      );
    // Opening is the cash BEFORE seeded history; receipts minus expense net to zero.
    insert.run(
      randomUUID(),
      m,
      "sale",
      85000,
      "Counter sale",
      "upi",
      day(),
      "",
      null,
      "matched",
      "seed-sale-1",
    );
    insert.run(
      randomUUID(),
      m,
      "sale",
      35000,
      "Counter sale",
      "cash",
      day(),
      "",
      null,
      "merchant",
      "seed-sale-2",
    );
    insert.run(
      randomUUID(),
      m,
      "expense",
      120000,
      "Supplier",
      "cash",
      day(),
      "",
      null,
      "merchant",
      "seed-expense",
    );
    for (const [label, amount] of [
      ["Supplier payment", 2600000],
      ["Shop rent", 1200000],
    ])
      db.prepare("INSERT INTO obligations VALUES(?,?,?,?,?)").run(
        randomUUID(),
        m,
        label,
        amount,
        day(3),
      );
    log(db, m, "demo_created", { synthetic: true });
  })();
}
function linkCustomers(db, m) {
  // Historical names are ambiguous: keep each unmapped debt separate rather than guessing identity.
  const rows = db
    .prepare(
      "SELECT id,name FROM entries WHERE merchant=? AND kind='udhaar' AND id NOT IN (SELECT entry_id FROM entry_customers)",
    )
    .all(m);
  db.transaction(() => {
    for (const r of rows) {
      const id = randomUUID();
      db.prepare("INSERT INTO customers VALUES(?,?,?,1)").run(id, m, r.name);
      db.prepare("INSERT INTO entry_customers VALUES(?,?)").run(r.id, id);
    }
  })();
}
export function dues(db, m) {
  linkCustomers(db, m);
  return db
    .prepare(
      `SELECT e.*, (SELECT customer_id FROM entry_customers ec WHERE ec.entry_id=e.id) AS customerId, e.amount-COALESCE((SELECT SUM(c.amount) FROM entries c WHERE c.due_id=e.id AND c.merchant=e.merchant AND c.kind='collection' AND NOT EXISTS(SELECT 1 FROM entry_voids v WHERE v.entry_id=c.id)),0) AS outstanding FROM entries e WHERE e.merchant=? AND e.kind='udhaar' AND NOT EXISTS(SELECT 1 FROM entry_voids v WHERE v.entry_id=e.id) ORDER BY date`,
    )
    .all(m)
    .filter((e) => e.outstanding > 0);
}
export function forecast(db, m, scenario = "expected") {
  return planForecast(db, m, scenario);
}
export function snapshot(db, m, scenario = "expected", complete = false) {
  const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(m);
  const entries = db
    .prepare(
      "SELECT entries.*, (SELECT reason FROM entry_voids v WHERE v.entry_id=entries.id) AS reversed FROM entries WHERE merchant=? ORDER BY date DESC, rowid DESC",
    )
    .all(m);
  const pending = dues(db, m);
  return {
    merchant,
    customers: db
      .prepare("SELECT * FROM customers WHERE merchant=? ORDER BY name,id")
      .all(m),
    entries,
    dues: pending,
    cash: cash(db, m),
    pending: pending.reduce((s, d) => s + d.outstanding, 0),
    salesToday: entries
      .filter(
        (e) =>
          (e.kind === "sale" || e.kind === "udhaar") &&
          !e.reversed &&
          e.date === day(),
      )
      .reduce((s, e) => s + e.amount, 0),
    forecast: forecast(db, m, scenario),
    recommendations: recommendations(db, m, pending, scenario),
    audit: db
      .prepare(
        "SELECT * FROM audit WHERE merchant=? ORDER BY rowid DESC" +
          (complete ? "" : " LIMIT 100"),
      )
      .all(m),
    readiness: {
      days: new Set(entries.filter((e) => !e.reversed).map((e) => e.date)).size,
      matched: entries.filter((e) => !e.reversed && e.source === "matched")
        .length,
      total: entries.filter((e) => !e.reversed).length,
      expenses: entries.filter((e) => !e.reversed && e.kind === "expense")
        .length,
    },
  };
}
export function addEntry(db, m, input) {
  return db.transaction(() => {
    const duplicate = db
      .prepare("SELECT * FROM entries WHERE merchant=? AND request_key=?")
      .get(m, input.requestKey);
    if (duplicate) {
      const linked = db
        .prepare("SELECT schedule_id FROM entry_schedule WHERE entry_id=?")
        .get(duplicate.id);
      const linkedCustomer = db
        .prepare("SELECT customer_id FROM entry_customers WHERE entry_id=?")
        .get(duplicate.id);
      if (input.customerId && linkedCustomer?.customer_id !== input.customerId)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      if ((linked?.schedule_id || null) !== (input.scheduleId || null))
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      if (
        duplicate.kind !== input.kind ||
        duplicate.amount !== input.amount ||
        duplicate.method !== input.method ||
        duplicate.note !== (input.note || "") ||
        (duplicate.due_id || null) !==
          (input.kind === "collection" ? input.dueId : null) ||
        (input.kind !== "collection" && duplicate.name !== input.name)
      )
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      return duplicate;
    }
    if (input.kind === "collection") {
      const d = dues(db, m).find((d) => d.id === input.dueId);
      if (!d) throw new DomainError("DUE_NOT_FOUND");
      if (input.amount > d.outstanding)
        throw new DomainError("COLLECTION_EXCEEDS_DUE");
      input.name = d.name;
    }
    if (input.kind === "expense" && input.amount > cash(db, m))
      throw new DomainError("INSUFFICIENT_CASH");
    let customerId;
    if (input.kind === "udhaar") {
      if (input.customerId) {
        const customer = db
          .prepare("SELECT * FROM customers WHERE id=? AND merchant=?")
          .get(input.customerId, m);
        if (!customer || customer.name !== input.name)
          throw new DomainError("CUSTOMER_CHANGED", 409);
        customerId = customer.id;
      } else {
        customerId = randomUUID();
        db.prepare("INSERT INTO customers VALUES(?,?,?,0)").run(
          customerId,
          m,
          input.name,
        );
      }
    }
    if (input.kind === "collection")
      customerId = dues(db, m).find((d) => d.id === input.dueId)?.customerId;
    let scheduled;
    if (input.scheduleId) {
      scheduled = db
        .prepare(
          "SELECT * FROM schedule WHERE id=? AND merchant=? AND status='pending'",
        )
        .get(input.scheduleId, m);
      if (!scheduled) throw new DomainError("PLAN_ITEM_NOT_FOUND", 404);
      if (input.scheduleVersion !== scheduled.version)
        throw new DomainError("PLAN_CHANGED", 409);
      if (
        input.amount !== scheduled.amount ||
        (scheduled.direction === "out"
          ? input.kind !== "expense"
          : input.kind !== scheduled.kind) ||
        (scheduled.kind === "collection" && input.dueId !== scheduled.due_id)
      )
        throw new DomainError("SCHEDULE_MISMATCH", 409);
    }
    const entry = {
      id: randomUUID(),
      merchant: m,
      kind: input.kind,
      amount: input.amount,
      name: input.name,
      method: input.method,
      date: day(),
      note: input.note || "",
      due_id: input.kind === "collection" ? input.dueId : null,
      source: "merchant",
      request_key: input.requestKey,
    };
    db.prepare(
      "INSERT INTO entries VALUES(@id,@merchant,@kind,@amount,@name,@method,@date,@note,@due_id,@source,@request_key)",
    ).run(entry);
    if (customerId)
      db.prepare("INSERT INTO entry_customers VALUES(?,?)").run(
        entry.id,
        customerId,
      );
    if (scheduled) {
      db.prepare("INSERT INTO entry_schedule VALUES(?,?)").run(
        entry.id,
        scheduled.id,
      );
      db.prepare(
        "UPDATE schedule SET version=version+1,status='completed' WHERE id=? AND merchant=?",
      ).run(scheduled.id, m);
      log(db, m, "plan_item_completed", {
        id: scheduled.id,
        entryId: entry.id,
      });
    }
    log(db, m, "entry_recorded", {
      id: entry.id,
      kind: entry.kind,
      amount: entry.amount,
    });
    return entry;
  })();
}
function reminderRows(db, m) {
  const groups = new Map();
  for (const d of dues(db, m)) {
    const key = d.customerId;
    const g = groups.get(key) || {
      id: "",
      customerId: key,
      name: d.name,
      amount: 0,
    };
    g.id += (g.id ? "," : "") + d.id;
    g.amount += d.outstanding;
    groups.set(key, g);
  }
  return [...groups.values()];
}
export function propose(db, m) {
  const rows = reminderRows(db, m);
  if (!rows.length) throw new DomainError("NO_PENDING_DUES");
  const p = {
    id: randomUUID(),
    merchant: m,
    payload: JSON.stringify(rows),
    expires: Date.now() + 300000,
    status: "pending",
  };
  db.prepare(
    "INSERT INTO proposals VALUES(@id,@merchant,@payload,@expires,@status)",
  ).run(p);
  return { ...p, payload: rows };
}
export function execute(db, m, id, approve) {
  return db.transaction(() => {
    const p = db
      .prepare("SELECT * FROM proposals WHERE id=? AND merchant=?")
      .get(id, m);
    if (!p) throw new DomainError("ACTION_NOT_FOUND", 404);
    if (p.status !== "pending") {
      if (p.status !== (approve ? "simulated" : "rejected"))
        throw new DomainError("ACTION_ALREADY_DECIDED", 409);
      return { ...p, payload: JSON.parse(p.payload), replayed: true };
    }
    if (p.expires < Date.now()) throw new DomainError("APPROVAL_EXPIRED", 409);
    if (approve) {
      const current = reminderRows(db, m);
      if (JSON.stringify(current) !== p.payload)
        throw new DomainError("PROPOSAL_CHANGED", 409);
    }
    const status = approve ? "simulated" : "rejected";
    db.prepare("UPDATE proposals SET status=? WHERE id=? AND merchant=?").run(
      status,
      id,
      m,
    );
    log(db, m, approve ? "reminder_simulated" : "action_rejected", {
      proposal: id,
      recipients: JSON.parse(p.payload),
      moneyReceived: 0,
    });
    return { ...p, status, payload: JSON.parse(p.payload) };
  })();
}
export function updateShop(db, m, values) {
  db.prepare(
    "UPDATE merchants SET shop=?, owner=?,language=?,setup=1 WHERE id=?",
  ).run(values.shop, values.owner, values.language, m);
  log(db, m, "shop_updated", {});
}
export function resetDemo(db, m) {
  db.transaction(() => {
    db.prepare(
      "DELETE FROM entry_customers WHERE entry_id IN (SELECT id FROM entries WHERE merchant=?)",
    ).run(m);
    db.prepare("DELETE FROM customers WHERE merchant=?").run(m);
    db.prepare("DELETE FROM workspace_access WHERE merchant=?").run(m);
    db.prepare("DELETE FROM schedule_requests WHERE merchant=?").run(m);
    db.prepare("DELETE FROM audit WHERE merchant=?").run(m);
    db.prepare("DELETE FROM proposals WHERE merchant=?").run(m);
    db.prepare(
      "DELETE FROM entry_schedule WHERE entry_id IN(SELECT id FROM entries WHERE merchant=?)",
    ).run(m);
    db.prepare("DELETE FROM entry_voids WHERE merchant=?").run(m);
    db.prepare(
      "DELETE FROM entries WHERE merchant=? AND due_id IS NOT NULL",
    ).run(m);
    db.prepare("DELETE FROM entries WHERE merchant=?").run(m);
    db.prepare("DELETE FROM obligations WHERE merchant=?").run(m);
    db.prepare("DELETE FROM sessions WHERE merchant=?").run(m);
    db.prepare("DELETE FROM demo_devices WHERE merchant=?").run(m);
    db.prepare("DELETE FROM schedule WHERE merchant=?").run(m);
    db.prepare("DELETE FROM planning_initialized WHERE merchant=?").run(m);
    db.prepare("DELETE FROM merchants WHERE id=?").run(m);
  })();
}

export function reverseEntry(db, m, id, reason, requestKey) {
  return db.transaction(() => {
    const prior = db
      .prepare("SELECT * FROM entry_voids WHERE merchant=? AND request_key=?")
      .get(m, requestKey);
    if (prior) {
      if (prior.entry_id !== id || prior.reason !== reason)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      return { ok: true, replayed: true };
    }
    const e = db
      .prepare("SELECT * FROM entries WHERE merchant=? AND id=?")
      .get(m, id);
    if (!e) throw new DomainError("ENTRY_NOT_FOUND", 404);
    if (db.prepare("SELECT 1 FROM entry_voids WHERE entry_id=?").get(id))
      throw new DomainError("ALREADY_REVERSED", 409);
    if (
      e.kind === "udhaar" &&
      db
        .prepare(
          "SELECT 1 FROM entries c WHERE c.due_id=? AND NOT EXISTS(SELECT 1 FROM entry_voids v WHERE v.entry_id=c.id)",
        )
        .get(id)
    )
      throw new DomainError("REVERSE_COLLECTIONS_FIRST", 409);
    db.prepare("INSERT INTO entry_voids VALUES(?,?,?,?,?)").run(
      id,
      m,
      reason,
      requestKey,
      new Date().toISOString(),
    );
    const linked = db
      .prepare("SELECT schedule_id FROM entry_schedule WHERE entry_id=?")
      .get(id);
    if (linked)
      db.prepare(
        "UPDATE schedule SET version=version+1,status='pending' WHERE id=? AND merchant=?",
      ).run(linked.schedule_id, m);
    log(db, m, "entry_reversed", {
      id,
      kind: e.kind,
      amount: e.amount,
      reason,
    });
    return { ok: true };
  })();
}

export function exportArchive(db, m) {
  const state = snapshot(db, m, "expected", true);
  const tables = {};
  for (const table of [
    "merchants",
    "entries",
    "obligations",
    "proposals",
    "audit",
    "entry_voids",
    "schedule",
    "planning_initialized",
    "customers",
    "schedule_requests",
  ]) {
    tables[table] = db
      .prepare(
        `SELECT * FROM ${table} WHERE ${table === "merchants" ? "id" : "merchant"}=?`,
      )
      .all(m);
  }
  for (const table of ["entry_schedule", "entry_customers"])
    tables[table] = db
      .prepare(
        `SELECT * FROM ${table} WHERE entry_id IN (SELECT id FROM entries WHERE merchant=?)`,
      )
      .all(m);
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    mode: "synthetic-demo",
    ...state,
    tables,
  };
}
