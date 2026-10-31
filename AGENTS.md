# Munim development rules

Read `brain.md`, `README.md`, `docs/PHASES.md` and `ANTIGRAVITY_HANDOFF.md` first. Preserve supplied Stitch folders. Work in the existing application; do not regenerate a starter or overwrite user work.

## Product
- Build a merchant app, not an OS. Emerald/mint, raised restrained controls, clean hierarchy. Main microphone stays inside Home header. Four tabs: Home, Khata, Plan, Profile.
- One selected language at a time: English/Hindi/Hinglish. Add every user-facing string to `src/i18n.js` where practical; names remain data.
- Synthetic records and simulated external integrations must be labeled. Do not claim official Paytm affiliation, real Soundbox access, verified credit scoring or guaranteed eligibility.

## Engineering
- All finance logic belongs on the server; integer paise only.
- Never count unpaid sales as cash or reminders as collections.
- Validate input server-side and scope every query to the authenticated merchant.
- Collections must link to the same merchant's due and cannot exceed its remaining value.
- Mutations must be transactional and idempotent where applicable. Action approvals bind a specific snapshot and expire; repeated approval executes once.
- Keep secrets in ignored `privacy/sarvam.env`; never read/print keys in tool output. Do not resurrect the deleted old key.
- Preserve HTTP-only same-site sessions, same-origin write checks, upload limits, safe error messages, rate limits and Vite secret-directory denies.
- Audio capture requires an explicit user gesture; release tracks on stop/unmount and provide typing fallback.
- Add meaningful regression tests for finance, identity and action changes. Run `npm run check` after implementation.
- Use browser QA for representative real journeys and responsive states; report what is unverified.
- Update `brain.md`, phases and handoff before ending a development session. Never mark live voice tested without an actual successful new-key call.

## Local workflow
Node >=20.19, `npm ci`, `npm run dev`, http://127.0.0.1:5187. Do not kill processes belonging to other projects. This app's local demo has no production-auth guarantee. Do not publish it with real data without the documented hardening work.
