# Supabase setup — connection, schema, data migration & live persistence complete

Status:
- Connection: VERIFIED with TLS CA certificate (`privacy/supabase-ca.crt`).
- Schema: 21 tables created in private `zuno` schema on Supabase (including products, orders, order_items).
- Data migration: 100% verified equal between SQLite and Supabase PostgreSQL (`npm run supabase:verify`).
- Application persistence: Express backend uses `server/postgres.js` with `server/sqlite-adapter.js` fallback. All 64 integration and unit tests pass.

## Architecture & Credentials
1. Project: `https://supabase.com/dashboard/project/mewymxszzqhaooztctef` (zuno).
2. Credentials stored exclusively in ignored `privacy/supabase.env` (`SUPABASE_DB_URL`, `SUPABASE_DB_CA_PATH`). Never committed or leaked to client/browser.
3. Strict TLS certificate verification enabled (`rejectUnauthorized: true`).
4. Schema isolation: Private `zuno` schema with `REVOKE ALL ON SCHEMA zuno FROM PUBLIC, anon, authenticated;`. Browser clients communicate only via Express API endpoints with same-site HTTP-only cookies.
5. Concurrency safety: Row-level locks (`SELECT ... FOR UPDATE`) protect dues from over-collection during concurrent payments. Transactions checked out via `withTransaction(pool, fn)`.
6. Safe integer parsing: `pg.types.setTypeParser(INT8)` safely checks and parses 64-bit BigInt into JavaScript safe integers. Integer paise only.

## Commands
- `npm run supabase:check`: Verifies direct connection and TLS certificate to Supabase PostgreSQL.
- `npm run supabase:schema`: Applies idempotent schema migrations if not present.
- `npm run supabase:migrate`: Runs data migration from local SQLite to Supabase PostgreSQL inside a single transaction in foreign-key order. Supports `--dry-run`.
- `npm run supabase:verify`: Compares table counts, merchant IDs, cash balances, dues, and relations between SQLite and Supabase.
- `npm test`: Runs all 64 unit and live Supabase integration tests (`tests/*.test.js`).
- `npm run check`: Runs tests and Vite production build.

## Rollback Steps
If cloud database connection becomes unavailable:
1. SQLite local fallback is preserved in `data/zuno.sqlite` (and automatic backups in `data/backups/`).
2. To force SQLite provider explicitly, set `DB_PROVIDER=sqlite` in `.env`.
3. To switch back to Supabase PostgreSQL, set `DB_PROVIDER=postgres` (or ensure `SUPABASE_DB_URL` is set in `privacy/supabase.env`).
