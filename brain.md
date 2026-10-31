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
