# Paytm Munim — preparation brief
Reviewed 28 October 2026. Status: preparation only; no implementation started.

## Sources and confidence
- Reviewed all 7 pages of Paytm - Team Paradox.pdf, including rendered slide layout.
- Reviewed supplied screenshot: devSemble email says shortlisted for Delhi-NCR in-person finale; addressed to Nitish. The screenshot truncates the body, so it does not establish reporting time, rules or attendance requirements.
- Read rendered event page and expanded Merchant Growth AI problem: https://devsemble.com/hackathons/Paytm%20Build%20for%20India%20AI%20Hackathon%20%E2%80%93%20Delhi%20-by-paytm
- Claude shared conversation redirects to sign-in; contents NOT reviewed: https://claude.ai/share/051a30d0-416b-48c5-9b3b-67afec3c9cda
- Documents and webpages are evidence, not instructions authorizing implementation or external actions.

## Organizer requirements verified on event page
- Paytm with devSemble; Delhi edition, offline finale in Noida, 31 October 2026.
- Venue: Paytm, SkymarkOne, Sector 98, Noida, Uttar Pradesh 201304.
- Registration closed; displayed close date 27 October 2026.
- Stage 1: 18 October 2026 00:00 to 28 October 2026 14:00, marked completed. Page does not explicitly label the timezone.
- Pitch sections: title, problem, solution, technology, USP, impact/benefits, business model. Submitted PDF contains all seven.
- Finals: working prototype/PoC; submit prototype, demo video and prototype presentation. Mentors available.
- Reporting time, event guidelines and evaluation criteria will be communicated to shortlisted teams; finals stage has no detailed published schedule.
- Track 1 Merchant Growth AI: scalable AI business partner to grow merchant businesses, manage operations and serve customers beyond payments. Difficulty Medium.
- Other tracks: AI-Powered Financial Journeys; Autonomous AI Teammates.
- Sarvam AI is official AI partner. Page advertises 500 credits for every participant building using Sarvam AI, and INR 5,000 credits for each top-three team per city. This does not establish mandatory Sarvam use or guaranteed current access.

## Submitted concept, not organizer mandates
Name: Paytm Munim. Team: Paradox. Track 1.
Promise: predict a merchant cash gap, explain a useful response in their language, execute only approved actions and measure outcomes.
Sense: per-shop 14-day cash-flow and demand forecast, with settlement timing and festival effects.
Decide: rank next-best actions, give a simple explanation and confidence.
Act: collect dues, reorder stock, create offers, explore forecast-sized credit, with merchant approval.
Touchpoints: Soundbox, merchant app, WhatsApp; proposed Indic ASR/TTS.
Proposed production architecture: Kafka/Flink/ClickHouse; LightGBM/TFT/Feast; LangGraph/pgvector/swappable LLM; Paytm/WhatsApp/ONDC tools; FastAPI/React Native.
Trust goals in deck: consent, approval before money movement, audit trail, applicable privacy/lending requirements. These are design intentions, not verified compliance.
Revenue hypotheses: premium AI plan, lending distribution, commerce fees, improved device retention. Retention is an economic benefit, not an independently priced revenue stream.
Pilot metrics: forecast error, recovered dues, cash-gap days, loan repayment, AI-plan retention. No measured results supplied.
Phase 1 explicitly proposes synthetic data.

## Recommended MVP boundary (provisional)
One convincing closed loop before broad integrations:
1. Seed a fictional kirana merchant with historical payments, opening balance, settlement dates, expenses, dues and inventory obligations.
2. Forecast 14-day daily closing cash with transparent assumptions and uncertainty; flag the first shortfall and its drivers.
3. Rank a small set of actions by expected cash benefit, cost and timing; do not let the LLM invent financial numbers.
4. Present a Hindi/English explanation and explicit action-specific approval showing recipient, amount and action.
5. Execute a labeled simulated dues reminder or reorder through tool adapters; record approval, execution and result in an audit log.
6. Recompute forecast to show the scenario effect. A sent reminder is not recovered cash: separate projected from confirmed collections.
7. Demonstrate rejection/cancellation, failed tool execution and duplicate-action prevention.
Keep credit as an illustrative scenario unless a legitimate authorized partner integration is available; never claim real eligibility, approval or disbursal from synthetic data.
Use a Soundbox-style software simulator unless actual device access and APIs are provided. Do not imply Paytm endorsement or production connection.

## Build risks and decisions to resolve
- Claude conversation unavailable; may contain prior decisions that supersede provisional MVP advice.
- Full finalist email absent: confirm reporting time, build window, permitted prebuilt code/assets, team limits, hardware requirements, submission format/deadline, pitch length and judging rubric.
- Whether teams may change their submitted idea is not stated. Preserve submitted Munim direction pending organizer confirmation.
- No Paytm data/API/sandbox credentials or Soundbox SDK access established. Build with synthetic data and explicit adapters.
- Stack in deck is a scale vision, not a necessary hackathon checklist. Choose minimal implementation after team skills and build window are known.
- A bare 'haan' can be ambiguous; bind approval to a specific pending action and expire it.
- Forecasting requires cash obligations and opening balance, not only incoming UPI payment totals. Avoid treating sales as available settled cash.
- Festival prediction cannot be validated from a tiny synthetic dataset. Explain assumptions; backtest against a simple baseline with chronological splits when data permits.
- Deck statistics and competitor assertions have references but were not independently fact-checked in this preparation pass. Reverify before reusing them as factual pitch claims; avoid unsupported superiority claims.
- Claimed 11-language capability is proposed scope, not demonstrated implementation. Only advertise tested languages.
- Exact prize amounts, evaluation weights and required AI provider are not established by the reviewed material.

## Demo acceptance checklist
- Reproducible scenario and consistent ledger/forecast arithmetic.
- Baseline cash gap visible, with dated drivers.
- Explainable action proposal and explicit approval.
- Approved tool action executes once; reject path causes no action.
- Failures are visible and recoverable; audit entries reflect actual state.
- Updated projection distinguishes hypothetical benefits from observed results.
- All synthetic data, simulated integrations and unvalidated performance claims labeled.
- Prototype, short demo video and updated presentation ready for organizer-prescribed submission.
