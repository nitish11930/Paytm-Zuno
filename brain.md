# Munim project memory

## Owner intent
Build the merchant app phase-wise from supplied Stitch designs in this SAME Antigravity/Codex folder. Keep it clean and fresh, not a dense dashboard/newspaper. Header microphone, subtle raised controls, four main tabs. Single active language English/Hindi/Hinglish. Demo credentials. Later an OS/native expansion; not current scope. Borrow only Voice Ledger and reconciliation/readiness concepts from separate Zuno idea; preserve Munim's forecast -> approve -> act -> track core.

## Canonical location
/Users/felipassolutions/Desktop/Paytm Munim
Both original Stitch directories are retained. Working app source is src/, server/, tests/; docs explain phases and limits. This chat originally ran from a different projectless directory; the Desktop project is authoritative for development now.

## Architecture/decisions
React 19, Vite 6, Express 5, better-sqlite3 SQLite, Zod, Lucide. localhost port 5187. Local-only prototype, not deployed. Integer paise. Per-browser demo session/merchant isolation. Synthetic scenario instead of invented model accuracy. Cash/UPI new receipts are recorded as already settled; outstanding credit excluded. Immutable saved ledger entries; edits currently available before confirmation only. Action proposal IDs, snapshot freshness, five-minute expiration and replay checks. Reminder execution simulated only. Record-quality indicators, no credit score. Self-hosted packaged fonts; no remote tracking/assets needed. Manifest is present but no service worker/offline queue/native APK.

## Sarvam
Previous key deleted at owner's request. Replacement key NOT supplied/verified in this development run. Configure locally in ignored privacy/sarvam.env, never frontend. Default saaras:v3 + bulbul:v3/shubh. Audio capture max25s; memory-only upload. Typed extraction and grounded business questions work without a key; speech requires actual provider verification. Never show fake connected device or fake transcription confidence.

## Current implementation
P0-P3 and P5 local MVP present. P2 is a synthetic planning scenario, P3 simulated tools. P4 backend STT/TTS routes implemented, live calls pending new key. P6 tests/build and browser QA documented in docs/QA.md. See PHASES.md for honest status.

## Continuation
Read ANTIGRAVITY_HANDOFF.md for a copy-ready phase-wise prompt. Next most valuable step is new-key speech testing, followed by responsive QA, component decomposition, real-data forecast validation and final demo recording. Do not replace existing code or lose financial rules while polishing UI.

## Latest QA / owner update
10 tests, build and formatting pass. Adapter tests are mocked, not live. Production-dependency audit reported 0 known vulnerabilities. Browser checks include all languages, typed entry, grouped reminder approval/audit, partial collection, grounded cash answer, Plan, Profile and Readiness. Measured compact 354px and desktop 1309px layouts without document overflow. Preview server http://127.0.0.1:5187 remains running. The browser QA shop has cash ₹13,000 and dues ₹9,500 after synthetic test entries; fresh demo login starts original seed.

Owner said: will provide the new key after dinner. Do not prompt repeatedly; live STT/TTS remains the next pending gate. Components have already been extracted into src/components; retain that structure. Source pitch is copied into docs/reference and prior preparation brief into docs/PROJECT_BRIEF.md.

## Replacement key and live verification update
New user-provided key saved locally in privacy/sarvam.env with mode600; folder700. Key never printed. Server restarted on5187 and health reports voiceConfigured=true. Actual Sarvam saaras:v3 and bulbul:v3/shubh round trips succeeded for English, Hindi and Hinglish synthetic samples. Each sample preserved a 500-rupee amount, parsed as50000paise. These tests generated audio with TTS and transcribed it through STT; they do not establish real microphone, browser playback, noisy-shop accuracy or general language coverage. Browser user-gesture mic/playback QA is the next gate. Earlier missing-key statements above are historical and superseded by this update.

## Real-user audit update (supersedes initial implementation limits)
User requested a practical full app/pitch audit, not just overview QA. 19 tests/build/format now pass. Added server/planning.js with persisted editable schedules and linked actual-entry completion; server/core.js holds date/cash primitives; server/understanding.js uses real Sarvam-105B strict JSON intent understanding with reasoning_effort:null. Advisor answers from DB evidence and offers explicit reminder review CTA; fallback visibly labeled basic. Added audited financial reversal with collection-dependency guard, idempotency-payload conflict protection, same-device resume cookie, sales including unpaid sales, what-if collection slider and browser audio controls/cleanup. New UI component src/components/Planning.jsx. Existing shop preserved (cash13000, dues9700); no financial mutation to that shop during this audit.
Planning is editable deterministic cash-flow, NOT an ML forecast. Real external reminders remain simulation; restock/promotion/credit integrations and voice approval are absent. Browser TTS playback progression verified; microphone and audio upload not verified (upload gate declined). Do not bypass those browser permission decisions. See docs/REAL_USER_AUDIT.md for exact evidence and pitch gap table. Key remains local and secret. DB backup before schema changes is ignored data/backups/before-usability-audit.sqlite.


## 31 October 2026 — inspection fixes and loan preparation
Read docs/LAUNCH_FIXES.md before earlier notes. Eight inspection findings have local remediation/tests. Logout revokes device resume; explicit private recovery key can reopen workspace. Public demo PIN creates a fresh synthetic shop after logout. Customer IDs replace name grouping; legacy ambiguous debts remain separate. Schedule versions reject lost updates/stale confirmation. Scheduled receipts support sale/collection/other receipt. Full export + verified backup/restore commands. Voice answers honor scenario; pending entry retries retain UUID; provider call budget persists. Loan Readiness implemented in src/components/LoanReadiness.jsx (Profile/services), factual indicators/next steps and authenticated illustrative EMI only. No score/eligibility/approval claims. 32 tests and build pass. Existing user funds/dues retained. Browser loan/EMI/languages checked; live mic/real deployment remains unverified. Update handoff and avoid resurrecting superseded name grouping or sign-out resume behavior.


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


2026-10-31 — User confirmed full app brand Zuno. Updated wordmark, all voice labels, title/description/PWA metadata, export filename, package name and Android display label. Supabase project display name should be zuno. Retain existing folder for project continuity; backup created for data/zuno.sqlite.

2026-10-31 — Complete code & configuration rename to Zuno per user instruction:
- Supabase: renamed schema to `zuno` and migration file to `supabase/migrations/202610310001_zuno_schema.sql`. Updated `scripts/supabase.mjs` and `docs/SUPABASE_SETUP.md`.
- Android & APK: changed Android package to `in.zuno.demo`, moved Java source to `android/app/src/main/java/in/zuno/demo/MainActivity.java`, updated native event to `zuno:native-pause`, updated `scripts/build-apk.mjs` with `ZUNO_ANDROID_URL`, keystore alias `zuno-test` and `Zuno-Test.apk`.
- SQLite & Backup: backed up `data/munim.sqlite` to `data/zuno.sqlite` using SQLite backup API; updated `server/domain.js` and `scripts/backup.mjs` default source to `data/zuno.sqlite` with fallback to `data/munim.sqlite`.
- Session & Cookie Security: updated `server/app.js` cookies to `zuno` and `zuno_device`, retaining reading and logout clearing for `munim` / `munim_device`.
- Web Frontend: updated `src/main.jsx` storage keys to `zuno-language` and `zuno-pending-entry-` with fallback, updated `src/components/Voice.jsx` native event listener.
- Configs & Tests: updated `.env.example` (`APP_ORIGIN=https://zuno.example`), `README.md`, `Dockerfile` (`zuno-entrypoint`), `render.yaml` (`zuno-friend-test`), `tests/launch.test.js`, `tests/budget.test.js`, and `.vscode/tasks.json`. All 54 tests, web build, and Android compile check pass.


2026-10-31 — Supabase target replaced at owner request with mewymxszzqhaooztctef (zuno, Paris). New server-only URI saved in ignored privacy/supabase.env with percent-encoded password. Downloaded Supabase root CA from official supabase-downloads S3 endpoint; verified-TLS connection succeeded. Private zuno schema creation succeeded using npm run supabase:schema. No local ledger records uploaded; live app STILL SQLite. Do not claim live PostgreSQL persistence until async repository conversion and data comparison are completed. Old cloud project was not deleted.


2026-10-31 — Zuno Inventory, Product Catalog & 9-Step Order Management Flow implemented:
- Preserved existing voice ledger (`src/components/Voice.jsx`, `server/voice-ledger.js`) completely untouched per user directive.
- Added `products`, `orders`, and `order_items` tables with integer paise pricing, foreign key integrity, and merchant scoping. Cleaned up in `resetDemo` and exported in `exportArchive`.
- Implemented `server/inventory.js` domain logic: CRUD product catalog with 8 default Kirana seed items, Hinglish/Hindi quantity & item order text parser, atomic order creation, merchant accept & bill generation (with stock decrement), merchant rejection with audit record, and customer payment reconciliation.
- Connected customer payment decision: Paid (Cash/UPI) adds `sale` entry to ledger and updates cash balance; Unpaid (Udhaar) collects customer name and promise date, records `udhaar` entry, registers in `due_terms` and reminder follow-up queue, keeping cash uninflated.
- Added UI components: `src/components/Inventory.jsx` (catalog management, stock adjustment, add/edit items) and `src/components/OrderModal.jsx` (complete 9-step customer order flow: input -> AI parse -> review details -> accept/reject -> bill generation -> paid vs udhaar with promise date -> shareable WhatsApp bill text).
- Added '+ Naya Order / Bill' and 'Inventory / Samaan' buttons to Home quick actions and Profile settings; added recent bills list on Home.
- Added 6 integration and unit tests in `tests/orders.test.js`. All 60 tests and production Vite build pass.



2026-10-31 — Selective reminders: customer checkboxes/select all in dues, scoped proposal creation, per-recipient checkboxes beside message drafts, empty selection blocks approval. Server validates approved subset, binds selected balances/content, persists approved recipients and enforces replay/merchant isolation. Browser verified Priya-only draft and disabled approval after deselection. No reminders sent; delivery remains simulation pending WhatsApp setup. 61 tests/build passed including selection/replay/stale-balance coverage. Owner preference: keep implementation small, focused and reuse existing flows; avoid unnecessary code.


2026-10-31 — Refined reminder checkboxes to 18x18 px native emerald controls; aligned select-all and recipient labels with comfortable 44px label height and keyboard focus. Browser measured 18x18; build passed. Owner confirmed only WhatsApp Business mobile app exists (no Cloud API onboarding). Actual automated reminder delivery remains unconfigured; a phone number alone is not an API integration.


2026-10-31 — WhatsApp Web manual handoff implemented in reminder review: selected recipient phone input -> server-validated draft URL -> explicit Open WhatsApp Web link. Server checks merchant/recipient, proposal expiry/status and current unpaid snapshot; validates international number (10-digit Indian mobile normalizes to 91). No QR session capture, automatic send, delivery assertion, ledger changes or persistent contact storage. User presses Send in their own WhatsApp Web account. Removed simulation approval button from this review flow. Browser tested URL generation with temporary QA number then cleared it; no external chat opened and no message sent. 62 tests/build passed, including cross-merchant, invalid phone, expiry and no-sent-state coverage.
