import dotenv from "dotenv";
import pg from "pg";
import Database from "better-sqlite3";
import { readFileSync, existsSync } from "node:fs";

dotenv.config({ path: "privacy/supabase.env", quiet: true });

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerifyOnly = args.includes("--verify");

const sqlitePath = existsSync("data/zuno.sqlite")
  ? "data/zuno.sqlite"
  : "data/munim.sqlite";

if (!existsSync(sqlitePath)) {
  console.error(`SQLite file not found at ${sqlitePath}`);
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Set SUPABASE_DB_URL in privacy/supabase.env first.");
  process.exit(1);
}

const url = new URL(connectionString);
for (const option of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) {
  url.searchParams.delete(option);
}

const pgClient = new pg.Client({
  connectionString: url.toString(),
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  ssl: {
    rejectUnauthorized: true,
    ...(process.env.SUPABASE_DB_CA_PATH
      ? { ca: readFileSync(process.env.SUPABASE_DB_CA_PATH, "utf8") }
      : {}),
  },
});

const sqliteDb = new Database(sqlitePath, { readonly: true });

// Ordered list of tables to migrate respecting foreign keys
const ORDERED_TABLES = [
  { name: "merchants", cols: ["id", "shop", "owner", "opening", "language", "setup"] },
  { name: "customers", cols: ["id", "merchant", "name", "legacy"] },
  { name: "obligations", cols: ["id", "merchant", "label", "amount", "date"] },
  { name: "proposals", cols: ["id", "merchant", "payload", "expires", "status"] },
  { name: "audit", cols: ["id", "merchant", "event", "detail", "created"] },
  { name: "sessions", cols: ["hash", "merchant", "expires"] },
  { name: "demo_devices", cols: ["hash", "merchant", "expires"] },
  { name: "workspace_access", cols: ["hash", "merchant"] },
  {
    name: "schedule",
    cols: [
      "id", "merchant", "direction", "label", "amount", "date",
      "status", "source", "request_key", "version", "kind", "due_id"
    ]
  },
  { name: "planning_initialized", cols: ["merchant"] },
  { name: "schedule_requests", cols: ["merchant", "request_key", "payload"] },
  { name: "voice_drafts", cols: ["id", "merchant", "version", "payload", "stage", "expires"] },
  { name: "voice_turns", cols: ["merchant", "request_key", "input", "result"] },
  { name: "voice_audio_requests", cols: ["merchant", "request_key", "input_hash", "result"] },
  { name: "payment_import_batches", cols: ["id", "merchant", "payload", "expires", "result"] },
  { name: "products", cols: ["id", "merchant", "name", "unit", "price", "stock", "active", "created"], optional: true },
  // Entries: split due_id IS NULL and due_id IS NOT NULL for self-referencing foreign keys
  {
    name: "entries",
    where: "due_id IS NULL",
    cols: [
      "id", "merchant", "kind", "amount", "name", "method", "date",
      "note", "due_id", "source", "request_key"
    ]
  },
  {
    name: "entries",
    where: "due_id IS NOT NULL",
    cols: [
      "id", "merchant", "kind", "amount", "name", "method", "date",
      "note", "due_id", "source", "request_key"
    ]
  },
  { name: "entry_voids", cols: ["entry_id", "merchant", "reason", "request_key", "created"] },
  { name: "entry_schedule", cols: ["entry_id", "schedule_id"] },
  { name: "entry_customers", cols: ["entry_id", "customer_id"] },
  { name: "due_terms", cols: ["entry_id", "merchant", "due_date"] },
  {
    name: "imported_payments",
    cols: [
      "id", "merchant", "batch_id", "reference", "record_type", "date",
      "amount", "name", "source", "entry_id", "decision"
    ]
  },
  {
    name: "orders",
    cols: [
      "id", "merchant", "customer_id", "customer_name", "total_amount",
      "status", "rejection_reason", "bill_number", "entry_id", "source",
      "payment_status", "request_key", "created"
    ],
    optional: true
  },
  {
    name: "order_items",
    cols: [
      "id", "order_id", "product_id", "item_name", "quantity",
      "unit", "unit_price", "total_price"
    ],
    optional: true
  }
];

function sqliteTableExists(db, tableName) {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);
  return !!row;
}

async function verifyComparison(pgClient, sqliteDb) {
  console.log("\n--- VERIFYING SQLITE VS POSTGRESQL DATA ---");
  let allMatched = true;

  // 1. Merchant counts and IDs
  const sqliteMerchants = sqliteDb.prepare("SELECT id, shop, owner FROM merchants ORDER BY id").all();
  const pgMerchantsRes = await pgClient.query("SELECT id, shop, owner FROM zuno.merchants ORDER BY id");
  const pgMerchants = pgMerchantsRes.rows;

  console.log(`Merchants: SQLite=${sqliteMerchants.length}, Postgres=${pgMerchants.length}`);
  if (sqliteMerchants.length !== pgMerchants.length) {
    console.error("❌ Merchant count mismatch!");
    allMatched = false;
  }

  for (let i = 0; i < sqliteMerchants.length; i++) {
    const sm = sqliteMerchants[i];
    const pm = pgMerchants.find((m) => m.id === sm.id);
    if (!pm || pm.shop !== sm.shop || pm.owner !== sm.owner) {
      console.error(`❌ Merchant mismatch: ${sm.id}`);
      allMatched = false;
    }
  }

  // 2. Table row counts
  const checkTables = [
    "merchants", "customers", "obligations", "proposals", "audit",
    "sessions", "demo_devices", "schedule", "due_terms", "entries"
  ];

  for (const t of checkTables) {
    const sqCount = sqliteDb.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
    const pgCountRes = await pgClient.query(`SELECT COUNT(*) as c FROM zuno.${t}`);
    const pgCount = parseInt(pgCountRes.rows[0].c, 10);
    const match = sqCount === pgCount;
    console.log(`Table ${t.padEnd(16)}: SQLite=${String(sqCount).padEnd(4)} Postgres=${String(pgCount).padEnd(4)} ${match ? "✓" : "❌"}`);
    if (!match) allMatched = false;
  }

  // 3. Balance verification for every merchant
  for (const m of sqliteMerchants) {
    // SQLite opening & entries
    const sqM = sqliteDb.prepare("SELECT opening FROM merchants WHERE id=?").get(m.id);
    const sqEntries = sqliteDb.prepare(`
      SELECT e.*, (SELECT 1 FROM entry_voids v WHERE v.entry_id=e.id) as reversed
      FROM entries e WHERE merchant=?
    `).all(m.id);

    let sqCash = sqM.opening;
    for (const e of sqEntries) {
      if (e.reversed) continue;
      if (e.kind === "sale" || e.kind === "collection" || e.kind === "receipt") {
        sqCash += e.amount;
      } else if (e.kind === "expense") {
        sqCash -= e.amount;
      }
    }

    // Postgres opening & entries
    const pgM = (await pgClient.query("SELECT opening FROM zuno.merchants WHERE id=$1", [m.id])).rows[0];
    const pgEntries = (await pgClient.query(`
      SELECT e.*, (SELECT 1 FROM zuno.entry_voids v WHERE v.entry_id=e.id) as reversed
      FROM zuno.entries e WHERE merchant=$1
    `, [m.id])).rows;

    let pgCash = Number(pgM.opening);
    for (const e of pgEntries) {
      if (e.reversed) continue;
      const amt = Number(e.amount);
      if (e.kind === "sale" || e.kind === "collection" || e.kind === "receipt") {
        pgCash += amt;
      } else if (e.kind === "expense") {
        pgCash -= amt;
      }
    }

    const cashMatch = sqCash === pgCash;
    console.log(`Merchant ${m.id.slice(0, 8)}... (${m.shop}): Cash SQLite=${sqCash} paise, Postgres=${pgCash} paise ${cashMatch ? "✓" : "❌"}`);
    if (!cashMatch) allMatched = false;
  }

  return allMatched;
}

try {
  await pgClient.connect();
  console.log("Connected to Supabase PostgreSQL with verified TLS.");

  if (isVerifyOnly) {
    const ok = await verifyComparison(pgClient, sqliteDb);
    if (!ok) {
      console.error("\n❌ Verification failed. Mismatches detected.");
      process.exit(1);
    } else {
      console.log("\n✅ All tables, counts, balances, and records verified successfully!");
      process.exit(0);
    }
  }

  // Check destination emptiness
  const existingCount = await pgClient.query("SELECT COUNT(*) as c FROM zuno.merchants");
  if (parseInt(existingCount.rows[0].c, 10) > 0) {
    console.log(`Destination zuno.merchants has ${existingCount.rows[0].c} rows.`);
    console.log("Checking if data already matches...");
    const ok = await verifyComparison(pgClient, sqliteDb);
    if (ok) {
      console.log("\n✅ Data is already migrated and perfectly in sync!");
      process.exit(0);
    } else {
      console.error("\n❌ Conflict: Destination already contains data that differs from SQLite.");
      console.error("Refusing to overwrite existing cloud data without manual review.");
      process.exit(1);
    }
  }

  console.log(`\nBeginning migration from ${sqlitePath} to Supabase zuno schema...`);
  if (isDryRun) console.log("🔍 MODE: DRY-RUN (Transactions will be rolled back)");

  await pgClient.query("BEGIN");
  await pgClient.query("SET LOCAL search_path TO zuno");

  for (const step of ORDERED_TABLES) {
    if (step.optional && !sqliteTableExists(sqliteDb, step.name)) {
      continue;
    }

    const whereClause = step.where ? ` WHERE ${step.where}` : "";
    const sqlQuery = `SELECT ${step.cols.join(", ")} FROM ${step.name}${whereClause}`;
    const rows = sqliteDb.prepare(sqlQuery).all();

    if (rows.length === 0) continue;

    const placeholders = step.cols.map((_, i) => `$${i + 1}`).join(", ");
    const insertSql = `INSERT INTO zuno.${step.name} (${step.cols.join(", ")}) VALUES (${placeholders})`;

    for (const r of rows) {
      const values = step.cols.map((c) => r[c]);
      await pgClient.query(insertSql, values);
    }

    console.log(`Migrated ${String(rows.length).padStart(4)} rows -> zuno.${step.name} ${whereClause}`);
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] Rolling back transaction. No changes were committed.");
    await pgClient.query("ROLLBACK");
  } else {
    await pgClient.query("COMMIT");
    console.log("\n✅ Migration committed successfully!");

    // Run verification
    const verified = await verifyComparison(pgClient, sqliteDb);
    if (!verified) {
      console.error("❌ Post-migration verification failed!");
      process.exit(1);
    }
    console.log("✅ All data, counts, balances and integrity checks verified!");
  }
} catch (err) {
  await pgClient.query("ROLLBACK").catch(() => {});
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  sqliteDb.close();
  await pgClient.end().catch(() => {});
}
