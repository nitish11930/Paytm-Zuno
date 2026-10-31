# Launch inspection remediation — 31 October 2026

The eight inspection findings have local code changes and regression coverage. This release is still a synthetic merchant prototype, not a certified public banking/lending deployment.

| Finding | Change | Verification |
|---|---|---|
| F1 shared-device logout / continuity | Sign-out deletes the current session and device-resume token. The public demo PIN opens a fresh shop after sign-out. A 256-bit private workspace recovery key can reopen the same shop on another browser; only its SHA-256 hash is stored. Generating a replacement invalidates the old key. | Logout, cross-device recovery, hash storage and rotation tests |
| F2 planned receipts become sales | Incoming plans distinguish sale, linked due collection and other receipt. Non-sales receipts never inflate sales; scheduled collections reduce the linked debt. | Collection, full-collection replay, reversal and capital-receipt tests |
| F3 stale plan edit | Version preconditions reject outdated updates/cancellation with 409. Audit includes prior values. | Lost-update rejection test |
| F4 obsolete payment confirmation | Recording a schedule requires its reviewed version, amount, kind and collection linkage. Completion/reversal advances the version. | Stale supplier/date confirmation and reversal replay tests |
| F5 names as identity | Merchant-scoped customer IDs, explicit existing/new-person selection, customer-ID reminder grouping and visible account suffixes. Historical unmapped debts are kept separate and marked for review rather than guessing people by name. | Same-name separation, same-ID aggregation and cross-merchant rejection tests |
| F6 scenario inconsistency | Selected Expected/Conservative scenario flows through voice intent and grounded answers/evidence. | Scenario-specific answer/evidence test |
| F7 incomplete export | Schema-v2 archive exports every audit event plus domain/link/reversal tables; authentication secrets are excluded. SQLite backup and restore-to-new-file commands verify integrity. | >100-event export test and backup/restore drill matching domain tables/cash |
| F8 HTTPS origin | Exact configured HTTPS APP_ORIGIN is accepted; other origins stay blocked. Server remains loopback-only for local use or a trusted HTTPS reverse proxy. | Allowed/denied origin tests; no public proxy deployment performed |

Additional safeguards:
- Failed post-save refresh is surfaced; a confirmed entry save stays clearly marked saved.
- Entry request/payload survives reload in a per-workspace local pending-operation record. An uncertain response retries the same UUID; attempted details cannot silently change. Full-collection replays work after the debt leaves the outstanding list. Definitive 4xx errors release the draft; ambiguous network/5xx responses retain it.
- Refresh responses are ordered; foreground/online/minute refresh updates dates and balances.
- Schedule creation retains its original request payload, so replay after a later edit does not create a duplicate or compare against mutated fields.
- Opposite replay of a decided action returns 409 rather than displaying an incompatible success.
- Provider requests have a 25-second timeout, four concurrent calls per process, 30 voice requests/minute per workspace plus existing IP/route limits, and a persisted daily call allowance (default 500, UTC reset). This is a call cap, not a currency spending guarantee. Failed upstream attempts also consume the cap. Provider-side billing limits remain advisable for public operation.
- Audio is stopped on component unmount even when React clears the element ref.

## Loan Readiness

Open Profile → Loan readiness (also available through services). Clean emerald/mint hero, three factual record indicators, three next-step actions and a collapsible EMI estimate.

No credit/CIBIL score, eligibility, pre-approved amount, application submission or lender connectivity is represented. Verified receipts display zero because demo payment matches are synthetic. Days-with-entries is explicitly different from continuous coverage.

The calculator calls authenticated POST /api/loan/estimate. Amounts are integer paise; tenure 1–120 months and annual rate 0–60%. Uses a standard illustrative reducing-balance formula and rounded monthly instalment. Fees/taxes and lender rounding are excluded; it does not determine affordability. Results are recalculated only on explicit submission and clear when inputs change.

English/Hindi/Hinglish content and navigation were checked in the browser. At ₹50,000, 12 months and 18% annual assumption, the displayed estimate is ₹4,584/month, ₹5,008 estimated interest, ₹55,008 total. Those assumptions are editable and are not a lender quote.

## Recovery and backups

Generate a recovery key from Profile before signing out if you need to reopen this synthetic shop. Keep it private; possession grants workspace access. It is displayed once and never included in exports. There is no verified-phone identity, OTP, password reset service or staff-role system. Losing both device access and recovery key requires local operator recovery; do not describe this as production identity.

JSON export is a complete domain archive, not an automatic backup or a supported JSON import. For operational recovery use:

```
npm run backup -- data/munim.sqlite data/backups/manual-unique.sqlite
npm run restore -- data/backups/manual-unique.sqlite data/restored-unique.sqlite
```

Backup/restore refuse to overwrite an existing target and check SQLite integrity/foreign keys. Files are owner-only. Before switching restored data into use: stop this app, preserve the current database AND its WAL/SHM state via a verified SQLite backup, ensure no process is using the target, then swap the restored database through an operator-controlled procedure. Never copy a live WAL database as a single raw file. The app has no automatic backup scheduler or encrypted off-device backup yet.

## Deployment configuration

For a future HTTPS proxy set `APP_ORIGIN=https://your-exact-origin.example` and `NODE_ENV=production`, build first, and retain the loopback binding behind the proxy. APP_ORIGIN cannot contain a path or use HTTP. Do not expose development middleware. Cookie, TLS, proxy headers, distributed abuse controls and recovery operations need validation on the actual hosting topology.

Optional `SARVAM_DAILY_CALL_LIMIT` configures daily provider attempts. `SARVAM_BUDGET_DB` can set the counter file location; tests use an isolated database. Keep all such files outside public/static paths. Do not place provider keys in VITE_ variables.

## Validation and limits

32 automated tests, production build and formatting checks pass. Tests mock provider traffic and do not spend Sarvam credits. The restore test uses temporary synthetic data; existing shop financial entries were preserved. A local pre-change SQLite backup was made before migration.

Browser: existing shop still has ₹13,000 funds / ₹9,700 outstanding; sales today correctly reset to ₹0 after the date rolled to 31 October. New customer-account counts reflect distinct IDs rather than deduplicating names. Loan page, three languages, calculator result and planning navigation inspected. Current browser viewport checked; comprehensive 320px/device matrix, delayed-network browser fault injection and real microphone capture remain unverified.

Public launch still requires real merchant identity/recovery design, consent/retention implementation, tested hosting/operations and real integration contracts. Actual Paytm/Soundbox reconciliation, WhatsApp delivery, lender decisions and predictive-model validation remain outside this local build. No external money movement, loan applications or messages execute.
