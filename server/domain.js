import { day, cash, DomainError } from "./core.js";
export { day, cash, DomainError } from "./core.js";
import { planForecast, recommendations } from "./planning.js";
import { initInventorySchema, listProducts, listOrders } from "./inventory.js";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { mkdirSync, chmodSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function database(
  path = existsSync("data/zuno.sqlite") || !existsSync("data/munim.sqlite")
    ? "data/zuno.sqlite"
    : "data/munim.sqlite",
) {
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
  db.exec(
    `CREATE TABLE IF NOT EXISTS due_terms(entry_id TEXT PRIMARY KEY REFERENCES entries(id),merchant TEXT NOT NULL REFERENCES merchants(id),due_date TEXT NOT NULL);`,
  );
  db.exec(`CREATE TABLE IF NOT EXISTS voice_drafts(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),version INTEGER NOT NULL,payload TEXT NOT NULL,stage TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS voice_turns(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(merchant,request_key));`);
  db.exec(
    `CREATE TABLE IF NOT EXISTS voice_audio_requests(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,input_hash TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(merchant,request_key));`,
  );
  db.exec(`CREATE TABLE IF NOT EXISTS payment_import_batches(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),payload TEXT NOT NULL,expires INTEGER NOT NULL,result TEXT);
 CREATE TABLE IF NOT EXISTS imported_payments(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),batch_id TEXT NOT NULL REFERENCES payment_import_batches(id),reference TEXT NOT NULL,record_type TEXT NOT NULL,date TEXT NOT NULL,amount INTEGER NOT NULL,name TEXT NOT NULL,source TEXT NOT NULL,entry_id TEXT REFERENCES entries(id),decision TEXT,UNIQUE(merchant,record_type,reference));
 CREATE UNIQUE INDEX IF NOT EXISTS payment_entry_link ON imported_payments(entry_id) WHERE entry_id IS NOT NULL;`);
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
  initInventorySchema(db);
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
    dayBooks: dailyBooks(entries),
    paymentInbox: db
      .prepare(
        "SELECT p.*, (SELECT reason FROM entry_voids v WHERE v.entry_id=p.entry_id) AS reversed FROM imported_payments p WHERE merchant=? ORDER BY date DESC,rowid DESC",
      )
      .all(m),
    followUps: followUpQueue(db, m),
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
    products: listProducts(db, m),
    orders: listOrders(db, m, 20),
  };
}
export function addEntry(db, m, input, options = {}) {
  const recordedDate = options.date || day(),
    recordedSource = options.source || "merchant";
  if (!validDueDate(recordedDate) || recordedDate > day())
    throw new DomainError("INVALID_DUE_DATE");
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
      const term = db
        .prepare(
          "SELECT due_date FROM due_terms WHERE entry_id=? AND merchant=?",
        )
        .get(duplicate.id, m);
      if ((term?.due_date || null) !== (input.dueDate || null))
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      if (input.customerId && linkedCustomer?.customer_id !== input.customerId)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      if ((linked?.schedule_id || null) !== (input.scheduleId || null))
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      if (
        (options.date && duplicate.date !== recordedDate) ||
        duplicate.source !== recordedSource ||
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
    if (
      input.dueDate &&
      (input.kind !== "udhaar" || !validDueDate(input.dueDate))
    )
      throw new DomainError("INVALID_DUE_DATE");
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
      date: recordedDate,
      note: input.note || "",
      due_id: input.kind === "collection" ? input.dueId : null,
      source: recordedSource,
      request_key: input.requestKey,
    };
    db.prepare(
      "INSERT INTO entries VALUES(@id,@merchant,@kind,@amount,@name,@method,@date,@note,@due_id,@source,@request_key)",
    ).run(entry);
    if (input.dueDate)
      db.prepare("INSERT INTO due_terms VALUES(?,?,?)").run(
        entry.id,
        m,
        input.dueDate,
      );
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
export function validDueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function followUpQueue(db, m, today = day()) {
  if (!validDueDate(today)) throw new DomainError("INVALID_DUE_DATE");
  const terms = new Map(
    db
      .prepare("SELECT entry_id,due_date FROM due_terms WHERE merchant=?")
      .all(m)
      .map((r) => [r.entry_id, r.due_date]),
  );
  return dues(db, m)
    .filter((d) => terms.has(d.id))
    .map((d) => ({
      dueId: d.id,
      customerId: d.customerId,
      name: d.name,
      outstanding: d.outstanding,
      dueDate: terms.get(d.id),
      status: terms.get(d.id) <= today ? "payment_check_required" : "scheduled",
    }))
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.dueId.localeCompare(b.dueId),
    );
}
function reminderRows(db, m, scopeDueId) {
  const groups = new Map();
  for (const d of dues(db, m)) {
    const term = db
      .prepare("SELECT due_date FROM due_terms WHERE entry_id=? AND merchant=?")
      .get(d.id, m);
    if (term?.due_date > day()) continue;
    if (scopeDueId && d.id !== scopeDueId) continue;
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
  const shop = db
    .prepare("SELECT shop,language FROM merchants WHERE id=?")
    .get(m);
  return [...groups.values()].map((row) => ({
    ...row,
    message: friendlyReminder(row.name, row.amount, shop.shop, shop.language),
    ...(scopeDueId
      ? {
          scopeDueId,
          dueDate:
            db
              .prepare(
                "SELECT due_date FROM due_terms WHERE entry_id=? AND merchant=?",
              )
              .get(scopeDueId, m)?.due_date || null,
        }
      : {}),
  }));
}
export function friendlyReminder(name, amount, shop, language) {
  const value = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount / 100);
  if (language === "hindi")
    return `नमस्ते ${name} जी 😊 ${value} का छोटा-सा हिसाब याद दिलाना था। सुविधानुसार जमा कर दीजिएगा। भुगतान कर चुके हैं तो बता दें, हिसाब मिला लेते हैं। — ${shop}`;
  if (language === "english")
    return `Hello ${name} 😊 A friendly reminder about your pending ${value}. Please pay when convenient. Already paid? Let us know so we can check our records. — ${shop}`;
  return `Namaste ${name} ji 😊 ${value} ka chhota-sa hisaab yaad dilana tha. Suvidha se jama kar dijiyega. Payment kar chuke hain toh bata dein, hisaab mila lete hain. — ${shop}`;
}
export function propose(db, m, options = {}) {
  if (options.dueId) {
    if (options.unpaidConfirmed !== true)
      throw new DomainError("PAYMENT_CHECK_REQUIRED", 409);
    const item = followUpQueue(db, m).find((d) => d.dueId === options.dueId);
    if (!item) throw new DomainError("DUE_NOT_FOUND", 404);
    if (item.status !== "payment_check_required")
      throw new DomainError("FOLLOW_UP_NOT_DUE", 409);
  }
  const allRows = reminderRows(db, m, options.dueId);
  if (
    options.customerIds &&
    (!options.customerIds.length ||
      options.customerIds.some(
        (id) => !allRows.some((r) => r.customerId === id),
      ))
  )
    throw new DomainError("NO_PENDING_DUES");
  const rows = options.customerIds
    ? allRows.filter((r) => options.customerIds.includes(r.customerId))
    : allRows;
  if (!rows.length) throw new DomainError("NO_PENDING_DUES");
  const existing = db
    .prepare(
      "SELECT * FROM proposals WHERE merchant=? AND status='pending' AND payload=? AND expires>?",
    )
    .get(m, JSON.stringify(rows), Date.now());
  if (existing) return { ...existing, payload: rows };
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
  if (options.dueId)
    log(db, m, "payment_checked_unpaid", {
      dueId: options.dueId,
      amount: rows[0].amount,
      proposal: p.id,
      source: "merchant_confirmation",
    });
  return { ...p, payload: rows };
}
export function whatsappDraft(db, m, proposalId, customerId, phone) {
  const p = db
    .prepare("SELECT * FROM proposals WHERE id=? AND merchant=?")
    .get(proposalId, m);
  if (!p) throw new DomainError("ACTION_NOT_FOUND", 404);
  if (p.status !== "pending" || p.expires < Date.now())
    throw new DomainError("APPROVAL_EXPIRED", 409);
  const row = JSON.parse(p.payload).find((r) => r.customerId === customerId);
  if (!row) throw new DomainError("PROPOSAL_CHANGED", 409);
  const current = reminderRows(db, m, row.scopeDueId).find(
    (r) => r.customerId === customerId,
  );
  if (JSON.stringify(current) !== JSON.stringify(row))
    throw new DomainError("PROPOSAL_CHANGED", 409);
  let number = phone.trim().replace(/[+() .-]/g, "");
  // A plain ten-digit Indian mobile number can omit +91.
  if (/^[6-9]\d{9}$/.test(number)) number = "91" + number;
  if (!/^[1-9]\d{7,14}$/.test(number)) throw new DomainError("INVALID_PHONE");
  return {
    url:
      "https://web.whatsapp.com/send?" +
      new URLSearchParams({ phone: number, text: row.message }),
    status: "draft_ready",
  };
}
export function execute(db, m, id, approve, customerIds) {
  return db.transaction(() => {
    const p = db
      .prepare("SELECT * FROM proposals WHERE id=? AND merchant=?")
      .get(id, m);
    if (!p) throw new DomainError("ACTION_NOT_FOUND", 404);
    const original = JSON.parse(p.payload);
    if (
      customerIds &&
      (!customerIds.length ||
        new Set(customerIds).size !== customerIds.length ||
        customerIds.some((key) => !original.some((r) => r.customerId === key)))
    )
      throw new DomainError("PROPOSAL_CHANGED", 409);
    const recipients = customerIds
      ? original.filter((r) => customerIds.includes(r.customerId))
      : original;
    if (p.status !== "pending") {
      if (customerIds && recipients.length !== original.length)
        throw new DomainError("ACTION_ALREADY_DECIDED", 409);
      if (p.status !== (approve ? "simulated" : "rejected"))
        throw new DomainError("ACTION_ALREADY_DECIDED", 409);
      return { ...p, payload: JSON.parse(p.payload), replayed: true };
    }
    if (p.expires < Date.now()) throw new DomainError("APPROVAL_EXPIRED", 409);
    if (approve) {
      const scoped = JSON.parse(p.payload)[0]?.scopeDueId;
      const current = reminderRows(db, m, scoped).filter((r) =>
        recipients.some((p) => p.customerId === r.customerId),
      );
      if (JSON.stringify(current) !== JSON.stringify(recipients))
        throw new DomainError("PROPOSAL_CHANGED", 409);
    }
    const status = approve ? "simulated" : "rejected";
    const payload = JSON.stringify(approve ? recipients : original);
    db.prepare(
      "UPDATE proposals SET status=?,payload=? WHERE id=? AND merchant=?",
    ).run(status, payload, id, m);
    log(db, m, approve ? "reminder_simulated" : "action_rejected", {
      proposal: id,
      recipients: JSON.parse(payload),
      moneyReceived: 0,
    });
    return { ...p, status, payload: JSON.parse(payload) };
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
      "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE merchant=?)",
    ).run(m);
    db.prepare("DELETE FROM orders WHERE merchant=?").run(m);
    db.prepare("DELETE FROM products WHERE merchant=?").run(m);
    db.prepare("DELETE FROM imported_payments WHERE merchant=?").run(m);
    db.prepare("DELETE FROM payment_import_batches WHERE merchant=?").run(m);
    db.prepare("DELETE FROM voice_audio_requests WHERE merchant=?").run(m);
    db.prepare("DELETE FROM voice_turns WHERE merchant=?").run(m);
    db.prepare("DELETE FROM voice_drafts WHERE merchant=?").run(m);
    db.prepare("DELETE FROM due_terms WHERE merchant=?").run(m);
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
    "due_terms",
    "voice_drafts",
    "voice_turns",
    "voice_audio_requests",
    "payment_import_batches",
    "imported_payments",
    "products",
    "orders",
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
  tables.order_items = db
    .prepare(
      "SELECT * FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE merchant=?)",
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

export function dailyBooks(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (e.reversed) continue;
    const row = groups.get(e.date) || {
      date: e.date,
      inflow: 0,
      outflow: 0,
      creditSales: 0,
      sales: 0,
      collections: 0,
      otherReceipts: 0,
      count: 0,
    };
    row.count++;
    if (e.kind === "udhaar") {
      row.creditSales += e.amount;
      row.sales += e.amount;
    } else if (e.kind === "expense") row.outflow += e.amount;
    else {
      row.inflow += e.amount;
      if (e.kind === "sale") row.sales += e.amount;
      if (e.kind === "collection") row.collections += e.amount;
      if (e.kind === "receipt") row.otherReceipts += e.amount;
    }
    groups.set(e.date, row);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}
