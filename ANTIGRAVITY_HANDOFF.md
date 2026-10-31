# Copy-ready Antigravity continuation prompt

Continue the existing Paytm Munim app in THIS folder. Do not regenerate or replace it. First read AGENTS.md, brain.md, README.md, SECURITY.md, docs/ARCHITECTURE.md, docs/PHASES.md and docs/QA.md. Inspect current files and changes before editing. Preserve both stitch_* reference directories.

The app is already a working local React/Vite + Express/SQLite prototype. Default URL is http://127.0.0.1:5187 (5173 belongs to another project). Start with npm ci if dependencies are missing, npm run dev, then npm run check for tests/build. Demo login is 9876543210 / PIN 123456; no actual SMS is sent. The frontend is mobile-first with a desktop adaptation; this is not yet a native APK or OS.

Product requirements: clean premium emerald/mint design, restrained raised buttons/hover/press states, header microphone (never bottom floating mic), four tabs Home/Khata/Plan/Profile. Exactly one active language: English, Hindi or Hinglish. Keep translation strings in src/i18n.js. No fake Soundbox connectivity, credit score, loan eligibility, encryption assurance or production compliance claim.

Implemented: welcome/login/setup, Home, four ledger entry types with review before save, customer dues, partial collections, 14-day cash scenario, grouped reminder previews with approve/reject, stale/expired/replayed approval protection, audit log, financial-record indicators, shop settings, JSON export and reset. Typed voice commands and cash/dues/forecast questions work via deterministic rules. Real Sarvam STT/TTS backend adapters exist. The replacement key is now configured locally; synthetic live TTS-to-STT tests passed in English, Hindi and Hinglish. Browser microphone and playback QA remain pending. The old exposed key was deleted; NEVER recover or reuse it.

PHASE A — Finish speech verification:
1. The owner has configured a NEW key. Check the configuration status in ignored privacy/sarvam.env, without printing or reading it into output. Keep server-only; never use VITE_ secrets. Restart server after config changes. Boolean /api/health is enough to check configuration.
2. Manually run real microphone -> Sarvam STT -> editable transcript -> entry review -> confirmed save. Check English, Hindi and Hinglish independently. Sarvam settings default to saaras:v3 and bulbul:v3/shubh; use account-supported compatible model/voice parameters.
3. Test Listen for grounded cash/dues/forecast responses and reminder preview. Measure latency/errors. Never claim speech is tested based only on a key-present flag.
4. Check denied mic, 25s limit, close during capture, provider error/credits exhaustion and typed fallback. Avoid retaining raw audio or logging private transcripts/keys.

PHASE B — Improve core usability without financial regressions:
1. Audit 390px, 320px and desktop layouts, long names and Hindi wrapping. Preserve the current visual direction.
2. Shared, voice and entry components are already extracted into src/components. Further split the remaining screens/hooks if it improves maintainability, preserving behavior and tests.
3. Add future entry corrections as audited reversal/replacement flows, not silent overwrites of financial history. Add unsettled UPI lifecycle only with explicit received/settled status.
4. Keep pending dues out of cash. Reminder execution never adds money. Collections cannot exceed the linked due and must belong to the authenticated merchant. All amounts integer paise.
5. Forecast remains a labeled synthetic scenario until real chronological data and baseline evaluation exist. Never fabricate model accuracy.

PHASE C — Final demo and evidence:
1. Run npm run check and inspect browser journeys, not just the build.
2. Demo: login -> header mic -> record udhaar -> ledger -> shortage -> approved simulated reminder -> record partial collection -> updated dues/cash -> readiness. Also show rejection/error recovery.
3. Capture clean screenshots and a short demo video only after implementation is stable. Update presentation to distinguish live capabilities, simulation and future scope.
4. Update brain.md, PHASES.md and QA.md with actual outcomes, remaining blockers and exact next steps before ending. Do not deploy publicly or claim production readiness without real identity/TLS/origin/retention hardening.

Security boundaries: prepared DB queries, merchant scoping, HTTP-only session cookies, same-origin JSON writes, Zod schemas, rate limits, memory-only bounded audio, ignored privacy/data dirs and Vite fs deny list. Preserve these. Never modify or kill other projects' servers.

Report concretely: what changed, what tests and browser journeys passed, what remains unverified and what the owner needs to provide. Do not mark P4 live speech complete until an actual successful round trip with the replacement key has been observed.

## Important superseding real-user audit update
Read docs/REAL_USER_AUDIT.md before doing earlier next-step tasks. Audited reversal, editable dated schedule inputs, linked receipt/payment completion, what-if slider, same-device demo resume and structured Sarvam chat understanding are now implemented. src/components/Planning.jsx contains these new forms; server/core.js, server/planning.js and server/understanding.js hold the new backend logic. Existing ledger rows are retained during reversals. 19 tests pass. Browser TTS playback verified; microphone/audio upload not completed due to browser permission/hardware limits. Do not bypass a declined upload or new-origin permission. External message/stock/lending APIs and trained statistical forecasts still absent. The app is a working local operational demo, not ready for real merchant data.


## Current handoff — 31 October 2026 (supersedes earlier priorities)
Read AGENTS.md, brain.md, docs/LAUNCH_FIXES.md and current source first. Continue this existing project; preserve Stitch assets. Inspection fixes and Loan Readiness are implemented and covered by 32 passing tests plus build. No provider calls made in this pass.

Current invariants: integer paise; other receipts excluded from sales; collections tied to same-merchant due/customer; schedule version required for PATCH/recording and incremented on completion/reversal; request payloads immutable for safe replay. Customer IDs, not names, group reminders. Existing legacy debts intentionally remain separate pending review. Never automatically merge historical names.

Logout revokes device resume. Recovery key is a private random bearer credential, hash-only in DB, shown once in Profile; a public demo PIN cannot reopen the signed-out workspace. Full production identity/roles are still absent. Never print recovery/provider keys. Complete archive is schema v2; SQLite backup/restore scripts refuse overwrites. Run npm run check and npm run format:check after source changes. Tests must use mock providers/isolated budget DB.

Loan screen: Profile -> Loan readiness. Emerald clean design, no fabricated credit score, pre-approved offer or eligibility. Three record facts, next-step buttons and collapsible illustrative EMI via POST /api/loan/estimate. All three languages. Do not turn its calculator into a lending recommendation.

Next phase: browser/device fault-injection journeys (lost response, offline/reload, mic permission/interruptions), actual consent/retention and durable identity requirements, hosted HTTPS/proxy validation, then real integration contracts and forecast evaluation. Do not deploy publicly, claim real payments/messages/lending or mark production ready based on local tests. The configured APP_ORIGIN permits a chosen HTTPS origin but no hosting was provisioned. Keep localhost port 5187 and do not kill other projects.


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


2026-10-31 — User confirmed full app brand Zuno. Complete code & configuration rename: schema and migration updated to `202610310001_zuno_schema.sql` (schema `zuno`); Android package updated to `in.zuno.demo` and source moved; native pause event `zuno:native-pause`; default SQLite DB and backup paths updated to `data/zuno.sqlite`; server cookies updated to `zuno` and `zuno_device`; localStorage keys updated to `zuno-language` and `zuno-pending-entry-`; configs, tests, Docker, and Render definitions updated to Zuno. 54 tests and builds pass.


2026-10-31 — Supabase target replaced at owner request with mewymxszzqhaooztctef (zuno, Paris). New server-only URI saved in ignored privacy/supabase.env with percent-encoded password. Downloaded Supabase root CA from official supabase-downloads S3 endpoint; verified-TLS connection succeeded. Private zuno schema creation succeeded using npm run supabase:schema. No local ledger records uploaded; live app STILL SQLite. Do not claim live PostgreSQL persistence until async repository conversion and data comparison are completed. Old cloud project was not deleted.


2026-10-31 — Zuno Inventory, Product Catalog & 9-Step Order Management Flow:
Preserved existing voice ledger without touching audio capture or voice turns. Built `products`, `orders`, and `order_items` tables with integer paise and merchant scoping. Implemented `server/inventory.js` for catalog CRUD with 8 default Kirana items, Hinglish/Hindi quantity & item order parsing, bill generation (`BILL-YYYYMMDD-XXXX`), merchant accept/reject, and payment reconciliation (Paid -> Cash/Sales, Udhaar -> Customer due + Promise date + Reminder schedule). Frontend modals `src/components/Inventory.jsx` and `src/components/OrderModal.jsx` integrated into Home quick actions, Profile settings, and services grid, with one-tap WhatsApp bill copy. All 60 automated tests and Vite production build pass.



2026-10-31 — Selective reminders: customer checkboxes/select all in dues, scoped proposal creation, per-recipient checkboxes beside message drafts, empty selection blocks approval. Server validates approved subset, binds selected balances/content, persists approved recipients and enforces replay/merchant isolation. Browser verified Priya-only draft and disabled approval after deselection. No reminders sent; delivery remains simulation pending WhatsApp setup. 61 tests/build passed including selection/replay/stale-balance coverage. Owner preference: keep implementation small, focused and reuse existing flows; avoid unnecessary code.


2026-10-31 — Refined reminder checkboxes to 18x18 px native emerald controls; aligned select-all and recipient labels with comfortable 44px label height and keyboard focus. Browser measured 18x18; build passed. Owner confirmed only WhatsApp Business mobile app exists (no Cloud API onboarding). Actual automated reminder delivery remains unconfigured; a phone number alone is not an API integration.


2026-10-31 — WhatsApp Web manual handoff implemented in reminder review: selected recipient phone input -> server-validated draft URL -> explicit Open WhatsApp Web link. Server checks merchant/recipient, proposal expiry/status and current unpaid snapshot; validates international number (10-digit Indian mobile normalizes to 91). No QR session capture, automatic send, delivery assertion, ledger changes or persistent contact storage. User presses Send in their own WhatsApp Web account. Removed simulation approval button from this review flow. Browser tested URL generation with temporary QA number then cleared it; no external chat opened and no message sent. 62 tests/build passed, including cross-merchant, invalid phone, expiry and no-sent-state coverage.

## Supabase PostgreSQL Persistence & Migration — 31 October 2026 (Live)
- Project: https://supabase.com/dashboard/project/mewymxszzqhaooztctef (zuno, Paris). Credentials in `privacy/supabase.env`.
- Database backup created in `data/backups/zuno-*.sqlite`.
- Supabase schema `zuno` contains 21 tables with strict TLS certificate verification (`privacy/supabase-ca.crt`).
- Migration completed via `scripts/migrate-to-supabase.mjs`: single atomic transaction in foreign-key order. All 3 merchants, 27 entries, 11 customers, 48 schedules, 2 due terms, and cash balances verified 100% equal (`npm run supabase:verify`).
- Implemented `server/postgres.js` (full PostgreSQL repository) and `server/sqlite-adapter.js` (unified provider adapter).
- Express backend (`server/app.js`, `server/index.js`) seamlessly supports both Supabase PostgreSQL and local SQLite fallback.
- Over-collection concurrency protection enforced with PostgreSQL row locks (`SELECT ... FOR UPDATE`).
- Integer paise only; BIGINT safely decoded to JavaScript safe integers.
- All 64 tests pass (`npm test`), production build passes (`npm run check`).


2026-10-31 15:52 IST — RELEASE VERIFIED: GitHub main pushed (app 2244011, migration/docs cfb092d). Render Free Docker service srv-dbis0je7bikc73dn9bog live at https://zuno-friend-test.onrender.com ; Blueprint exs-dbis028ae00c73chjcrg. Private credentials configured with owner permission; never commit privacy files. Live /api/health 200 reports postgres + voiceConfigured true + testAccessRequired true; isolated demo login/state 200; reminder proposal 201; actual Sarvam TTS 200 with audio. 64 local tests incl live PostgreSQL tests + build pass. Private demo access details: privacy/ZUNO_LIVE_LOGIN.txt. Free instance sleeps after inactivity; cold start can take ~50+ seconds per Render notice. Daily Sarvam counter is local ephemeral storage on free hosting; not a durable billing cap. WhatsApp Web handoff remains manual Send; no automatic delivery claim.


2026-10-31 — Microphone-open blank-screen hotfix: reproduced live TypeError reading undefined draft.name. PostgreSQL no-current-draft response was {active:false}, unlike SQLite null. Return null and guard frontend restore on draft presence. Added isolated PostgreSQL repository regression. 10 voice tests + build passed; live redeploy verification required.

Hotfix verified: 52b772c deployed successfully on Render (dep-dbisdp6tlv9c73bjo0eg). Reloaded production app, opened header microphone, waited for empty-draft restore and confirmed voice panel stayed mounted with mic enabled. Full 65 tests + build passed. Proof: outputs/release/zuno-mic-fixed.png in chat workspace.

2026-10-31 16:50 IST — Voice draft multi-turn loop hotfix & GitHub push:
- Fixed draft field retention across multi-turn voice flows (`applyVoiceFields`) so existing `amount`, `name`, and `kind` are never wiped by null understanding passes.
- Expanded Hindi number table with tens words (`bees`, `tees`, `chalis`, `pachas`, `sath`, `sattar`, `assi`, `nabbe`) and allowed spoken amount words.
- Added relative promise date handling for `parso` / `parson` and declination replies (`date tay nahi`, `pata nahi`, `baad mein`, `nahi`).
- Fixed PostgreSQL voice draft updates to use `applyVoiceFields` under transactional client checkout.
- Updated `render.yaml` with `autoDeployTrigger: commit`.
- Full 66 tests pass across unit, integration, and live Supabase suites. Pushed to `https://github.com/nitish11930/Paytm-Zuno` (commit `abf86dd`).

2026-10-31 17:05 IST — Khata view & Dues blank page hotfix:
- Fixed "Khata mein dekhein" button navigation: `onViewLedger` now navigates directly to `khata` tab as expected by merchant rather than jumping to `dues`.
- Fixed dues customerId crash: added `linkCustomers` in PostgreSQL `dues()` and `seedDemoMerchant`, plus fallback `customerId: e.customer_id || e.id`.
- Defensive frontend handling: guarded `d.customerId?.slice` with `(d.customerId || d.id || "").slice(0, 6)` and ensured reminder checkboxes use `d.customerId || d.id`.
- Added top-level React `ErrorBoundary` so uncaught rendering exceptions display a safe retry UI instead of an unrecoverable blank white screen.
- 66 tests pass, production bundle built cleanly in 1.2s. Pushed to `origin main`.

