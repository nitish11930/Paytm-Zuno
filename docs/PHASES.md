# Phase plan and gates

| Phase | Status | Gate / next work |
|---|---|---|
| P0 Scope and design | Implemented | Stitch references inspected, emerald/mint retained, mic moved to header, unsupported claims removed |
| P1 Ledger and data | Implemented local MVP | SQLite, entry review, integer paise, scoped demo sessions, collections and export. Audited reversal implemented; real settlement lifecycle remains future |
| P2 Cash plan | Implemented editable scheduled cash plan | Persisted planning inputs, 14-day recomputation, what-if collections and dated drivers. Statistical forecasting, data ingestion and honest backtesting remain future |
| P3 Approved actions | Implemented simulation | Explicit approval/reject, expiration, stale guard, replay safety and audit. Real WhatsApp/Paytm integrations absent |
| P4 Sarvam speech | Live synthetic API round trips passed; browser mic QA pending | New key configured; English/Hindi/Hinglish synthetic TTS -> STT passed. Manually verify real browser microphone/playback, release, codec behavior and provider errors |
| P5 Financial readiness | Implemented indicators | Coverage/reconciliation/expenses; no credit score or eligibility claim |
| P6 QA and packaging | Automated checks + representative browser QA | See QA.md. Demo recording and final pitch/video submission remain to be prepared |

Priority after key: successful real speech round trip -> measure multilingual intent corrections and amounts -> browser QA -> record demo. Add capabilities only after core flow passes. Native mobile packaging, real auth, real settlement ingestion, inventory/reordering and lender integration are separate later phases.

Practical audit update: 19 tests pass; see REAL_USER_AUDIT.md. Real Sarvam structured understanding and browser playback verified. External actions remain simulation; microphone hardware/upload permission checks remain incomplete.


31 October 2026 update: inspection remediation and Loan Readiness complete for the local demo. P5 now includes factual record cards, next-step navigation/export and an authenticated illustrative EMI calculator in all three languages. 32 regression tests + build pass. See LAUNCH_FIXES.md. Next release gate is real identity/consent/hosting/device validation and integration evidence, not additional fabricated credit scoring.


## Android and hosting preparation (31 October 2026)
Android WebView source and `npm run android:check` / `android:build` scripts are prepared. Compile/sign verification passed using a non-working example.invalid probe; no shareable APK or online deployment exists yet. Real APK build requires a healthy HTTPS backend with voice configured and private test access enabled. Docker/Render files are proposals; account selection and any hosting charges remain pending. Secrets and signing material stay in ignored privacy/, databases in ignored data/. Native microphone/device runtime checks remain unverified. Latest validation: 33 tests plus web build and formatting passed. Hosting/APK work was paused at the owner's request; repository publication does not deploy the app.


## Friendly reminder implementation
Customer-specific simple respectful drafts now include name, exact outstanding amount, shop signature and already-paid clarification in the merchant language. Drafts are frozen in proposal payload/audit; changes to dues, shop or language invalidate pending approval. Preview and Listen use these actual drafts. Delivery remains explicitly simulated; no WhatsApp credentials or customer consent records are configured. No automatic due-date queue, live Paytm import or lender scoring was added in this step. Munim branding retained; Zuno remains an optional future naming decision. Validation: 34 tests and web build passed.


## Dated udhaar foundation — 31 October
Added due_terms linked to original credit entry and merchant. Optional validated promised date in entry review; immutable retry checks include date. GET /api/follow-ups and state.followUps derive current outstanding dues, scheduled/payment_check_required status; partial payments adjust balance and closed/reversed dues disappear. Home/Khata show queue with record-payment action. Reset/export include terms. Existing undated dues remain undated. No background sending or notification, customer phone/consent integration, voice due-date extraction, payment-check confirmation persistence or WhatsApp delivery implemented yet. Next: these workflow pieces before claiming voice-only automation. 35 tests plus build passed. Backup: ignored data/backups/before-dated-dues-20261031.sqlite.


## Voice-ledger phase 1 and owner voice — current
See docs/VOICE_LEDGER_PHASE1.md. Conversation draft/clarification/explicit save implemented with merchant isolation, TTL, revisions and replay controls. Header mic opens ledger mode; owner enrollment is required for audio path. Local Python SpeechBrain ECAPA prototype installed and model inference smoke-tested. Encrypted local templates, per-command match before Sarvam, no public Python port. Human enrollment and real mic/owner-vs-impostor/noisy/replay tests remain pending: never claim secure owner-only authentication or liveness. Typed fallback is manual authenticated input, not voice verification. No global Zuno rename; no added inventory/lender scoring. Model, keys, venv and templates ignored under privacy/. See phase document for exact limits and setup.

Validation: 39 Node tests, web build, formatting and Python encrypted-template unit test pass. Browser typed ₹200 draft/cancellation checked without creating a ledger entry. CPU model load/inference passed; human speaker verification is still untested. Enrollment and command mic tests require owner participation.


## Zuno step 2 — promises and focused follow-up
Read docs/ZUNO_WORKFLOW_PROGRESS.md. Voice-ledger now asks promised payment date (or explicit no-date), parses common English/Hindi/Hinglish dates locally, separates date numbers from monetary extraction, and includes the exact date in final confirmation/save. Due follow-up can prepare only that debt after explicit unpaid confirmation; pending drafts reused, stale approvals blocked, future-promised debts excluded from generic reminders. 42 tests + build pass. WhatsApp setup explicitly unavailable per owner: remain simulated, do not provision/send. No wake-word/background push or voice reminder approval claimed.


## Day-wise import + audio usability fixes — latest
Read docs/DAYWISE_IMPORT_AND_VOICE_FIXES.md. Day-wise Khata totals come from server. Header CSV report import supports mapping/review/dedup, separates settlements, and requires explicit link/classification before money changes. No direct bank/Soundbox connection. Voice template preserved; pending draft and exact next question restore, errors/prompts/save action now visible, recording timer and cancellation guards added; command minimum 1s, enrollment 10s. Due-day voice payment check -> scoped draft -> WhatsApp delivery_pending (not sent). 53 tests + build/format and 2 Python tests pass; actual human voice verification still needs owner test. Browser advanced existing Sharma ji ₹200 draft to 2026-11-03 confirmation but DID NOT save financial entry. Keep original user data and speaker template. WhatsApp setup explicitly pending per owner.


2026-10-31 — Owner voice mismatch usability: consistent mono/noise-suppressed capture; energy-based edge-silence trimming before embeddings; explicit Reset voice / Set up again with confirmation, consent reset and ledger/draft preservation; duplicate modal alert removed. Threshold unchanged. 53 Node tests/build and 3 Python tests passed. Existing owner template preserved; user must re-enroll and test actual voice. This is an uncalibrated local speaker prototype, not validated authentication.


2026-10-31 — User explicitly replaced owner-only voice with simple tap-to-speak for any speaker in the signed-in workspace. Removed enrollment/reset/consent UI, owner status startup request, speaker verification and owner API routes from runtime. Python prototype files/templates remain untouched but unused. Audio now goes directly to Sarvam STT; login, merchant isolation, rate limits, replay protection and explicit financial save confirmation remain. 53 Node tests + build pass, including mocked audio-to-ledger flow without enrollment and unauthenticated upload rejection. Human microphone accuracy remains unverified. WhatsApp delivery setup still pending.


2026-10-31 — Shortened voice questions (no examples). Completed-entry mic starts fresh draft automatically, and New entry can interrupt completed reply playback/TTS without waiting. Reset clears transient audio/retry state; aborted TTS cannot restore old playback/error. Browser verified saved Sharma entry mic enabled and New entry restores editable input; no additional financial entry saved during QA. 54 tests/build passed; regression covers concise promise question and independent second draft.


2026-10-31 — Supabase requested; owner confirms no project exists yet. Prepared ignored privacy/supabase.env (600), pg dependency, verified-TLS connection/schema commands and private munim SQL schema. See docs/SUPABASE_SETUP.md. No cloud connection or local data upload performed; live app remains SQLite. Full asynchronous PostgreSQL repository conversion and balance-checked data migration remain pending, not completed. 54 tests/build pass; blank configuration fails safely.


2026-10-31 — User confirmed full app brand Zuno. Updated wordmark, all voice labels, title/description/PWA metadata, export filename, package name and Android display label. Supabase project display name should be zuno.

2026-10-31 — Complete code & configuration rename to Zuno: schema and migration updated to `202610310001_zuno_schema.sql` (schema `zuno`); Android package updated to `in.zuno.demo` and source moved; native pause event `zuno:native-pause`; default SQLite DB and backup paths updated to `data/zuno.sqlite`; server cookies updated to `zuno` and `zuno_device`; localStorage keys updated to `zuno-language` and `zuno-pending-entry-`; configs, tests, Docker, and Render definitions updated to Zuno. 54 tests and builds pass.


2026-10-31 — Supabase target replaced at owner request with mewymxszzqhaooztctef (zuno, Paris). New server-only URI saved in ignored privacy/supabase.env with percent-encoded password. Downloaded Supabase root CA from official supabase-downloads S3 endpoint; verified-TLS connection succeeded. Private zuno schema creation succeeded using npm run supabase:schema. No local ledger records uploaded; live app STILL SQLite. Do not claim live PostgreSQL persistence until async repository conversion and data comparison are completed. Old cloud project was not deleted.


## Order Management & Product Catalog — 31 October 2026
Implemented complete 9-step merchant order, billing, and inventory flow per owner diagram:
1. Kept voice ledger (`src/components/Voice.jsx`, `server/voice-ledger.js`) completely untouched.
2. Product Catalog (`server/inventory.js`, `src/components/Inventory.jsx`): integer paise pricing, units, stock tracking, seed defaults (Milk, Bread, Sugar, Tea, Atta, Mustard Oil, Dettol Soap, Maggi).
3. AI Order Parser (`parseOrderText`): extracts Hinglish/Hindi quantities & units, matches against catalog with fuzzy fallback.
4. Order Lifecycle & Bill Generator: draft creation -> merchant confirmation -> accept generates immutable `BILL-YYYYMMDD-XXXX` and decrements stock; reject logs audit without financial effect.
5. Payment & Ledger Auto-sync: Paid (Cash/UPI) adds `sale` and updates cash balance; Unpaid (Udhaar) collects customer name + promised date, creates `udhaar` entry and schedules reminder in `due_terms`, keeping cash uninflated.
6. Frontend Integration: `src/components/OrderModal.jsx` (steps 1-9), quick actions on Home and Profile, and one-tap WhatsApp bill copy.
7. Validation: 60 tests (all passing in ~700ms) and production Vite build passed.



2026-10-31 — Selective reminders: customer checkboxes/select all in dues, scoped proposal creation, per-recipient checkboxes beside message drafts, empty selection blocks approval. Server validates approved subset, binds selected balances/content, persists approved recipients and enforces replay/merchant isolation. Browser verified Priya-only draft and disabled approval after deselection. No reminders sent; delivery remains simulation pending WhatsApp setup. 61 tests/build passed including selection/replay/stale-balance coverage. Owner preference: keep implementation small, focused and reuse existing flows; avoid unnecessary code.


2026-10-31 — Refined reminder checkboxes to 18x18 px native emerald controls; aligned select-all and recipient labels with comfortable 44px label height and keyboard focus. Browser measured 18x18; build passed. Owner confirmed only WhatsApp Business mobile app exists (no Cloud API onboarding). Actual automated reminder delivery remains unconfigured; a phone number alone is not an API integration.


2026-10-31 — WhatsApp Web manual handoff implemented in reminder review: selected recipient phone input -> server-validated draft URL -> explicit Open WhatsApp Web link. Server checks merchant/recipient, proposal expiry/status and current unpaid snapshot; validates international number (10-digit Indian mobile normalizes to 91). No QR session capture, automatic send, delivery assertion, ledger changes or persistent contact storage. User presses Send in their own WhatsApp Web account. Removed simulation approval button from this review flow. Browser tested URL generation with temporary QA number then cleared it; no external chat opened and no message sent. 62 tests/build passed, including cross-merchant, invalid phone, expiry and no-sent-state coverage.

## Supabase PostgreSQL Persistence & Data Migration — 31 October 2026
1. Verified consistent SQLite backup in `data/backups/zuno-*.sqlite` using SQLite backup API.
2. Verified live connection and certificate verification with official Supabase root CA (`privacy/supabase-ca.crt`).
3. Private schema `zuno` expanded to 21 tables including product catalog, orders, and order_items.
4. Data migration executed via `scripts/migrate-to-supabase.mjs`:
   - Single atomic transaction in foreign-key order.
   - Verified 100% parity across table counts, merchant IDs, entries, customers, dues, and cash balances (`npm run supabase:verify`).
5. Asynchronous PostgreSQL repository implemented in `server/postgres.js`:
   - Safe BIGINT decoding (`pg.types.setTypeParser(INT8)`) ensuring integer paise safety.
   - Row-level locking (`FOR UPDATE`) on dues during collection to eliminate race conditions and over-collections under concurrency.
   - Provider-agnostic adapter in `server/sqlite-adapter.js` and `server/app.js` with fail-safe error handling.
6. Server startup configured in `server/index.js` to initialize Supabase PostgreSQL repository with clean provider reporting without secret exposure.
7. End-to-end integration tests in `tests/supabase.test.js` validating auth sessions, state snapshots, concurrency locking, and product/order flows against live Supabase PostgreSQL.
8. Validation: 64 tests passing, production Vite build passing (`npm run check`).


2026-10-31 15:52 IST — RELEASE VERIFIED: GitHub main pushed (app 2244011, migration/docs cfb092d). Render Free Docker service srv-dbis0je7bikc73dn9bog live at https://zuno-friend-test.onrender.com ; Blueprint exs-dbis028ae00c73chjcrg. Private credentials configured with owner permission; never commit privacy files. Live /api/health 200 reports postgres + voiceConfigured true + testAccessRequired true; isolated demo login/state 200; reminder proposal 201; actual Sarvam TTS 200 with audio. 64 local tests incl live PostgreSQL tests + build pass. Private demo access details: privacy/ZUNO_LIVE_LOGIN.txt. Free instance sleeps after inactivity; cold start can take ~50+ seconds per Render notice. Daily Sarvam counter is local ephemeral storage on free hosting; not a durable billing cap. WhatsApp Web handoff remains manual Send; no automatic delivery claim.


2026-10-31 — Microphone-open blank-screen hotfix: reproduced live TypeError reading undefined draft.name. PostgreSQL no-current-draft response was {active:false}, unlike SQLite null. Return null and guard frontend restore on draft presence. Added isolated PostgreSQL repository regression. 10 voice tests + build passed; live redeploy verification required.

Hotfix verified: 52b772c deployed successfully on Render (dep-dbisdp6tlv9c73bjo0eg). Reloaded production app, opened header microphone, waited for empty-draft restore and confirmed voice panel stayed mounted with mic enabled. Full 65 tests + build passed. Proof: outputs/release/zuno-mic-fixed.png in chat workspace.
