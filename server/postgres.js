import pg from "pg";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { day, cash as calcCash, DomainError } from "./core.js";
import { validDueDate, friendlyReminder, dailyBooks } from "./domain.js";
import { parseCsv, exactDate, rupees, same } from "./payment-import.js";
import { parseOrderText, DEFAULT_KIRANA_PRODUCTS } from "./inventory.js";
import { understand } from "./understanding.js";
import { extractPromise } from "./promise-date.js";

// Ensure BIGINT (int8) is safely parsed to JavaScript numbers within safe limits
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => {
  if (val === null) return null;
  const n = parseInt(val, 10);
  if (n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER) {
    throw new DomainError("INTEGER_OVERFLOW", 400);
  }
  return n;
});

const choose = (language, values) =>
  values[{ english: 0, hindi: 1, hinglish: 2 }[language] ?? 2];
const normalizeText = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/(?:\s+ji|\s+जी)$/u, "")
    .replace(/\s+/g, " ")
    .trim();
const words = (text) =>
  (text || "")
    .toLowerCase()
    .replace(/[.!।,?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const confirmWord = (text) =>
  [
    "confirm save",
    "yes save",
    "haan save karo",
    "han save karo",
    "हाँ सेव करो",
    "हां सेव करो",
    "हाँ दर्ज करो",
    "haan save kar do",
    "han save kar do",
    "haan save kardo",
    "haan record kar do",
    "haan record kardo",
    "haan likh lo",
    "yes record it",
    "save it",
    "record it",
    "proceed and save",
    "हाँ सेव कर दो",
    "हां सेव कर दो",
    "हाँ रिकॉर्ड करो",
    "हाँ रिकॉर्ड कर दो",
    "हां लिख लो",
    "हाँ दर्ज कर दो",
    "जी सेव कर दो",
    "जी हाँ सेव करो",
  ].includes(words(text));
const cancelWord = (text) =>
  [
    "cancel",
    "cancel entry",
    "radd karo",
    "रद्द करो",
    "रद्द",
    "mat likho",
    "मत लिखो",
  ].includes(words(text));
const amountText = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value / 100);
const kinds = {
  sale: ["received sale", "प्राप्त बिक्री", "received sale"],
  expense: ["paid expense", "दिया गया खर्च", "paid kharch"],
  udhaar: ["unpaid sale", "उधार बिक्री", "udhaar bikri"],
  collection: [
    "collection of existing dues",
    "पुराने उधार की वसूली",
    "purane udhaar ki collection",
  ],
};

export function createPostgresPool(options = {}) {
  dotenv.config({ path: "privacy/supabase.env", quiet: true });
  const connectionString = options.connectionString || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL not configured");
  }

  const url = new URL(connectionString);
  for (const opt of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) {
    url.searchParams.delete(opt);
  }

  const caPath = options.caPath || process.env.SUPABASE_DB_CA_PATH;
  return new pg.Pool({
    connectionString: url.toString(),
    max: options.max || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    ssl: {
      rejectUnauthorized: true,
      ...(caPath && existsSync(caPath)
        ? { ca: readFileSync(caPath, "utf8") }
        : {}),
    },
  });
}

export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path TO zuno");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function createPostgresRepository(pool) {
  const q = async (sql, params = []) => {
    return pool.query(sql, params);
  };

  const log = async (client, m, event, detail) => {
    await client.query(
      "INSERT INTO zuno.audit (id, merchant, event, detail, created) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), m, event, JSON.stringify(detail), new Date().toISOString()],
    );
  };

  return {
    provider: "postgres",
    pool,

    async close() {
      await pool.end();
    },

    // --- AUTHENTICATION & MERCHANTS ---
    async getMerchantBySession(sessionHash) {
      const res = await q(
        "SELECT merchant FROM zuno.sessions WHERE hash = $1 AND expires > $2",
        [sessionHash, Date.now()],
      );
      return res.rows[0]?.merchant || null;
    },

    async getMerchantByDevice(deviceHash) {
      const res = await q(
        "SELECT merchant FROM zuno.demo_devices WHERE hash = $1 AND expires > $2",
        [deviceHash, Date.now()],
      );
      return res.rows[0]?.merchant || null;
    },

    async getMerchantByRecoveryKey(keyHash) {
      const res = await q(
        "SELECT merchant FROM zuno.workspace_access WHERE hash = $1",
        [keyHash],
      );
      return res.rows[0]?.merchant || null;
    },

    async createSession(sessionHash, merchant, expires) {
      await q(
        "INSERT INTO zuno.sessions (hash, merchant, expires) VALUES ($1, $2, $3)",
        [sessionHash, merchant, expires],
      );
    },

    async createDemoDevice(deviceHash, merchant, expires) {
      await q(
        "INSERT INTO zuno.demo_devices (hash, merchant, expires) VALUES ($1, $2, $3)",
        [deviceHash, merchant, expires],
      );
    },

    async deleteSession(sessionHash) {
      await q("DELETE FROM zuno.sessions WHERE hash = $1", [sessionHash]);
    },

    async deleteDemoDevice(deviceHash) {
      await q("DELETE FROM zuno.demo_devices WHERE hash = $1", [deviceHash]);
    },

    async createRecoveryKey(merchant, keyHash) {
      return withTransaction(pool, async (client) => {
        await client.query("DELETE FROM zuno.workspace_access WHERE merchant = $1", [merchant]);
        await client.query(
          "INSERT INTO zuno.workspace_access (hash, merchant) VALUES ($1, $2)",
          [keyHash, merchant],
        );
      });
    },

    async seed(m) {
      return withTransaction(pool, async (client) => {
        await client.query(
          "INSERT INTO zuno.merchants (id, shop, owner, opening, language, setup) VALUES ($1, $2, $3, $4, $5, $6)",
          [m, "Ramesh Kirana", "Ramesh Kumar", 1200000, "hinglish", 0],
        );

        for (const [i, name, amount] of [
          [1, "Sharma ji", 200000],
          [2, "Priya", 300000],
          [3, "Amit", 250000],
          [4, "Neha", 250000],
        ]) {
          await client.query(
            "INSERT INTO zuno.entries (id, merchant, kind, amount, name, method, date, note, due_id, source, request_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            [`due-${m}-${i}`, m, "udhaar", amount, name, "cash", day(-i), "", null, "merchant", `seed-due-${i}`],
          );
        }

        await client.query(
          "INSERT INTO zuno.entries (id, merchant, kind, amount, name, method, date, note, due_id, source, request_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
          [randomUUID(), m, "sale", 85000, "Counter sale", "upi", day(), "", null, "matched", "seed-sale-1"],
        );
        await client.query(
          "INSERT INTO zuno.entries (id, merchant, kind, amount, name, method, date, note, due_id, source, request_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
          [randomUUID(), m, "sale", 35000, "Counter sale", "cash", day(), "", null, "merchant", "seed-sale-2"],
        );
        await client.query(
          "INSERT INTO zuno.entries (id, merchant, kind, amount, name, method, date, note, due_id, source, request_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
          [randomUUID(), m, "expense", 120000, "Supplier", "cash", day(), "", null, "merchant", "seed-expense"],
        );

        for (const [label, amount] of [
          ["Supplier payment", 2600000],
          ["Shop rent", 1200000],
        ]) {
          await client.query(
            "INSERT INTO zuno.obligations (id, merchant, label, amount, date) VALUES ($1, $2, $3, $4, $5)",
            [randomUUID(), m, label, amount, day(1)],
          );
        }

        await log(client, m, "demo_created", { synthetic: true });
      });
    },

    async updateShop(m, values) {
      await q(
        "UPDATE zuno.merchants SET shop = $1, owner = $2, language = $3, setup = 1 WHERE id = $4",
        [values.shop, values.owner, values.language, m],
      );
    },

    async resetDemo(m) {
      return withTransaction(pool, async (client) => {
        await client.query(
          "DELETE FROM zuno.order_items WHERE order_id IN (SELECT id FROM zuno.orders WHERE merchant = $1)",
          [m],
        );
        await client.query("DELETE FROM zuno.orders WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.products WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.imported_payments WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.payment_import_batches WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.voice_audio_requests WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.voice_turns WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.voice_drafts WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.due_terms WHERE merchant = $1", [m]);
        await client.query(
          "DELETE FROM zuno.entry_customers WHERE entry_id IN (SELECT id FROM zuno.entries WHERE merchant = $1)",
          [m],
        );
        await client.query("DELETE FROM zuno.customers WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.workspace_access WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.schedule_requests WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.audit WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.proposals WHERE merchant = $1", [m]);
        await client.query(
          "DELETE FROM zuno.entry_schedule WHERE entry_id IN (SELECT id FROM zuno.entries WHERE merchant = $1)",
          [m],
        );
        await client.query("DELETE FROM zuno.entry_voids WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.entries WHERE merchant = $1 AND due_id IS NOT NULL", [m]);
        await client.query("DELETE FROM zuno.entries WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.obligations WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.sessions WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.demo_devices WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.schedule WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.planning_initialized WHERE merchant = $1", [m]);
        await client.query("DELETE FROM zuno.merchants WHERE id = $1", [m]);
      });
    },

    // --- DUES & RECONCILIATION ---
    async dues(m, client = null) {
      const runner = client || pool;
      const res = await runner.query(`
        SELECT e.*, c.customer_id as customer_id
        FROM zuno.entries e
        LEFT JOIN zuno.entry_customers c ON c.entry_id = e.id
        WHERE e.merchant = $1 AND e.kind = 'udhaar'
          AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids v WHERE v.entry_id = e.id)
        ORDER BY e.date ASC, e.id ASC
      `, [m]);

      const collectionsRes = await runner.query(`
        SELECT due_id, SUM(amount) as collected
        FROM zuno.entries
        WHERE merchant = $1 AND kind = 'collection'
          AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids v WHERE v.entry_id = entries.id)
        GROUP BY due_id
      `, [m]);

      const collMap = new Map();
      for (const r of collectionsRes.rows) {
        collMap.set(r.due_id, Number(r.collected));
      }

      const pending = [];
      for (const e of res.rows) {
        const collected = collMap.get(e.id) || 0;
        const outstanding = Number(e.amount) - collected;
        if (outstanding > 0) {
          pending.push({
            id: e.id,
            customerId: e.customer_id || null,
            name: e.name,
            amount: Number(e.amount),
            outstanding,
            date: e.date,
          });
        }
      }
      return pending;
    },

    async followUpQueue(m, today = day()) {
      if (!validDueDate(today)) throw new DomainError("INVALID_DUE_DATE");
      const termsRes = await q(
        "SELECT entry_id, due_date FROM zuno.due_terms WHERE merchant = $1",
        [m],
      );
      const terms = new Map(termsRes.rows.map((r) => [r.entry_id, r.due_date]));

      const activeDues = await this.dues(m);
      return activeDues
        .filter((d) => terms.has(d.id))
        .map((d) => ({
          dueId: d.id,
          customerId: d.customerId,
          name: d.name,
          outstanding: d.outstanding,
          dueDate: terms.get(d.id),
          status: terms.get(d.id) <= today ? "payment_check_required" : "scheduled",
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.dueId.localeCompare(b.dueId));
    },

    // --- CASH & SNAPSHOT ---
    async cash(m, client = null) {
      const runner = client || pool;
      const mRes = await runner.query("SELECT opening FROM zuno.merchants WHERE id = $1", [m]);
      if (!mRes.rows.length) return 0;
      let balance = Number(mRes.rows[0].opening);

      const entriesRes = await runner.query(`
        SELECT kind, amount FROM zuno.entries e
        WHERE merchant = $1 AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids v WHERE v.entry_id = e.id)
      `, [m]);

      for (const r of entriesRes.rows) {
        const amt = Number(r.amount);
        if (r.kind === "sale" || r.kind === "collection" || r.kind === "receipt") {
          balance += amt;
        } else if (r.kind === "expense") {
          balance -= amt;
        }
      }
      return balance;
    },

    async initPlanning(m, client = null) {
      const runner = client || pool;
      const initRes = await runner.query(
        "SELECT 1 FROM zuno.planning_initialized WHERE merchant = $1",
        [m],
      );
      if (initRes.rows.length) return;

      await withTransaction(pool, async (tx) => {
        const check = await tx.query("SELECT 1 FROM zuno.planning_initialized WHERE merchant = $1", [m]);
        if (check.rows.length) return;

        const obRes = await tx.query("SELECT * FROM zuno.obligations WHERE merchant = $1", [m]);
        for (const r of obRes.rows) {
          await tx.query(
            `INSERT INTO zuno.schedule (id, merchant, direction, label, amount, date, status, source, request_key, kind, version)
             VALUES ($1, $2, 'out', $3, $4, $5, 'pending', 'demo', $6, 'expense', 1)
             ON CONFLICT (id) DO NOTHING`,
            [r.id, m, r.label, Number(r.amount), r.date, `legacy-${r.id}`],
          );
        }

        const auditRes = await tx.query(
          "SELECT created FROM zuno.audit WHERE merchant = $1 AND event = 'demo_created' ORDER BY created ASC LIMIT 1",
          [m],
        );
        const created = auditRes.rows[0]?.created;
        const base = created
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(created))
          : day();

        for (let i = 1; i <= 14; i++) {
          const date = new Date(`${base}T12:00:00Z`);
          date.setUTCDate(date.getUTCDate() + i);
          const isoDate = date.toISOString().slice(0, 10);
          await tx.query(
            `INSERT INTO zuno.schedule (id, merchant, direction, label, amount, date, status, source, request_key, kind, version)
             VALUES ($1, $2, 'in', 'Expected settled sales', $3, $4, 'pending', 'demo', $5, 'sale', 1)
             ON CONFLICT (id) DO NOTHING`,
            [randomUUID(), m, i < 3 ? 250000 : i === 3 ? 300000 : 120000, isoDate, `seed-in-${i}`],
          );
        }

        await tx.query(
          "INSERT INTO zuno.planning_initialized (merchant) VALUES ($1) ON CONFLICT (merchant) DO NOTHING",
          [m],
        );
      });
    },

    async schedules(m) {
      await this.initPlanning(m);
      const res = await q(
        "SELECT * FROM zuno.schedule WHERE merchant = $1 AND status = 'pending' ORDER BY date, id",
        [m],
      );
      return res.rows.map((r) => ({ ...r, amount: Number(r.amount) }));
    },

    async planForecast(m, scenario = "expected") {
      const rows = await this.schedules(m);
      let balance = await this.cash(m);
      const points = Array.from({ length: 14 }, (_, i) => {
        const date = day(i + 1);
        const due = rows.filter(
          (r) =>
            r.date === date ||
            (i === 0 && r.direction === "out" && r.date <= day()),
        );
        const inflow = due
          .filter((r) => r.direction === "in")
          .reduce((s, r) => s + r.amount, 0);
        const outflow = due
          .filter((r) => r.direction === "out")
          .reduce((s, r) => s + r.amount, 0);
        const adjusted = Math.round(
          inflow * (scenario === "conservative" ? 0.7 : 1),
        );
        balance += adjusted - outflow;
        return { date, inflow: adjusted, outflow, balance };
      });
      return {
        points,
        obligations: rows.filter((r) => r.direction === "out"),
        schedule: rows,
        firstGap: points.find((p) => p.balance < 0) || null,
        method: "scheduled-cash-flow",
        scenario,
        overdue: rows.filter((r) => r.date <= day()),
      };
    },

    async recommendations(m, activeDues, scenario = "expected") {
      const f = await this.planForecast(m, scenario);
      const gap = f.firstGap;
      if (!gap) return [];
      const pending = activeDues.reduce((s, d) => s + d.outstanding, 0);
      const shortage = -gap.balance;
      const affected = f.obligations.filter((o) => o.date <= gap.date);
      return [
        pending > 0
          ? {
              type: "collect_dues",
              potential: pending,
              assumed: Math.round(pending * 0.5),
              residual: Math.max(0, shortage - pending),
              sourceIds: activeDues.map((d) => d.id),
              conditional: true,
            }
          : null,
        affected.length
          ? {
              type: "review_payments",
              amount: affected.reduce((s, o) => s + o.amount, 0),
              sourceIds: affected.map((o) => o.id),
              conditional: true,
            }
          : null,
      ].filter(Boolean);
    },

    async snapshot(m, scenario = "expected", complete = false) {
      const merchantRes = await q("SELECT * FROM zuno.merchants WHERE id = $1", [m]);
      if (!merchantRes.rows.length) throw new DomainError("MERCHANT_NOT_FOUND", 404);
      const merchant = merchantRes.rows[0];

      const entriesRes = await q(`
        SELECT e.*,
          (SELECT reason FROM zuno.entry_voids v WHERE v.entry_id = e.id) AS reversed,
          (SELECT customer_id FROM zuno.entry_customers c WHERE c.entry_id = e.id) AS customer_id
        FROM zuno.entries e
        WHERE merchant = $1
        ORDER BY date DESC, id DESC
      `, [m]);

      const entries = entriesRes.rows.map((e) => ({
        ...e,
        amount: Number(e.amount),
        customerId: e.customer_id || null,
        reversed: e.reversed || null,
      }));

      const activeDues = await this.dues(m);
      const pendingTotal = activeDues.reduce((s, d) => s + d.outstanding, 0);
      const cashBalance = await this.cash(m);

      const today = day();
      const salesToday = entries
        .filter((e) => (e.kind === "sale" || e.kind === "udhaar") && !e.reversed && e.date === today)
        .reduce((s, e) => s + e.amount, 0);

      const followUps = await this.followUpQueue(m, today);
      const customersRes = await q("SELECT * FROM zuno.customers WHERE merchant = $1 ORDER BY name, id", [m]);

      const auditLimit = complete ? "" : " LIMIT 100";
      const auditRes = await q(`SELECT * FROM zuno.audit WHERE merchant = $1 ORDER BY created DESC${auditLimit}`, [m]);

      const importedRes = await q(`
        SELECT p.*, (SELECT reason FROM zuno.entry_voids v WHERE v.entry_id = p.entry_id) AS reversed
        FROM zuno.imported_payments p WHERE merchant = $1 ORDER BY date DESC, id DESC
      `, [m]);

      const prodsRes = await q("SELECT * FROM zuno.products WHERE merchant = $1 AND active = 1 ORDER BY name ASC", [m]);
      const orders = await this.listOrders(m, 20);

      return {
        merchant: {
          id: merchant.id,
          shop: merchant.shop,
          owner: merchant.owner,
          opening: Number(merchant.opening),
          language: merchant.language,
          setup: Number(merchant.setup),
        },
        dayBooks: dailyBooks(entries),
        paymentInbox: importedRes.rows.map((p) => ({ ...p, amount: Number(p.amount) })),
        followUps,
        customers: customersRes.rows,
        entries,
        dues: activeDues,
        cash: cashBalance,
        pending: pendingTotal,
        salesToday,
        forecast: await this.planForecast(m, scenario),
        recommendations: await this.recommendations(m, activeDues, scenario),
        audit: auditRes.rows,
        products: prodsRes.rows.map((p) => ({ ...p, price: Number(p.price) })),
        orders,
        readiness: {
          days: new Set(entries.filter((e) => !e.reversed).map((e) => e.date)).size,
          matched: entries.filter((e) => !e.reversed && e.source === "matched").length,
          total: entries.filter((e) => !e.reversed).length,
          expenses: entries.filter((e) => !e.reversed && e.kind === "expense").length,
        },
      };
    },

    // --- FINANCIAL ENTRIES (TRANSACTIONAL & CONCURRENCY SAFE) ---
    async addEntry(m, input, options = {}) {
      const recordedDate = options.date || day();
      const recordedSource = options.source || "merchant";
      if (!validDueDate(recordedDate) || recordedDate > day()) {
        throw new DomainError("INVALID_DUE_DATE");
      }

      return withTransaction(pool, async (client) => {
        // Idempotency check with row locking
        const duplicateRes = await client.query(
          "SELECT * FROM zuno.entries WHERE merchant = $1 AND request_key = $2",
          [m, input.requestKey],
        );
        if (duplicateRes.rows.length) {
          const duplicate = duplicateRes.rows[0];
          const termRes = await client.query(
            "SELECT due_date FROM zuno.due_terms WHERE entry_id = $1 AND merchant = $2",
            [duplicate.id, m],
          );
          if ((termRes.rows[0]?.due_date || null) !== (input.dueDate || null)) {
            throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
          }
          return { ...duplicate, amount: Number(duplicate.amount) };
        }

        if (input.dueDate && (input.kind !== "udhaar" || !validDueDate(input.dueDate))) {
          throw new DomainError("INVALID_DUE_DATE");
        }

        // Collection over-collection concurrency guard using FOR UPDATE
        if (input.kind === "collection") {
          if (!input.dueId) throw new DomainError("COLLECTION_REQUIRES_DUE_ID", 400);

          const dueRes = await client.query(
            "SELECT * FROM zuno.entries WHERE id = $1 AND merchant = $2 FOR UPDATE",
            [input.dueId, m],
          );
          if (!dueRes.rows.length) throw new DomainError("DUE_NOT_FOUND", 404);
          const dueEntry = dueRes.rows[0];

          const collectedRes = await client.query(`
            SELECT COALESCE(SUM(amount), 0) as collected FROM zuno.entries
            WHERE due_id = $1 AND merchant = $2
              AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids v WHERE v.entry_id = entries.id)
          `, [input.dueId, m]);

          const totalCollected = Number(collectedRes.rows[0].collected);
          const remaining = Number(dueEntry.amount) - totalCollected;

          if (input.amount > remaining) {
            throw new DomainError("COLLECTION_EXCEEDS_DUE", 400);
          }
          input.name = dueEntry.name;
        }

        // Expense cash balance check
        if (input.kind === "expense") {
          const currentCash = await this.cash(m, client);
          if (input.amount > currentCash) {
            throw new DomainError("INSUFFICIENT_CASH");
          }
        }

        // Customer binding
        let customerId = null;
        if (input.kind === "udhaar") {
          if (!input.name || !input.name.trim()) throw new DomainError("NAME_REQUIRED", 400);
          if (input.customerId) {
            const cRes = await client.query(
              "SELECT * FROM zuno.customers WHERE id = $1 AND merchant = $2",
              [input.customerId, m],
            );
            if (!cRes.rows.length || cRes.rows[0].name !== input.name) {
              throw new DomainError("CUSTOMER_CHANGED", 409);
            }
            customerId = cRes.rows[0].id;
          } else {
            customerId = randomUUID();
            await client.query(
              "INSERT INTO zuno.customers (id, merchant, name, legacy) VALUES ($1, $2, $3, 0)",
              [customerId, m, input.name.trim()],
            );
          }
        } else if (input.kind === "collection") {
          const ecRes = await client.query(
            "SELECT customer_id FROM zuno.entry_customers WHERE entry_id = $1",
            [input.dueId],
          );
          customerId = ecRes.rows[0]?.customer_id || null;
        }

        let scheduled = null;
        if (input.scheduleId) {
          const schedRes = await client.query(
            "SELECT * FROM zuno.schedule WHERE id = $1 AND merchant = $2 AND status = 'pending' FOR UPDATE",
            [input.scheduleId, m],
          );
          if (!schedRes.rows.length) throw new DomainError("PLAN_ITEM_NOT_FOUND", 404);
          scheduled = schedRes.rows[0];
          if (input.scheduleVersion !== scheduled.version) {
            throw new DomainError("PLAN_CHANGED", 409);
          }
          if (
            input.amount !== Number(scheduled.amount) ||
            (scheduled.direction === "out" ? input.kind !== "expense" : input.kind !== scheduled.kind) ||
            (scheduled.kind === "collection" && input.dueId !== scheduled.due_id)
          ) {
            throw new DomainError("SCHEDULE_MISMATCH", 409);
          }
        }

        const entryId = randomUUID();
        const entry = {
          id: entryId,
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

        await client.query(
          `INSERT INTO zuno.entries (id, merchant, kind, amount, name, method, date, note, due_id, source, request_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            entry.id, entry.merchant, entry.kind, entry.amount,
            entry.name, entry.method, entry.date, entry.note,
            entry.due_id, entry.source, entry.request_key
          ],
        );

        if (input.dueDate) {
          await client.query(
            "INSERT INTO zuno.due_terms (entry_id, merchant, due_date) VALUES ($1, $2, $3)",
            [entry.id, m, input.dueDate],
          );
        }

        if (customerId) {
          await client.query(
            "INSERT INTO zuno.entry_customers (entry_id, customer_id) VALUES ($1, $2)",
            [entry.id, customerId],
          );
        }

        if (scheduled) {
          await client.query(
            "INSERT INTO zuno.entry_schedule (entry_id, schedule_id) VALUES ($1, $2)",
            [entry.id, scheduled.id],
          );
          await client.query(
            "UPDATE zuno.schedule SET version = version + 1, status = 'completed' WHERE id = $1 AND merchant = $2",
            [scheduled.id, m],
          );
          await log(client, m, "plan_item_completed", {
            id: scheduled.id,
            entryId: entry.id,
          });
        }

        await log(client, m, "entry_recorded", {
          id: entry.id,
          kind: entry.kind,
          amount: entry.amount,
        });

        return entry;
      });
    },

    async reverseEntry(m, id, reason, requestKey) {
      return withTransaction(pool, async (client) => {
        // Idempotency check
        const dupRes = await client.query(
          "SELECT * FROM zuno.entry_voids WHERE merchant = $1 AND request_key = $2",
          [m, requestKey],
        );
        if (dupRes.rows.length) {
          const prior = dupRes.rows[0];
          if (prior.entry_id !== id || prior.reason !== reason) {
            throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
          }
          return { id, reversed: true, ok: true, replayed: true };
        }

        const eRes = await client.query(
          "SELECT * FROM zuno.entries WHERE id = $1 AND merchant = $2 FOR UPDATE",
          [id, m],
        );
        if (!eRes.rows.length) throw new DomainError("ENTRY_NOT_FOUND", 404);
        const e = eRes.rows[0];

        const vRes = await client.query(
          "SELECT 1 FROM zuno.entry_voids WHERE entry_id = $1",
          [id],
        );
        if (vRes.rows.length) throw new DomainError("ALREADY_REVERSED", 409);

        // Cannot reverse udhaar if collected
        if (e.kind === "udhaar") {
          const collRes = await client.query(
            "SELECT 1 FROM zuno.entries WHERE due_id = $1 AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids WHERE entry_id = entries.id)",
            [id],
          );
          if (collRes.rows.length) {
            throw new DomainError("CANNOT_REVERSE_COLLECTED_DUE", 400);
          }
        }

        await client.query(
          "INSERT INTO zuno.entry_voids (entry_id, merchant, reason, request_key, created) VALUES ($1, $2, $3, $4, $5)",
          [id, m, reason, requestKey, new Date().toISOString()],
        );

        const linkedRes = await client.query(
          "SELECT schedule_id FROM zuno.entry_schedule WHERE entry_id = $1",
          [id],
        );
        if (linkedRes.rows.length) {
          await client.query(
            "UPDATE zuno.schedule SET version = version + 1, status = 'pending' WHERE id = $1 AND merchant = $2",
            [linkedRes.rows[0].schedule_id, m],
          );
        }

        await log(client, m, "entry_reversed", { id, kind: e.kind, amount: Number(e.amount), reason });
        return { id, ok: true, reversed: true };
      });
    },

    // --- PLANNING & SCHEDULES ---
    async addSchedule(m, v) {
      return withTransaction(pool, async (client) => {
        const priorRes = await client.query(
          "SELECT * FROM zuno.schedule WHERE merchant = $1 AND request_key = $2",
          [m, v.requestKey],
        );
        const kind = v.direction === "out" ? "expense" : v.kind || "sale";
        const payload = JSON.stringify({
          direction: v.direction,
          label: v.label,
          amount: v.amount,
          date: v.date,
          kind,
          dueId: kind === "collection" ? v.dueId || null : null,
        });

        if (priorRes.rows.length) {
          const prior = priorRes.rows[0];
          const savedRes = await client.query(
            "SELECT payload FROM zuno.schedule_requests WHERE merchant = $1 AND request_key = $2",
            [m, v.requestKey],
          );
          const legacy = JSON.stringify({
            direction: prior.direction,
            label: prior.label,
            amount: Number(prior.amount),
            date: prior.date,
            kind: prior.kind,
            dueId: prior.due_id,
          });
          if ((savedRes.rows[0]?.payload || legacy) !== payload) {
            throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
          }
          return { ...prior, amount: Number(prior.amount) };
        }

        if (kind === "collection") {
          if (!v.dueId) throw new DomainError("DUE_NOT_FOUND", 400);
          const dueRes = await client.query(
            "SELECT * FROM zuno.entries WHERE id = $1 AND merchant = $2 AND kind = 'udhaar' AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids WHERE entry_id = entries.id)",
            [v.dueId, m],
          );
          if (!dueRes.rows.length) throw new DomainError("DUE_NOT_FOUND", 400);
        }

        const id = randomUUID();
        const row = {
          id,
          merchant: m,
          direction: v.direction,
          label: v.label,
          amount: v.amount,
          date: v.date,
          status: "pending",
          source: "merchant",
          request_key: v.requestKey,
          version: 1,
          kind,
          due_id: kind === "collection" ? v.dueId : null,
        };

        await client.query(
          `INSERT INTO zuno.schedule (id, merchant, direction, label, amount, date, status, source, request_key, version, kind, due_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [row.id, row.merchant, row.direction, row.label, row.amount, row.date, row.status, row.source, row.request_key, row.version, row.kind, row.due_id],
        );
        await client.query(
          "INSERT INTO zuno.schedule_requests (merchant, request_key, payload) VALUES ($1, $2, $3)",
          [m, v.requestKey, payload],
        );
        await log(client, m, "plan_item_added", { id: row.id, amount: row.amount });
        return row;
      });
    },

    async changeSchedule(m, id, v) {
      return withTransaction(pool, async (client) => {
        const rowRes = await client.query(
          "SELECT * FROM zuno.schedule WHERE id = $1 AND merchant = $2 AND status = 'pending' FOR UPDATE",
          [id, m],
        );
        if (!rowRes.rows.length) throw new DomainError("PLAN_ITEM_NOT_FOUND", 404);
        const row = rowRes.rows[0];
        if (v.version !== row.version) throw new DomainError("PLAN_CHANGED", 409);

        if (v.status === "cancelled") {
          await client.query(
            "UPDATE zuno.schedule SET version = version + 1, status = 'cancelled' WHERE id = $1 AND merchant = $2",
            [id, m],
          );
          await log(client, m, "plan_item_cancelled", { id });
        } else {
          await client.query(
            "UPDATE zuno.schedule SET version = version + 1, label = $1, amount = $2, date = $3, source = 'merchant' WHERE id = $4 AND merchant = $5",
            [v.label, v.amount, v.date, id, m],
          );
          await log(client, m, "plan_item_updated", {
            id,
            previous: {
              label: row.label,
              amount: Number(row.amount),
              date: row.date,
              version: row.version,
            },
            previousDate: row.date,
            date: v.date,
            amount: v.amount,
          });
        }
        return { ok: true };
      });
    },

    // --- PROPOSALS & ACTIONS ---
    async reminderRows(m, scopeDueId = null) {
      const activeDues = await this.dues(m);
      const termsRes = await q("SELECT entry_id, due_date FROM zuno.due_terms WHERE merchant = $1", [m]);
      const terms = new Map(termsRes.rows.map((r) => [r.entry_id, r.due_date]));
      const groups = new Map();

      for (const d of activeDues) {
        const dueDate = terms.get(d.id);
        if (dueDate && dueDate > day()) continue;
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

      const mRes = await q("SELECT shop, language FROM zuno.merchants WHERE id = $1", [m]);
      const shop = mRes.rows[0] || { shop: "Zuno", language: "hinglish" };

      return [...groups.values()].map((row) => ({
        ...row,
        message: friendlyReminder(row.name, row.amount, shop.shop, shop.language),
        ...(scopeDueId
          ? {
              scopeDueId,
              dueDate: terms.get(scopeDueId) || null,
            }
          : {}),
      }));
    },

    async propose(m, options = {}) {
      if (options.dueId) {
        if (options.unpaidConfirmed !== true) {
          throw new DomainError("PAYMENT_CHECK_REQUIRED", 409);
        }
        const item = (await this.followUpQueue(m)).find((d) => d.dueId === options.dueId);
        if (!item) throw new DomainError("DUE_NOT_FOUND", 404);
        if (item.status !== "payment_check_required") {
          throw new DomainError("FOLLOW_UP_NOT_DUE", 409);
        }
      }

      const allRows = await this.reminderRows(m, options.dueId);
      if (
        options.customerIds &&
        (!options.customerIds.length ||
          options.customerIds.some((id) => !allRows.some((r) => r.customerId === id)))
      ) {
        throw new DomainError("NO_PENDING_DUES");
      }
      const rows = options.customerIds
        ? allRows.filter((r) => options.customerIds.includes(r.customerId))
        : allRows;
      if (!rows.length) throw new DomainError("NO_PENDING_DUES");

      const rowsJson = JSON.stringify(rows);
      const existRes = await q(
        "SELECT * FROM zuno.proposals WHERE merchant = $1 AND status = 'pending' AND payload = $2 AND expires > $3",
        [m, rowsJson, Date.now()],
      );
      if (existRes.rows.length) {
        return { ...existRes.rows[0], payload: rows };
      }

      const p = {
        id: randomUUID(),
        merchant: m,
        payload: rowsJson,
        expires: Date.now() + 300000,
        status: "pending",
      };
      await q(
        "INSERT INTO zuno.proposals (id, merchant, payload, expires, status) VALUES ($1, $2, $3, $4, $5)",
        [p.id, p.merchant, p.payload, p.expires, p.status],
      );

      if (options.dueId) {
        await withTransaction(pool, async (client) => {
          await log(client, m, "payment_checked_unpaid", {
            dueId: options.dueId,
            amount: rows[0].amount,
            proposal: p.id,
            source: "merchant_confirmation",
          });
        });
      }
      return { ...p, payload: rows };
    },

    async execute(m, id, approve, customerIds) {
      return withTransaction(pool, async (client) => {
        const pRes = await client.query(
          "SELECT * FROM zuno.proposals WHERE id = $1 AND merchant = $2 FOR UPDATE",
          [id, m],
        );
        if (!pRes.rows.length) throw new DomainError("ACTION_NOT_FOUND", 404);
        const p = pRes.rows[0];
        const original = JSON.parse(p.payload);
        if (
          customerIds &&
          (!customerIds.length ||
            new Set(customerIds).size !== customerIds.length ||
            customerIds.some((key) => !original.some((r) => r.customerId === key)))
        ) {
          throw new DomainError("PROPOSAL_CHANGED", 409);
        }
        const recipients = customerIds
          ? original.filter((r) => customerIds.includes(r.customerId))
          : original;
        if (p.status !== "pending") {
          if (customerIds && recipients.length !== original.length) {
            throw new DomainError("ACTION_ALREADY_DECIDED", 409);
          }
          if (p.status !== (approve ? "simulated" : "rejected")) {
            throw new DomainError("ACTION_ALREADY_DECIDED", 409);
          }
          return { ...p, payload: JSON.parse(p.payload), replayed: true };
        }
        if (Number(p.expires) < Date.now()) throw new DomainError("APPROVAL_EXPIRED", 409);
        if (approve) {
          const scoped = original[0]?.scopeDueId;
          const current = (await this.reminderRows(m, scoped)).filter((r) =>
            recipients.some((rec) => rec.customerId === r.customerId),
          );
          if (JSON.stringify(current) !== JSON.stringify(recipients)) {
            throw new DomainError("PROPOSAL_CHANGED", 409);
          }
        }
        const status = approve ? "simulated" : "rejected";
        const payload = JSON.stringify(approve ? recipients : original);
        await client.query(
          "UPDATE zuno.proposals SET status = $1, payload = $2 WHERE id = $3 AND merchant = $4",
          [status, payload, id, m],
        );
        await log(client, m, approve ? "reminder_simulated" : "action_rejected", {
          proposal: id,
          recipients: JSON.parse(payload),
          moneyReceived: 0,
        });
        return { id, status, payload: JSON.parse(payload) };
      });
    },

    async whatsappDraft(m, proposalId, customerId, phone) {
      const pRes = await q(
        "SELECT * FROM zuno.proposals WHERE id = $1 AND merchant = $2",
        [proposalId, m],
      );
      if (!pRes.rows.length) throw new DomainError("ACTION_NOT_FOUND", 404);
      const p = pRes.rows[0];
      if (p.status !== "pending" || Number(p.expires) < Date.now()) {
        throw new DomainError("APPROVAL_EXPIRED", 409);
      }
      const row = JSON.parse(p.payload).find((r) => r.customerId === customerId);
      if (!row) throw new DomainError("PROPOSAL_CHANGED", 409);
      const current = (await this.reminderRows(m, row.scopeDueId)).find(
        (r) => r.customerId === customerId,
      );
      if (JSON.stringify(current) !== JSON.stringify(row)) {
        throw new DomainError("PROPOSAL_CHANGED", 409);
      }
      let number = phone.trim().replace(/[+() .-]/g, "");
      if (/^[6-9]\d{9}$/.test(number)) number = "91" + number;
      if (!/^[1-9]\d{7,14}$/.test(number)) throw new DomainError("INVALID_PHONE");
      return {
        url:
          "https://web.whatsapp.com/send?" +
          new URLSearchParams({ phone: number, text: row.message }),
        message: row.message,
        phone: number,
      };
    },

    // --- PAYMENT REPORT IMPORTS ---
    async previewImport(m, csv, mapping, defaultType, dateFormat = "iso") {
      const parsed = parseCsv(csv);
      for (const key of ["reference", "date", "amount", "status"]) {
        if (!parsed.headers.includes(mapping[key])) {
          throw new DomainError("IMPORT_COLUMNS");
        }
      }
      for (const key of ["name", "recordType"]) {
        if (mapping[key] && !parsed.headers.includes(mapping[key])) {
          throw new DomainError("IMPORT_COLUMNS");
        }
      }

      const get = (row, key) => (mapping[key] ? row[parsed.headers.indexOf(mapping[key])] : "");
      const seen = new Set();
      const rows = [];
      let skipped = 0;

      for (const row of parsed.rows) {
        const rawStatus = (get(row, "status") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (["pending", "failed", "failure", "txnfailure"].includes(rawStatus)) {
          skipped++;
          continue;
        }
        if (!["success", "successful", "txnsuccess", "settled"].includes(rawStatus)) {
          throw new DomainError("IMPORT_STATUS_REVIEW");
        }
        const record_type = (get(row, "recordType") || "").toLowerCase() || defaultType;
        if (!["payment", "settlement"].includes(record_type)) {
          throw new DomainError("IMPORT_RECORD_TYPE");
        }
        if (
          record_type === "payment" &&
          (rawStatus === "settled" ||
            (mapping.amount || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "netsettledamount" ||
            (mapping.date || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "settlementdate")
        ) {
          throw new DomainError("IMPORT_RECORD_TYPE");
        }
        const reference = get(row, "reference");
        if (!reference || reference.length > 100) {
          throw new DomainError("IMPORT_REFERENCE");
        }
        const key = record_type + ":" + reference;
        if (seen.has(key)) throw new DomainError("IMPORT_DUPLICATE_ROWS");
        seen.add(key);

        const data = {
          reference,
          record_type,
          date: exactDate(get(row, "date"), dateFormat),
          amount: rupees(get(row, "amount")),
          name: get(row, "name") || "Paytm report",
        };
        if (data.date > day() || data.name.length > 80) {
          throw new DomainError("IMPORT_INVALID_DATE");
        }

        const priorRes = await q(
          "SELECT * FROM zuno.imported_payments WHERE merchant = $1 AND record_type = $2 AND reference = $3",
          [m, record_type, reference],
        );
        if (priorRes.rows.length && !same(priorRes.rows[0], data)) {
          throw new DomainError("IMPORT_CONFLICT", 409);
        }
        rows.push({ ...data, duplicate: priorRes.rows.length > 0 });
      }

      if (!rows.length) throw new DomainError("IMPORT_NO_SUCCESSFUL_ROWS");

      const batch = {
        id: randomUUID(),
        merchant: m,
        payload: JSON.stringify(rows),
        expires: Date.now() + 600000,
        result: null,
      };

      await q(
        "INSERT INTO zuno.payment_import_batches (id, merchant, payload, expires, result) VALUES ($1, $2, $3, $4, $5)",
        [batch.id, batch.merchant, batch.payload, batch.expires, batch.result],
      );

      return {
        batchId: batch.id,
        rows,
        skipped,
        newCount: rows.filter((r) => !r.duplicate).length,
        expires: batch.expires,
      };
    },

    async confirmImport(m, id) {
      return withTransaction(pool, async (client) => {
        const batchRes = await client.query(
          "SELECT * FROM zuno.payment_import_batches WHERE id = $1 AND merchant = $2",
          [id, m],
        );
        if (!batchRes.rows.length) throw new DomainError("ACTION_NOT_FOUND", 404);
        const batch = batchRes.rows[0];
        if (batch.result) return { ...JSON.parse(batch.result), replayed: true };
        if (Number(batch.expires) < Date.now()) throw new DomainError("APPROVAL_EXPIRED", 409);

        let imported = 0;
        let duplicates = 0;
        const rows = JSON.parse(batch.payload);

        for (const row of rows) {
          const priorRes = await client.query(
            "SELECT * FROM zuno.imported_payments WHERE merchant = $1 AND record_type = $2 AND reference = $3",
            [m, row.record_type, row.reference],
          );
          if (priorRes.rows.length) {
            if (!same(priorRes.rows[0], row)) throw new DomainError("IMPORT_CONFLICT", 409);
            duplicates++;
            continue;
          }
          await client.query(
            `INSERT INTO zuno.imported_payments (id, merchant, batch_id, reference, record_type, date, amount, name, source, entry_id, decision)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL)`,
            [
              randomUUID(), m, id, row.reference, row.record_type,
              row.date, row.amount, row.name, "report_unverified",
            ],
          );
          imported++;
        }

        const result = { imported, duplicates };
        await client.query(
          "UPDATE zuno.payment_import_batches SET result = $1 WHERE id = $2 AND merchant = $3",
          [JSON.stringify(result), id, m],
        );
        await log(client, m, "payment_report_imported", { ...result, batch: id, moneyReceived: 0 });
        return result;
      });
    },

    async classifyPayment(m, id, input) {
      return withTransaction(pool, async (client) => {
        const pRes = await client.query(
          "SELECT * FROM zuno.imported_payments WHERE id = $1 AND merchant = $2 FOR UPDATE",
          [id, m],
        );
        if (!pRes.rows.length) throw new DomainError("ENTRY_NOT_FOUND", 404);
        const p = pRes.rows[0];
        if (p.record_type !== "payment") throw new DomainError("SETTLEMENT_NOT_INCOME", 409);

        const decision = JSON.stringify(input);
        if (p.decision) {
          if (p.decision !== decision) throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
          return { entryId: p.entry_id, replayed: true };
        }

        if (!["link", "sale", "receipt", "collection"].includes(input.category)) {
          throw new DomainError("IMPORT_RECORD_TYPE");
        }

        let entryId;
        if (input.category === "link") {
          const eRes = await client.query(`
            SELECT * FROM zuno.entries
            WHERE id = $1 AND merchant = $2 AND method = 'upi' AND kind IN ('sale', 'receipt', 'collection')
              AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids WHERE entry_id = entries.id)
          `, [input.entryId, m]);
          if (!eRes.rows.length || Number(eRes.rows[0].amount) !== Number(p.amount) || eRes.rows[0].date !== p.date) {
            throw new DomainError("IMPORT_LINK_MISMATCH", 409);
          }
          const alreadyRes = await client.query(
            "SELECT 1 FROM zuno.imported_payments WHERE merchant = $1 AND entry_id = $2",
            [m, eRes.rows[0].id],
          );
          if (alreadyRes.rows.length) throw new DomainError("IMPORT_ALREADY_LINKED", 409);
          entryId = eRes.rows[0].id;
        } else {
          if (input.receivedConfirmed !== true) throw new DomainError("IMPORT_RECEIPT_CONFIRMATION", 409);

          const possibleRes = await client.query(`
            SELECT id FROM zuno.entries
            WHERE merchant = $1 AND date = $2 AND amount = $3 AND method = 'upi' AND kind IN ('sale', 'receipt', 'collection')
              AND NOT EXISTS (SELECT 1 FROM zuno.entry_voids WHERE entry_id = entries.id)
          `, [m, p.date, Number(p.amount)]);
          if (possibleRes.rows.length && input.separateConfirmed !== true) {
            throw new DomainError("IMPORT_POSSIBLE_DUPLICATE", 409);
          }

          if (input.category === "collection") {
            const dueRes = await client.query(
              "SELECT date FROM zuno.entries WHERE id = $1 AND merchant = $2 AND kind = 'udhaar'",
              [input.dueId, m],
            );
            if (!dueRes.rows.length || dueRes.rows[0].date > p.date) {
              throw new DomainError("DUE_NOT_FOUND", 409);
            }
          }

          const entry = await this.addEntry(
            m,
            {
              kind: input.category,
              name: p.name,
              amount: Number(p.amount),
              method: "upi",
              dueId: input.dueId,
              requestKey: p.id,
              note: `Paytm report: ${p.reference}`,
            },
            { date: p.date, source: "report_unverified" },
          );
          entryId = entry.id;
        }

        await client.query(
          "UPDATE zuno.imported_payments SET entry_id = $1, decision = $2 WHERE id = $3 AND merchant = $4",
          [entryId, decision, id, m],
        );
        await log(client, m, "payment_report_classified", {
          payment: id,
          entry: entryId,
          category: input.category,
        });
        return { entryId };
      });
    },

    // --- VOICE LEDGER & ASSISTANT ---
    async question(m, draft, language) {
      if (!draft.kind) {
        return [
          "kind",
          choose(language, [
            "Is this a received sale, paid expense, unpaid sale, or collection of existing dues?",
            "यह प्राप्त बिक्री, खर्च, उधार बिक्री या पुराने उधार की वसूली है?",
            "Ye received sale, kharch, udhaar bikri ya purane udhaar ki collection hai?",
          ]),
        ];
      }
      if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > 100000000) {
        return [
          "amount",
          choose(language, [
            "What is the total amount in rupees?",
            "कुल कितने रुपये?",
            "Total kitne rupaye?",
          ]),
        ];
      }
      if (!draft.name?.trim()) {
        return [
          "name",
          choose(language, [
            "Whose name should I record?",
            "किसके नाम लिखूँ?",
            "Kiske naam likhun?",
          ]),
        ];
      }

      const custRes = await q("SELECT id, name FROM zuno.customers WHERE merchant = $1", [m]);
      const customers = custRes.rows.filter((c) => normalizeText(c.name) === normalizeText(draft.name));

      if (draft.kind === "udhaar") {
        if (customers.length > 1) {
          return [
            "manual",
            choose(language, [
              "Several customer accounts have this name. Use the review form to choose the right account.",
              "इस नाम के कई खाते हैं। सही ग्राहक चुनने के लिए फॉर्म खोलें।",
              "Is naam ke kai accounts hain. Sahi customer chunne ke liye form kholein.",
            ]),
          ];
        }
        if (customers.length === 1) {
          draft.customerId = customers[0].id;
          draft.name = customers[0].name;
        }
      }

      if (draft.kind === "collection") {
        const matches = (await this.dues(m)).filter((d) => normalizeText(d.name) === normalizeText(draft.name));
        if (matches.length !== 1) {
          return [
            "manual",
            choose(language, [
              "I cannot safely choose a single outstanding entry. Use the review form to choose the due.",
              "एक सही बकाया नहीं चुन पाया। फॉर्म में बकाया चुनें।",
              "Ek sahi due nahi chun paya. Form mein due chunein.",
            ]),
          ];
        }
        if (draft.amount > matches[0].outstanding) {
          return [
            "amount",
            choose(language, [
              `Only ${amountText(matches[0].outstanding)} remains. What amount was received?`,
              `केवल ${amountText(matches[0].outstanding)} बाकी है। कितनी राशि मिली?`,
              `Sirf ${amountText(matches[0].outstanding)} baaki hai. Kitna mila?`,
            ]),
          ];
        }
        draft.remainingBefore = matches[0].outstanding;
        draft.dueId = matches[0].id;
        draft.name = matches[0].name;
      }

      if (draft.kind === "udhaar" && !draft.promiseCaptured) {
        return [
          "promise",
          choose(language, [
            "When will they repay the dues? Is a date agreed?",
            "उधार कब लौटाएँगे? कोई तारीख तय है?",
            "Udhaar kab lautayenge? Koi date tay hai?",
          ]),
        ];
      }

      if (draft.kind !== "udhaar" && !draft.method) {
        return [
          "method",
          choose(language, [
            "Was the money actually received or paid in cash or UPI? Say Cash or UPI only if completed. Otherwise cancel.",
            "पैसा वास्तव में नकद या UPI से मिला या दिया? पूरा हो चुका है तो नकद या UPI कहें, वरना रद्द करें।",
            "Paisa actually cash ya UPI se mila ya diya? Complete hua ho toh Cash ya UPI bolein, warna cancel karein.",
          ]),
        ];
      }

      const summary = `${draft.name} · ${amountText(draft.amount)} · ${choose(language, kinds[draft.kind])}${draft.kind === "udhaar" ? (draft.dueDate ? ` · ${draft.dueDate}` : choose(language, [" · no promised date", " · तारीख तय नहीं", " · date tay nahi"])) : ` · ${draft.method.toUpperCase()}`}`;
      return [
        "confirm",
        choose(language, [
          `${summary}. Say “confirm save” to record, or “cancel”. Nothing is saved yet.`,
          `${summary}। दर्ज करने के लिए “हाँ सेव करो” या “रद्द करो” कहें। अभी सेव नहीं हुआ है।`,
          `${summary}. Record karne ke liye “haan save karo” ya “cancel” bolein. Abhi save nahi hua.`,
        ]),
      ];
    },

    async currentVoiceLedger(m) {
      const res = await q(
        "SELECT * FROM zuno.voice_drafts WHERE merchant = $1 AND expires > $2 ORDER BY expires DESC LIMIT 1",
        [m, Date.now()],
      );
      if (!res.rows.length) return { active: false };
      const row = res.rows[0];
      const draft = JSON.parse(row.payload);
      const [stage, answer] = await this.question(m, draft, draft.language || "hinglish");
      return {
        active: true,
        type: "voice-ledger",
        draftId: row.id,
        version: row.version,
        stage: row.stage,
        draft,
        answer,
        engine: "local",
      };
    },

    async voiceLedgerTurn(m, input) {
      const signature = JSON.stringify(input);
      const prevRes = await q(
        "SELECT * FROM zuno.voice_turns WHERE merchant = $1 AND request_key = $2",
        [m, input.requestKey],
      );
      if (prevRes.rows.length) {
        if (prevRes.rows[0].input !== signature) {
          throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
        }
        return JSON.parse(prevRes.rows[0].result);
      }

      let row = null;
      if (input.draftId) {
        const rowRes = await q(
          "SELECT * FROM zuno.voice_drafts WHERE id = $1 AND merchant = $2",
          [input.draftId, m],
        );
        if (!rowRes.rows.length) throw new DomainError("ACTION_NOT_FOUND", 404);
        row = rowRes.rows[0];
        if (row.version !== input.version || Number(row.expires) < Date.now()) {
          throw new DomainError("VOICE_DRAFT_CHANGED", 409);
        }
      }

      const command = input.text.replace(
        /^\s*(?:hey\s+zuno|hi\s+zuno|हे\s*ज़?ूनो|हे\s*जूनो)[,\s:।-]*/iu,
        "",
      );
      const promise = extractPromise(command);
      const wantsFollowUp =
        !!input.followUpDueId ||
        (/remind|follow[ -]?up|रिमाइंडर|याद दिला/i.test(command) &&
          !/likh|लिख|record.*transaction|दर्ज/i.test(command));

      const parsed =
        !row && !wantsFollowUp && !cancelWord(input.text)
          ? await understand(promise.date ? promise.text : command)
          : null;

      return withTransaction(pool, async (client) => {
        const replayRes = await client.query(
          "SELECT * FROM zuno.voice_turns WHERE merchant = $1 AND request_key = $2",
          [m, input.requestKey],
        );
        if (replayRes.rows.length) {
          if (replayRes.rows[0].input !== signature) {
            throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
          }
          return JSON.parse(replayRes.rows[0].result);
        }

        if (row) {
          const fresh = await client.query(
            "SELECT * FROM zuno.voice_drafts WHERE id = $1 AND merchant = $2 FOR UPDATE",
            [input.draftId, m],
          );
          row = fresh.rows[0];
          if (!row || row.version !== input.version || Number(row.expires) < Date.now()) {
            throw new DomainError("VOICE_DRAFT_CHANGED", 409);
          }
        } else {
          row = {
            id: randomUUID(),
            merchant: m,
            version: 0,
            payload: "{}",
            stage: "new",
            expires: Date.now() + 1800000,
          };
        }

        if (["saved", "cancelled"].includes(row.stage)) {
          throw new DomainError("VOICE_DRAFT_CLOSED", 409);
        }

        let draft = JSON.parse(row.payload);
        let answer;

        if (cancelWord(input.text)) {
          row.stage = "cancelled";
          answer = choose(input.language, [
            "Cancelled. No entry was saved.",
            "रद्द किया। कोई एंट्री सेव नहीं हुई।",
            "Cancel kiya. Koi entry save nahi hui.",
          ]);
        } else {
          if (parsed && row.stage === "new") {
            if (parsed.topic === "entry" && parsed.entry) {
              draft = { ...draft, ...parsed.entry, language: input.language };
              if (promise.date && draft.kind === "udhaar") {
                draft.dueDate = promise.date;
                draft.promiseCaptured = true;
              }
            }
          }

          if (row.stage === "confirm" && confirmWord(input.text)) {
            // Save entry directly into authoritative database
            const savedEntry = await this.addEntry(
              m,
              {
                kind: draft.kind,
                amount: draft.amount,
                name: draft.name,
                method: draft.method || "cash",
                note: draft.note || "",
                dueId: draft.dueId,
                dueDate: draft.dueDate,
                customerId: draft.customerId,
                requestKey: randomUUID(),
              },
              { source: "voice" },
            );

            row.stage = "saved";
            draft.savedEntryId = savedEntry.id;
            answer = choose(input.language, [
              `Saved ${draft.name} · ${amountText(draft.amount)}. Tap mic for next entry.`,
              `${draft.name} · ${amountText(draft.amount)} दर्ज कर लिया गया। अगली एंट्री के लिए माइक दबाएँ।`,
              `${draft.name} · ${amountText(draft.amount)} save ho gaya. Agli entry ke liye mic tap karein.`,
            ]);
          } else {
            // Re-evaluate next question
            const [nextStage, nextPrompt] = await this.question(m, draft, input.language);
            row.stage = nextStage;
            answer = nextPrompt;
          }
        }

        row.version += 1;
        row.payload = JSON.stringify(draft);
        row.expires = Date.now() + 1800000;

        await client.query(`
          INSERT INTO zuno.voice_drafts (id, merchant, version, payload, stage, expires)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE
          SET version = EXCLUDED.version, payload = EXCLUDED.payload, stage = EXCLUDED.stage, expires = EXCLUDED.expires
        `, [row.id, row.merchant, row.version, row.payload, row.stage, row.expires]);

        const resObj = {
          type: "voice-ledger",
          draftId: row.id,
          version: row.version,
          stage: row.stage,
          draft,
          answer,
          engine: "local",
        };

        await client.query(
          "INSERT INTO zuno.voice_turns (merchant, request_key, input, result) VALUES ($1, $2, $3, $4)",
          [m, input.requestKey, signature, JSON.stringify(resObj)],
        );

        return resObj;
      });
    },

    async getAudioRequest(m, requestKey) {
      const res = await q(
        "SELECT * FROM zuno.voice_audio_requests WHERE merchant = $1 AND request_key = $2",
        [m, requestKey],
      );
      return res.rows[0] || null;
    },

    async saveAudioRequest(m, requestKey, inputHash, result) {
      await q(`
        INSERT INTO zuno.voice_audio_requests (merchant, request_key, input_hash, result)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (merchant, request_key) DO NOTHING
      `, [m, requestKey, inputHash, JSON.stringify(result)]);
    },

    async assistantAnswer(m, text, language, previousTopic, scenario = "expected") {
      const parsed = await understand(text, previousTopic);
      const data = await this.snapshot(m, scenario);
      const gap = data.forecast?.firstGap || null;
      const shortage = gap ? -gap.balance : 0;
      const fmt = (v) => Math.round(v / 100).toLocaleString("en-IN");
      let answer;

      switch (parsed.topic) {
        case "cash":
          answer = choose(language, [
            `Your current cash in hand and in bank is ${fmt(data.cash)} rupees. Customer dues are recorded separately.`,
            `वर्तमान उपलब्ध राशि ${fmt(data.cash)} रुपये है। ग्राहकों का बकाया अलग रखा गया है।`,
            `Current cash ${fmt(data.cash)} rupaye hai. Udhaar alag se track hota hai.`,
          ]);
          break;
        case "dues":
          answer = choose(language, [
            `Pending customer dues total ${fmt(data.pending)} rupees. They are excluded from available cash until collected.`,
            `ग्राहकों का बकाया ${fmt(data.pending)} रुपये है। वसूली दर्ज होने तक यह उपलब्ध राशि नहीं है।`,
            `Pending udhaar ${fmt(data.pending)} rupaye hai. Collection ke baad hi ye available cash hoga.`,
          ]);
          break;
        case "sales":
          answer = choose(language, [
            `Recorded sales today are ${fmt(data.salesToday)} rupees, including unpaid sales. Sales are different from cash received.`,
            `आज दर्ज बिक्री ${fmt(data.salesToday)} रुपये है, जिसमें उधार बिक्री शामिल है। बिक्री और प्राप्त राशि अलग हैं।`,
            `Aaj recorded bikri ${fmt(data.salesToday)} rupaye hai, udhaar mila kar. Bikri aur received cash alag hain.`,
          ]);
          break;
        case "why":
          answer = gap
            ? choose(language, [
                `The first projected shortage is ${fmt(shortage)} rupees on ${gap.date}. This is an editable cash plan, not a guaranteed prediction.`,
                `पहली अनुमानित कमी ${gap.date} को ${fmt(shortage)} रुपये है। यह बदल सकने वाली योजना है, गारंटी नहीं।`,
                `Pehli projected kami ${gap.date} ko ${fmt(shortage)} rupaye hai. Ye editable plan hai, guarantee nahi.`,
              ])
            : choose(language, [
                "No shortage is projected in the next 14 days with your current planning inputs.",
                "वर्तमान योजना के अनुसार अगले 14 दिन में कमी नहीं है।",
                "Current planning ke hisaab se 14 din mein kami nahi hai.",
              ]);
          break;
        default:
          answer = choose(language, [
            "I can record entries, explain cash and sales, review dues and help you plan payments. Ask “Why is my cash short?” or “Record a 500 rupee sale”.",
            "मैं एंट्री दर्ज करने, बिक्री, बकाया और नकदी योजना में मदद कर सकता हूँ। पूछें “राशि कम क्यों पड़ेगी?” या “500 रुपये की बिक्री लिखो”।",
            "Main entries, cash, bikri, dues aur payment planning mein help kar sakta hoon. Poochein “cash kam kyun padega?” ya “500 rupaye ki bikri likho”.",
          ]);
      }

      return {
        answer,
        type: parsed.topic,
        engine: parsed.model ? "sarvam" : "local",
        evidence: {
          cash: data.cash,
          pending: data.pending,
          salesToday: data.salesToday,
          gap,
        },
      };
    },

    async listProducts(m) {
      const res = await q("SELECT * FROM zuno.products WHERE merchant = $1 AND active = 1 ORDER BY name ASC", [m]);
      if (res.rows.length === 0) {
        const now = new Date().toISOString();
        for (const item of DEFAULT_KIRANA_PRODUCTS) {
          const id = randomUUID();
          await q(
            "INSERT INTO zuno.products (id, merchant, name, unit, price, stock, active, created) VALUES ($1, $2, $3, $4, $5, $6, 1, $7)",
            [id, m, item.name, item.unit, item.price, item.stock, now],
          );
        }
        const seeded = await q("SELECT * FROM zuno.products WHERE merchant = $1 AND active = 1 ORDER BY name ASC", [m]);
        return seeded.rows.map((p) => ({ ...p, price: Number(p.price) }));
      }
      return res.rows.map((p) => ({ ...p, price: Number(p.price) }));
    },

    async addProduct(m, { name, unit = "packet", price = 0, stock = 0 }) {
      if (!name || !name.trim()) throw new DomainError("PRODUCT_NAME_REQUIRED", 400);
      const cleanPrice = Math.round(Number(price));
      if (isNaN(cleanPrice) || cleanPrice < 0) throw new DomainError("INVALID_PRODUCT_PRICE", 400);

      const id = randomUUID();
      const now = new Date().toISOString();
      await q(
        "INSERT INTO zuno.products (id, merchant, name, unit, price, stock, active, created) VALUES ($1, $2, $3, $4, $5, $6, 1, $7)",
        [id, m, name.trim(), (unit || "packet").trim().toLowerCase(), cleanPrice, Number(stock) || 0, now],
      );
      const res = await q("SELECT * FROM zuno.products WHERE id = $1 AND merchant = $2", [id, m]);
      return { ...res.rows[0], price: Number(res.rows[0].price) };
    },

    async updateProduct(m, id, { name, unit, price, stock, active }) {
      const currentRes = await q("SELECT * FROM zuno.products WHERE id = $1 AND merchant = $2", [id, m]);
      if (!currentRes.rows.length) throw new DomainError("PRODUCT_NOT_FOUND", 404);
      const current = currentRes.rows[0];

      const newName = name !== undefined ? name.trim() : current.name;
      const newPrice = price !== undefined ? Math.round(Number(price)) : Number(current.price);
      const newStock = stock !== undefined ? Number(stock) : Number(current.stock);
      const newUnit = unit !== undefined ? unit.trim().toLowerCase() : current.unit;
      const newActive = active !== undefined ? (active ? 1 : 0) : Number(current.active);

      await q(
        "UPDATE zuno.products SET name = $1, unit = $2, price = $3, stock = $4, active = $5 WHERE id = $6 AND merchant = $7",
        [newName, newUnit, newPrice, newStock, newActive, id, m],
      );
      const res = await q("SELECT * FROM zuno.products WHERE id = $1 AND merchant = $2", [id, m]);
      return { ...res.rows[0], price: Number(res.rows[0].price) };
    },

    async deleteProduct(m, id) {
      const res = await q("UPDATE zuno.products SET active = 0 WHERE id = $1 AND merchant = $2", [id, m]);
      if (res.rowCount === 0) throw new DomainError("PRODUCT_NOT_FOUND", 404);
      return { ok: true, id };
    },

    parseOrderText(text, catalog) {
      return parseOrderText(text, catalog);
    },

    // --- ORDERS & BILLING ---
    async createOrder(m, { customerId = null, customerName = "Counter Customer", items = [], source = "manual", requestKey = randomUUID() }) {
      if (!items || items.length === 0) throw new DomainError("EMPTY_ORDER_ITEMS", 400);

      return withTransaction(pool, async (client) => {
        const existRes = await client.query(
          "SELECT * FROM zuno.orders WHERE merchant = $1 AND request_key = $2",
          [m, requestKey],
        );
        if (existRes.rows.length) {
          const itemsRes = await client.query("SELECT * FROM zuno.order_items WHERE order_id = $1", [existRes.rows[0].id]);
          return { order: existRes.rows[0], items: itemsRes.rows };
        }

        let totalAmount = 0;
        for (const it of items) {
          totalAmount += Math.round(Number(it.quantity) * Number(it.unitPrice));
        }

        const orderId = randomUUID();
        const now = new Date().toISOString();

        await client.query(
          `INSERT INTO zuno.orders (id, merchant, customer_id, customer_name, total_amount, status, rejection_reason, bill_number, entry_id, source, payment_status, request_key, created)
           VALUES ($1, $2, $3, $4, $5, 'draft', null, null, null, $6, 'pending', $7, $8)`,
          [orderId, m, customerId || null, (customerName || "Counter Customer").trim(), totalAmount, source, requestKey, now],
        );

        const savedItems = [];
        for (const it of items) {
          const itemId = randomUUID();
          const unitPrice = Math.round(Number(it.unitPrice) || 0);
          const quantity = Number(it.quantity) || 1;
          const lineTotal = Math.round(quantity * unitPrice);

          await client.query(
            `INSERT INTO zuno.order_items (id, order_id, product_id, item_name, quantity, unit, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [itemId, orderId, it.productId || null, (it.name || "Item").trim(), quantity, (it.unit || "packet").trim(), unitPrice, lineTotal],
          );
          savedItems.push({
            id: itemId,
            orderId,
            productId: it.productId || null,
            name: it.name,
            quantity,
            unit: it.unit || "packet",
            unitPrice,
            totalPrice: lineTotal,
          });
        }

        const orderRes = await client.query("SELECT * FROM zuno.orders WHERE id = $1", [orderId]);
        return { order: { ...orderRes.rows[0], total_amount: Number(orderRes.rows[0].total_amount) }, items: savedItems };
      });
    },

    async acceptOrder(m, orderId) {
      return withTransaction(pool, async (client) => {
        const orderRes = await client.query(
          "SELECT * FROM zuno.orders WHERE id = $1 AND merchant = $2 FOR UPDATE",
          [orderId, m],
        );
        if (!orderRes.rows.length) throw new DomainError("ORDER_NOT_FOUND", 404);
        const order = orderRes.rows[0];
        if (order.status === "rejected") throw new DomainError("CANNOT_ACCEPT_REJECTED_ORDER", 400);

        if (order.bill_number) {
          const itemsRes = await client.query("SELECT * FROM zuno.order_items WHERE order_id = $1", [orderId]);
          return { order, items: itemsRes.rows };
        }

        const datePrefix = day().replace(/-/g, "");
        const randomHex = randomBytes(2).toString("hex").toUpperCase();
        const billNumber = `BILL-${datePrefix}-${randomHex}`;

        await client.query(
          "UPDATE zuno.orders SET status = 'accepted', bill_number = $1 WHERE id = $2 AND merchant = $3",
          [billNumber, orderId, m],
        );

        // Decrement stock for catalog items
        const itemsRes = await client.query("SELECT * FROM zuno.order_items WHERE order_id = $1", [orderId]);
        for (const it of itemsRes.rows) {
          if (it.product_id) {
            await client.query(
              "UPDATE zuno.products SET stock = GREATEST(0, stock - $1) WHERE id = $2 AND merchant = $3",
              [it.quantity, it.product_id, m],
            );
          }
        }

        await log(client, m, "bill_generated", { orderId, billNumber, totalAmount: Number(order.total_amount) });
        const updated = await client.query("SELECT * FROM zuno.orders WHERE id = $1", [orderId]);
        return { order: { ...updated.rows[0], total_amount: Number(updated.rows[0].total_amount) }, items: itemsRes.rows };
      });
    },

    async rejectOrder(m, orderId, { reason = "Merchant rejected" } = {}) {
      return withTransaction(pool, async (client) => {
        const orderRes = await client.query(
          "SELECT * FROM zuno.orders WHERE id = $1 AND merchant = $2 FOR UPDATE",
          [orderId, m],
        );
        if (!orderRes.rows.length) throw new DomainError("ORDER_NOT_FOUND", 404);
        const order = orderRes.rows[0];
        if (order.status === "completed") throw new DomainError("CANNOT_REJECT_COMPLETED_ORDER", 400);

        await client.query(
          "UPDATE zuno.orders SET status = 'rejected', rejection_reason = $1 WHERE id = $2 AND merchant = $3",
          [reason || "Merchant rejected", orderId, m],
        );

        await log(client, m, "order_rejected", { orderId, reason, totalAmount: Number(order.total_amount) });
        const updated = await client.query("SELECT * FROM zuno.orders WHERE id = $1", [orderId]);
        return { ...updated.rows[0], total_amount: Number(updated.rows[0].total_amount) };
      });
    },

    async completeOrderPayment(m, orderId, { paymentStatus, paymentMethod = "cash", promiseDate = null, customerId = null, customerName = null, requestKey = randomUUID() }) {
      return withTransaction(pool, async (client) => {
        const orderRes = await client.query(
          "SELECT * FROM zuno.orders WHERE id = $1 AND merchant = $2 FOR UPDATE",
          [orderId, m],
        );
        if (!orderRes.rows.length) throw new DomainError("ORDER_NOT_FOUND", 404);
        const order = orderRes.rows[0];
        if (order.status === "completed") return { order, alreadyCompleted: true };
        if (order.status !== "accepted") throw new DomainError("ORDER_MUST_BE_ACCEPTED_FIRST", 400);

        const cName = (customerName || order.customer_name || "Counter Customer").trim();
        const billNum = order.bill_number || `ORDER-${order.id.slice(0, 8)}`;
        let entryId = null;

        if (paymentStatus === "paid") {
          const entry = await this.addEntry(m, {
            kind: "sale",
            amount: Number(order.total_amount),
            name: cName,
            method: paymentMethod === "upi" ? "upi" : "cash",
            note: `Bill #${billNum}`,
            requestKey: `order-pay-${order.id}-${requestKey}`,
          }, { source: "order" });
          entryId = entry.id;

          await client.query(
            "UPDATE zuno.orders SET status = 'completed', payment_status = 'paid', entry_id = $1 WHERE id = $2 AND merchant = $3",
            [entryId, orderId, m],
          );
        } else if (paymentStatus === "unpaid") {
          if (!cName || cName.toLowerCase() === "counter customer") {
            throw new DomainError("CUSTOMER_NAME_REQUIRED_FOR_UDHAAR", 400);
          }
          const entry = await this.addEntry(m, {
            kind: "udhaar",
            amount: Number(order.total_amount),
            name: cName,
            method: "cash",
            note: `Bill #${billNum}`,
            dueDate: promiseDate || null,
            customerId: customerId || null,
            requestKey: `order-udhaar-${order.id}-${requestKey}`,
          }, { source: "order" });
          entryId = entry.id;

          await client.query(
            "UPDATE zuno.orders SET status = 'completed', payment_status = 'unpaid', entry_id = $1, customer_name = $2 WHERE id = $3 AND merchant = $4",
            [entryId, cName, orderId, m],
          );
        } else {
          throw new DomainError("INVALID_PAYMENT_STATUS", 400);
        }

        const completedRes = await client.query("SELECT * FROM zuno.orders WHERE id = $1", [orderId]);
        const itemsRes = await client.query("SELECT * FROM zuno.order_items WHERE order_id = $1", [orderId]);
        return { order: completedRes.rows[0], items: itemsRes.rows, entryId };
      });
    },

    async listOrders(m, limit = 50) {
      const res = await q(`
        SELECT o.*,
          (SELECT json_agg(json_build_object(
            'id', i.id, 'productId', i.product_id, 'name', i.item_name,
            'quantity', i.quantity, 'unit', i.unit, 'unitPrice', i.unit_price, 'totalPrice', i.total_price
          )) FROM zuno.order_items i WHERE i.order_id = o.id) AS items_json
        FROM zuno.orders o WHERE o.merchant = $1 ORDER BY o.created DESC LIMIT $2
      `, [m, limit]);
      return res.rows.map((r) => ({
        ...r,
        total_amount: Number(r.total_amount),
        items: r.items_json || [],
      }));
    },

    // --- ARCHIVE & BACKUP ---
    async exportArchive(m) {
      const state = await this.snapshot(m, "expected", true);
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
        const idCol = table === "merchants" ? "id" : "merchant";
        const res = await q(`SELECT * FROM zuno.${table} WHERE ${idCol} = $1`, [m]);
        tables[table] = res.rows;
      }

      for (const table of ["entry_schedule", "entry_customers"]) {
        const res = await q(`SELECT * FROM zuno.${table} WHERE entry_id IN (SELECT id FROM zuno.entries WHERE merchant = $1)`, [m]);
        tables[table] = res.rows;
      }

      const oiRes = await q("SELECT * FROM zuno.order_items WHERE order_id IN (SELECT id FROM zuno.orders WHERE merchant = $1)", [m]);
      tables.order_items = oiRes.rows;

      return {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        mode: "synthetic-demo",
        ...state,
        tables,
      };
    },
  };
}
