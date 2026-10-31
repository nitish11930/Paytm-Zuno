import dotenv from "dotenv";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.js";
import { createPostgresPool, createPostgresRepository } from "./postgres.js";
import { database } from "./domain.js";
import { createSqliteRepository } from "./sqlite-adapter.js";
import { initializeVoiceLedger } from "./voice-ledger.js";

dotenv.config({ path: "privacy/sarvam.env", quiet: true });
dotenv.config({ path: "privacy/supabase.env", quiet: true });
dotenv.config({ quiet: true });

if (
  process.env.HOST === "0.0.0.0" &&
  process.env.NODE_ENV === "production" &&
  (!process.env.TEST_ACCESS_CODE || process.env.TEST_ACCESS_CODE.length < 12)
)
  throw new Error(
    "Public test hosting requires a private TEST_ACCESS_CODE (12+ characters).",
  );

let repo;
const usePostgres =
  process.env.DB_PROVIDER === "postgres" ||
  (!process.env.DB_PROVIDER && !!process.env.SUPABASE_DB_URL);

if (usePostgres) {
  try {
    const pool = createPostgresPool();
    repo = createPostgresRepository(pool);
    console.log(
      "Database provider: Supabase PostgreSQL (schema: zuno, verified TLS)",
    );
  } catch (err) {
    if (process.env.DB_PROVIDER === "postgres") {
      console.error(
        "FATAL: Configured Supabase database unavailable:",
        err.message,
      );
      process.exit(1);
    }
    console.warn("Supabase unavailable, falling back to SQLite:", err.message);
    const db = database();
    initializeVoiceLedger(db);
    repo = createSqliteRepository(db);
  }
} else {
  const db = database();
  initializeVoiceLedger(db);
  repo = createSqliteRepository(db);
  console.log("Database provider: SQLite local fallback");
}

const app = createApp(repo);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_q, r) => r.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const port = Number(process.env.PORT || 5187);
app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Zuno ready: http://127.0.0.1:${port} · provider: ${repo.provider}`),
);
