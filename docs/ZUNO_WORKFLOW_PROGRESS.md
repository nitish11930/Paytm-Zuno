# Zuno workflow: promised payment and focused follow-up

## Current step (31 October 2026)
Voice-ledger drafts now capture a promised date before final save. Supported local parsing: English/Hindi/Hinglish day/week offsets (up to 365 days), today/tomorrow/day-after-tomorrow and valid future/today ISO dates. Relative dates use the existing Asia/Kolkata business date. Multiple conflicting dates, invalid/past dates and unsupported expressions remain unresolved and prompt again. Merchant can explicitly say no date/skip; a date is never invented.

A date phrase is removed from the initial amount-understanding input, so “100 rupees, 3 din baad” does not interpret 3 as another money amount. The final spoken/read summary includes the exact date. Date and financial entry commit together using existing due_terms and replay protection. No extra model call is made for the date reply.

Due-date follow-ups derive from durable ledger/terms each time state loads, with existing periodic refresh while the app is open. They are not background push notifications when the app is closed. Received/partially received payments immediately change the derived outstanding balance. No-reply is not interpreted as unpaid.

The queue has two explicit paths: record actual collection, or confirm “Not received — prepare reminder.” The latter creates a five-minute, customer/due-specific proposal, with exact current amount and a manual payment-check audit record. It excludes every other customer's debt and reuses identical pending drafts. Confirmation never moves money. A collection or date/shop/language change invalidates stale proposal approval. Generic reminder previews also exclude future-promised debts.

## Intentionally pending
Owner voice enrollment and actual owner/impostor/noise validation still require the human owner. No continuous/wake-word recording implemented. Personal WhatsApp access is not assumed: owner confirmed Business Platform setup is unavailable and should remain pending. Messages are explicitly simulated, never sent. Customer contact/consent, official templates, delivery callbacks, retry policy, automatic scheduling and voice follow-up approval are separate next steps. No credit score/lender claim or inventory dependency introduced.

## Validation
42 Node tests and web build pass. Tests include multilingual date/year rollover, invalid/conflicting dates, date/amount separation, explicit no-date option, durable queue, same-merchant boundary, due-time guard, unpaid-check requirement, scoped proposal deduplication, partial-payment stale protection, and full-payment removal. Existing finance/voice enrollment tests remain passing. See VOICE_LEDGER_PHASE1.md for local Python setup and biometric limits.

Browser verification: typed Nikhil ₹100 + three-day promise produced the correct 2026-11-03 confirmation. Draft cancelled; no financial entry created. Screenshot is in this chat workspace outputs/zuno-step2/promise-draft.png. Actual owner voice test remains pending.
