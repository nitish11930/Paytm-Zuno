# Supabase setup — connection and empty schema verified

The live app still uses SQLite. These commands prepare a PostgreSQL database; they do not switch the app or upload local records.

1. Open https://supabase.com/dashboard and create a Free project named `zuno`. Choose a nearby region when offered. Keep the database password in your password manager.
2. In the project click **Connect → Session pooler**. Copy the PostgreSQL URI, replacing its password placeholder with your URL-encoded database password.
3. Save it as `SUPABASE_DB_URL=...` in ignored `privacy/supabase.env` (file permissions 600). Do not send it in chat, put it in a VITE variable, or commit it. No service-role API key is needed for this SQL connection.
4. Run `npm run supabase:check`. TLS verification stays enabled. If a custom CA is needed, download your database certificate from Supabase and set `SUPABASE_DB_CA_PATH` to the local certificate path.
5. Run `npm run supabase:schema` to create the empty private `zuno` schema. It refuses an existing schema rather than modifying one. Local data is untouched. Dashboard SQL Editor can inspect `select * from zuno.entries limit 20;` after migration. Browser anon/authenticated roles have no access to the schema.

Next engineering work: replace the synchronous SQLite repository calls with async PostgreSQL queries using a checked-out client per transaction, preserve finance and merchant isolation tests, migrate a consistent SQLite backup in foreign-key order, verify record counts/balances and switch only after successful comparison. Do not use an HTTP-based write mirror as the authoritative ledger or call a setup check a finished migration. Production identity/authorization is still a separate release requirement.

Official connection guide: https://supabase.com/docs/guides/database/connecting-to-postgres

Current project: https://supabase.com/dashboard/project/mewymxszzqhaooztctef . Verified connection and private zuno schema created on 2026-10-31. Active app storage is still SQLite; no local data imported. Previous project ixhjmqzpqmoooziojiov is no longer configured.
