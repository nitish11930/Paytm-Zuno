import dotenv from "dotenv";
import pg from "pg";
import { readFileSync } from "node:fs";

dotenv.config({ path: "privacy/supabase.env", quiet: true });
const mode = process.argv[2] || "check";
if (!["check", "schema"].includes(mode)) {
  console.error("Use npm run supabase:check or npm run supabase:schema.");
  process.exit(1);
}
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error(
    "Set SUPABASE_DB_URL in privacy/supabase.env first. No database changes made.",
  );
  process.exit(1);
}
let client;
try {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("CONFIG");
  // SSL URL options can override pg's ssl object. Require our verified TLS settings.
  for (const option of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"])
    url.searchParams.delete(option);
  client = new pg.Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.SUPABASE_DB_CA_PATH
        ? { ca: readFileSync(process.env.SUPABASE_DB_CA_PATH, "utf8") }
        : {}),
    },
  });
  await client.connect();
  await client.query("SELECT 1");
  if (mode === "schema") {
    const exists = await client.query(
      "SELECT to_regnamespace('zuno') IS NOT NULL AS present",
    );
    if (exists.rows[0].present) {
      console.error(
        "zuno schema already exists. Inspect it before applying another migration. Nothing changed.",
      );
      process.exitCode = 1;
    } else {
      await client.query(
        readFileSync(
          new URL(
            "../supabase/migrations/202610310001_zuno_schema.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      console.log(
        "Private Zuno schema created. No local records uploaded. App still uses SQLite.",
      );
    }
  } else
    console.log(
      "Supabase Postgres connection OK (verified TLS). App still uses SQLite.",
    );
} catch {
  // Provider errors may include host/user/password or query data; never echo them.
  console.error(
    "Supabase connection/schema failed. Check the URI, password, network and database CA certificate. Credentials were not logged.",
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
