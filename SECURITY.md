# Security boundaries

This is a localhost-only synthetic-data prototype, not production-ready authentication, lending, payment or banking software.

Implemented: per-browser isolated demo merchant, 256-bit random session cookies, SHA-256 session lookup, HTTP-only SameSite=Strict cookie, 24h expiry, server-side merchant scoping, prepared SQLite statements, Zod validation, integer paise and bounded amounts, transactions, idempotent writes/actions, action snapshot/expiry checks, same-origin write enforcement, Helmet headers, rate limits, bounded in-memory audio, server-only Sarvam key, no secret logging, ignored database/secrets and Vite denied paths. Data directory uses owner-only permissions; main DB file mode is 600. Local OS/backups remain an independent security boundary.

Demo credentials are public by design. They create independent synthetic shops and must NEVER be used as production authentication. Production cookie security is enabled under NODE_ENV=production, but deploying requires a real HTTPS origin policy, identity provider, authorization review, retention/deletion strategy, encrypted storage/backups, operational monitoring and rate-limit/session storage suitable for deployment topology. Current origin allowlist is explicitly loopback only.

No real payments, loan approvals or messages execute. Payment-matched seeded records are synthetic. Spoken records are merchant-confirmed, not externally verified. There is no complete consent/legal-compliance implementation. Sarvam audio processing involves the provider: review its policies and obtain appropriate consent before real merchant/customer use.

Microphone capture occurs only after a user click; max 25 seconds; raw audio is not persisted by the app. Responses avoid returning upstream provider error bodies or keys. Review recordings for bystander/private information before choosing to use the service.

Do not post credentials into tickets, commits, screenshots or chat. If exposed, revoke at provider and replace. Never put keys in a frontend VITE_ variable. `privacy/` and `data/` must remain excluded from any source archive/share. Source references imported from Stitch may contain remote asset URLs and unsupported product claims; they are not served by the app.

Report local findings to the project owner with reproduction steps and redacted evidence; do not include customer data or keys.

Audit update: an HTTP-only 30-day same-device resume cookie was added for demo continuity; this is not production identity. Reversals preserve original ledger rows and append audit metadata. Sarvam chat receives bounded utterance/topic context for intent classification, not the whole database. Responses are schema-validated, and no model output directly executes actions or supplies financial totals.


31 October remediation supersedes the earlier sign-out behavior: logout now revokes the device token as well as the session. Private workspace recovery uses a random 256-bit key stored only as a SHA-256 hash; rotation invalidates old recovery keys. Treat displayed keys as bearer credentials. Pending entry payloads are locally stored per synthetic workspace for safe retry; they are not suitable for real-data use without an explicit local-data threat model. Version checks bind reviewed planning records. Customer IDs replace name-based authority. Configured exact HTTPS APP_ORIGIN is supported; actual deployment has not occurred. Provider attempts are capped per workspace/IP and by a persisted daily global call counter. See docs/LAUNCH_FIXES.md for boundaries, backup/restore and remaining production work.
