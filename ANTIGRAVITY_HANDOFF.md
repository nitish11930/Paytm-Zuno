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
