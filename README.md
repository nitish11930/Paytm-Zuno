# Zuno

A mobile-first merchant companion, implemented from the supplied Stitch references. This is a local full-stack prototype with synthetic shop data, not an official Paytm product or a production financial service.

## Run locally

Requires Node >=20.19 and npm. From this folder:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5187. Port 5173 was already used by another local project, so Zuno defaults to 5187. Change `PORT` in a local environment file if needed; origin validation follows that port.

Demo mobile: **9876543210**. Demo PIN: **123456**. Each fresh browser gets an isolated synthetic shop. Sign-out revokes this device's resume access; the public demo PIN then opens a fresh shop. To reopen the same shop, first generate and privately save a workspace recovery key from Profile. Only the key's hash is stored; it can recover that workspace on another browser. This is private workspace access, not verified phone/OTP authentication. Do not enter real personal/financial data.

## Sarvam speech

Copy `.env.example` to `privacy/sarvam.env`, then add a NEW valid key locally. The previous chat key was deleted and has not been reused.

```sh
mkdir -p privacy
chmod 700 privacy
cp .env.example privacy/sarvam.env
chmod 600 privacy/sarvam.env
```

Edit `SARVAM_API_KEY` in that file without sharing it. Restart the server. `/api/health` exposes only a boolean configuration flag, never a key. Current adapters use `saaras:v3` and `bulbul:v3`/`shubh`; configurable model overrides require compatible parameters and testing. Replacement key configured locally. Live synthetic TTS -> STT round trips passed in English, Hindi and Hinglish on 30 October 2026; browser microphone/playback remains to be manually verified.

- Header microphone: explicit tap-to-record; max 25 seconds; stops media tracks when closed. Browser microphone permission is required. Supports browser-negotiated WebM/MP4/Ogg.
- STT audio is sent server-side to Sarvam; uploads stay in memory and are not retained by this application. Sarvam provider retention must be reviewed before real data.
- Typed input works without a key. Structured Sarvam-105B understanding handles English/Hindi/Hinglish tasks and questions; a visible basic rules fallback is used if the model is unavailable or invalid. All entries require review before saving. Numbers and finance answers are generated from scoped database records, not model arithmetic.
- Ask available-cash, dues or cash-shortfall questions. Replies use database-derived amounts. The Listen button synthesizes the answer through Sarvam.
- Exactly one UI language is selected: English, Hindi or Hinglish. Selection persists in that browser and controls speech language. This does not restrict what a user might type or what multilingual STT can detect.

## Working features

Welcome, demo login, shop setup, clean dashboard, header voice sheet, ledger with filters/search, four entry types, review before saving, customer dues and partial collections, 14-day cash scenario, reminders with explicit approval/rejection, audit history, record-readiness indicators, shop settings, JSON export and own-demo reset.

Money is stored in integer paise. Pending dues never count as cash. All newly recorded Cash/UPI receipts represent already-received/settled money; this prototype does not fetch real settlement status. Seeded payment matches are visibly labeled demo. A reminder is simulated and never alters money. Customer IDs distinguish people with the same name. Choose an existing customer to group their debts; historical ambiguous entries stay in separate accounts for review.

Planning inputs are now persisted, editable dated records. Add/edit/cancel from Plan -> Planning inputs. Record an expected item as received/paid to complete it once. Incoming plans distinguish sales, linked collections and other receipts. Plan edits and confirmations require the current version. Wrong saved entries can be reversed with a reason and an audit trail; linked collections must be reversed before the original credit. The initial scenario gives available cash ₹12,000, pending dues ₹10,000 and day-3 shortfall ₹18,000. Forecast receipts and obligations are explicit synthetic assumptions, not ML predictions. The complete 14-day series is recomputed when records change. No credit score, loan approval, real Soundbox, WhatsApp or Paytm integration is claimed.

## Verify

```sh
npm test
npm run build
npm run check
```

Tests cover cash math, collection limits, idempotency, stale/expired/rejected approvals, reminder no-money effects, grouped reminders, session isolation, validation, cross-origin rejection, grounded answers and speech parsing. See `docs/QA.md` for browser evidence and limitations.

## Layout

- `src/`: React interface, translations and responsive design.
- `server/domain.js`: SQLite schema and finance/action rules.
- `server/app.js`: validated HTTP endpoints, sessions, security boundaries.
- `server/voice.js`: Sarvam STT/TTS adapters and simple intent extraction.
- `server/advisor.js`: deterministic business answers grounded in the database.
- `tests/`: automated domain/API tests.
- `data/`: ignored local SQLite database.
- `privacy/`: ignored server secrets; blocked from Vite serving.
- Original `stitch_*` folders: retained design references, not application runtime.
- `brain.md`: current decisions and continuation state.
- `ANTIGRAVITY_HANDOFF.md`: copy-ready continuation prompt and next phases.

A web-app manifest supports standalone presentation; there is no offline-write queue or service worker. Native Android/iOS packaging is future work.

## Latest practical audit
See docs/REAL_USER_AUDIT.md for the pitch comparison, fixes, 19 passing tests and remaining production gaps. Live browser speech playback progressed successfully. Browser microphone and audio-upload checks remain incomplete due to permission/hardware limits. The plan is deterministic and editable, not a trained prediction.


## Inspection fixes and Loan Readiness (31 October 2026)
See docs/LAUNCH_FIXES.md for the current status, 32-test validation, private workspace recovery, full export, verified SQLite backup/restore commands, configurable HTTPS origin, provider usage caps and the new Loan Readiness/EMI screen. This supersedes older demo-resume and readiness descriptions. Public launch is still a separate identity/operations/integration release.


## Android and hosting preparation (31 October 2026)
Android WebView source and `npm run android:check` / `android:build` scripts are prepared. Compile/sign verification passed using a non-working example.invalid probe; no shareable APK or online deployment exists yet. Real APK build requires a healthy HTTPS backend with voice configured and private test access enabled. Docker/Render files are proposals; account selection and any hosting charges remain pending. Secrets and signing material stay in ignored privacy/, databases in ignored data/. Native microphone/device runtime checks remain unverified. Latest validation: 33 tests plus web build and formatting passed. Hosting/APK work was paused at the owner's request; repository publication does not deploy the app.


## Voice-ledger phase 1 and owner voice — current
See docs/VOICE_LEDGER_PHASE1.md. Conversation draft/clarification/explicit save implemented with merchant isolation, TTL, revisions and replay controls. Header mic opens ledger mode; owner enrollment is required for audio path. Local Python SpeechBrain ECAPA prototype installed and model inference smoke-tested. Encrypted local templates, per-command match before Sarvam, no public Python port. Human enrollment and real mic/owner-vs-impostor/noisy/replay tests remain pending: never claim secure owner-only authentication or liveness. Typed fallback is manual authenticated input, not voice verification. No global Zuno rename; no added inventory/lender scoring. Model, keys, venv and templates ignored under privacy/. See phase document for exact limits and setup.

Current Zuno workflow progress: see docs/ZUNO_WORKFLOW_PROGRESS.md for voice-promised dates, scoped unpaid follow-up and 42-test validation. WhatsApp remains unconfigured/simulated.


## Day-wise import + audio usability fixes — latest
Read docs/DAYWISE_IMPORT_AND_VOICE_FIXES.md. Day-wise Khata totals come from server. Header CSV report import supports mapping/review/dedup, separates settlements, and requires explicit link/classification before money changes. No direct bank/Soundbox connection. Voice template preserved; pending draft and exact next question restore, errors/prompts/save action now visible, recording timer and cancellation guards added; command minimum 1s, enrollment 10s. Due-day voice payment check -> scoped draft -> WhatsApp delivery_pending (not sent). 53 tests + build/format and 2 Python tests pass; actual human voice verification still needs owner test. Browser advanced existing Sharma ji ₹200 draft to 2026-11-03 confirmation but DID NOT save financial entry. Keep original user data and speaker template. WhatsApp setup explicitly pending per owner.
