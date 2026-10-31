# Munim: real-user and pitch-alignment audit

Date: 30 October 2026, India time. This review includes code inspection, isolated financial/API tests, live Sarvam calls and browser interaction. It is not a production certification or a claim that every device/utterance has been tested.

## Verdict
The original version was a functioning ledger demo with meaningful gaps in the claimed business-partner loop: fixed planning assumptions, narrow keyword answers, no saved-entry correction and poor same-device return behavior after sign-out. Those gaps have been addressed in this pass. The result is a working local operational prototype; the entire production pitch is not implemented.

## Findings fixed
1. Forecasts depended on hardcoded daily receipts. Added persisted dated planning inputs (expected receipts/payments), editable amounts/dates, cancellation and explicit source labeling. The engine recomputes all 14 days, carries overdue payments forward and does not assume overdue receipts arrived. It remains deterministic planning, not learned ML forecasting.
2. Completed planned receipts/payments could be double counted. A linked recording completes the schedule item atomically; reversal restores it. Expected receipt alone never adds actual funds.
3. Generic cash answers were returned for why/advice questions. Added real Sarvam-105B structured intent understanding, schema validation and a visible local fallback. Actual finance explanations and numbers remain server-generated from scoped records. Why shows source supplier/rent payments; advice shows pending dues and residual shortfall. Model output never executes an action.
4. Small chat completion budgets could be consumed by thinking, producing null visible content. Disabled thinking using documented null reasoning setting and validated strict structured responses. Malformed/unavailable model responses degrade to basic assistant, visibly labeled.
5. Received udhaar could be misclassified as new debt. Collection detection takes precedence in fallback; structured model topic/kind reconciliation preserves event versus question distinction. Collection still requires a linked due and explicit review.
6. Saved mistakes had no correction flow. Added audited reversal; money, dues, sales and readiness exclude reversed records. Credit with active linked collections cannot be reversed first. Existing history is retained.
7. Retried writes with changed amounts could silently return the first record. Added payload-conflict checks, including scheduled-item identity, while preserving true duplicate replay safety.
8. Sign-out/login generated a new shop. Added an HTTP-only same-device demo-resume cookie (30 days) separate from the 24-hour session. Different browsers/devices remain isolated. This is demo continuity, not real account authentication.
9. Sales-today excluded unpaid sales. It now includes recorded paid and unpaid sales, excluding reversed entries, while cash remains separate.
10. Browser audio lifecycle and user feedback were incomplete. Replies now have native playback controls, explicit speaking state, recording locks, abort/track cleanup and typed/upload fallbacks. Speech input prepares a reviewable entry or answers a question; it does not directly save money records.
11. Added a collection-percentage what-if slider. At existing shop state, 50% of ₹9,700 gives ₹4,850 assumed collection and ₹12,150 remaining first gap; 100% gives ₹7,300. These are hypothetical, never silently applied to cash.

## Verified evidence
- 19 automated tests pass; production build and formatting check pass.
- Isolated test: move ₹12,000 rent from day3 to day6. Day3 gap changes ₹18,000 -> ₹6,000 with actual cash unchanged; later dates still include the payment.
- Isolated test: record a linked ₹500 expected receipt. Cash rises once, schedule completes, projection does not double count; reversing restores schedule and funds.
- Isolated tests: partial/over collection, financial reversal, reversal dependency guard, stale/expired/rejected/replayed approvals, tenant isolation, malformed dates, idempotency payload conflict and device resume.
- Live model: why question understood as why, incoming ₹500 udhaar understood as collection, explicit cash-gap advice understood as plan, negative reminder request does not trigger action.
- Browser: existing shop survives server restart with ₹13,000 funds and ₹9,700 dues preserved; sales corrected to ₹1,900 including unpaid sales.
- Browser: why reply cites Supplier payment ₹26,000 and Shop rent ₹12,000 and the actual ₹17,000 first gap.
- Browser playback: a generated reply loaded with readyState4, progressed to full duration16.057s, ended paused without a media error. This proves browser playback progression, not listening quality in every language.
- Browser: editable planning form, date/amount fields, projection-only warning, cancel path and what-if slider were inspected.
- Browser audio upload was blocked by the browser permission gate. No bypass was attempted. Actual microphone capture, microphone permission grant/denial and noisy-shop audio were not physically verified in this pass. Previous synthetic TTS->STT tests succeeded in English/Hindi/Hinglish; this is a separate narrower claim.
- A second localhost QA origin was also blocked. Mutation tests therefore used isolated in-memory shops; existing browser financial records were not altered by this audit.

## Pitch alignment
| Pitch commitment | Current implementation | Remaining work |
|---|---|---|
| Sense merchant cash position | Persisted ledger, actual funds, dated receipts/expenses and 14-day plan | Real Paytm/UPI settlement ingestion; history-trained forecast; calibrated uncertainty; festival-aware data |
| Explain next useful action | Grounded explanation, source records, dues/remaining gap, conditional supplier-date review, what-if | Validated action ranking across inventory/promotions/credit; real-world outcome evaluation |
| Own-language interaction | Real Sarvam STT/TTS adapters and structured understanding; selected English/Hindi/Hinglish | Real handset microphone and noisy/accent tests, larger language suite |
| Merchant approval | Explicit proposal review, approve/reject, expiry/freshness/replay protection | Voice 'haan' authorization is not implemented; current confirmation is button-based |
| Act for merchant | Reminder simulation and actual internal ledger/schedule operations | Real WhatsApp delivery, Paytm tools, ONDC/distributor ordering and confirmed receipts from providers |
| Track effects | Collections, projections, reversals and audit update consistently | Live external outcome reconciliation and pilot metrics |
| Readiness | Evidence-backed record coverage/reconciliation indicators | Lender validation; no credit score or eligibility should be claimed |

## Real-merchant readiness
Suitable for demonstrating the internal workflow using synthetic records. Not yet suitable for a merchant's only accounting system or real financial/customer data: public demo credentials, device-local demo resume, no bank/provider reconciliation, no production recovery/identity flow, no trained validated prediction and no operational/compliance review. No loan, real message, stock order or payment was executed.

## Next priorities
1. Owner-run microphone check on target phone/browser, explicitly allowing recording, testing one Hindi, English and Hinglish example; check close/stop behavior.
2. Add sandbox-backed real message delivery and receipts only when legitimate credentials/consents are available.
3. Obtain chronological merchant data with permission; backtest against a simple baseline before claiming predictive accuracy or festival intelligence.
4. Replace demo identity with real auth/recovery, deployment-specific HTTPS/origins, retention and access controls before real users/data.
5. Record the demo with clear live/simulated/future labels; update pitch claims to match the table above.

Technical reference for structured Sarvam chat and the null-content reasoning-budget limitation:
https://docs.sarvam.ai/api/token-factory/chat-completions
https://docs.sarvam.ai/api/token-factory/models/sarvam-105b
