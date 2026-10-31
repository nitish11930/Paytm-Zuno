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
