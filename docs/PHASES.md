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
