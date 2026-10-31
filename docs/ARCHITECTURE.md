# Architecture and data contracts

Single localhost Node process serves the validated Express API plus Vite middleware in development. React uses same-origin JSON requests and a server-issued session cookie. Production build generates a static `dist/` frontend; the Express production branch serves it, but HTTPS/origin/auth hardening is needed before deployment.

SQLite tables: merchants, sessions, entries, obligations, proposals and audit. Sessions select the merchant; the client never controls the tenant identifier. Entry types are sale/expense/udhaar/collection. Values are integer paise. A collection references a same-merchant udhaar entry. Fully collected dues disappear from the outstanding list while the ledger retains history. Approved reminders only append an audit event. Expiry and payload comparison prevent stale approvals. Replayed decisions return original status.

Seed: opening cash 1,200,000 paise, sales 85,000 + 35,000, expenses 120,000 = current 1,200,000. Dues 1,000,000 excluded. Expected receipts by day 3 are 800,000; supplier plus rent 3,800,000; projected day-3 closing -1,800,000. Conservative receipts multiply by 0.7. This is a transparent rolling-date illustration; not a trained prediction, calibrated uncertainty or backtested performance claim.

API routes:
- GET /api/health: readiness boolean, no authentication data.
- POST /api/auth/login: documented demo phone/PIN; isolated synthetic shop.
- POST /api/auth/logout: remove current session.
- GET /api/state?scenario=expected|conservative: scoped snapshot.
- PATCH /api/shop: bounded owner/shop/language strings.
- POST /api/entries: kind, amount (paise), name, method, note?, dueId? and UUID requestKey.
- POST /api/actions/propose: snapshot grouped outstanding dues, 5-min expiry.
- POST /api/actions/:id/decision: boolean approve; simulated/rejected status.
- POST /api/voice/intent: text + language; entry suggestion or grounded answer.
- POST /api/voice/transcribe: multipart audio + language; max 5MB/25s client recording.
- POST /api/voice/speak: bounded text + language; base64 audio and provider request ID.
- GET /api/export: authenticated JSON download.
- POST /api/demo/reset: remove own synthetic shop, clear session.

State is refetched after mutations; the server is the financial source of truth. Language selection lives in browser preferences; profile update also stores its current value. No offline writes: server errors are surfaced and unsaved forms remain editable. The language setting controls templates and provider language mode; it is not a translation engine.

Limitations: heuristic speech intent, no trained forecast, no real external tools, no customer identity beyond due/name, no pending-settlement lifecycle, no persisted-entry correction/reversal flow, no production auth, no native packaging. Approved-action money state and credit readiness remain explicitly separate.

## Practical audit changes
Added schedule, planning_initialized, entry_voids, entry_schedule and demo_devices tables. Forecast now uses persisted pending scheduled cash flows; linked actual entries atomically complete an item to avoid double counting. Reversing that entry restores its plan item. Shared date/cash/error primitives live in core.js. Dates use Asia/Kolkata. New endpoints POST/PATCH /api/schedule and POST /api/entries/:id/reverse are tenant-scoped and validated. The assistant uses structured Sarvam intent understanding with schema validation and visible rules fallback; financial answers/evidence stay deterministic and database-grounded. No model can execute a mutation.


## 31 October inspection remediation (supersedes earlier limitations)
New customers/entry_customers, workspace_access and schedule_requests tables; additive schedule version/kind/due_id columns. Other receipt is a fifth entry type (cash inflow, excluded from sales). Incoming plans can bind a collection to a due. Reviewed schedule version is mandatory for completion; PATCH requires version. Customer linkage is tenant-scoped. Export now has schemaVersion=2 and complete domain tables/audit. Logout revokes device resume; POST /api/auth/recovery-key rotates a hashed private bearer key, accepted via login recoveryKey. POST /api/voice/intent accepts scenario. POST /api/loan/estimate performs bounded illustrative EMI calculation. Provider usage persists separately in data/provider-budget.sqlite. See LAUNCH_FIXES.md for full contracts and limitations.
