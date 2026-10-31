# QA record — 30 October 2026

## Automated checks
`npm test` checks domain and HTTP behavior. `npm run build` checks the React production bundle. `npm audit --omit=dev` reported zero known vulnerabilities in this installed dependency snapshot; this is not proof of complete security.

## Browser checks
Local preview: http://127.0.0.1:5187.
- Welcome -> prefilled demo credentials -> isolated shop setup -> Home verified.
- Header microphone opens a voice sheet with explicit missing-key status and typed fallback.
- Typed “Sharma ji ko 500 udhaar likho” populated editable name, kind and amount.
- Review disables editing until Edit selected; confirm saves the entry.
- After adding unpaid ₹500, dues rose to ₹10,500 and available cash remained ₹12,000.
- Approval preview explicitly displays simulation-only/no-message/no-payment language.

Additional checks and final artifacts are appended as completed below. Do not interpret implementation alone as a passed browser test.

## Remaining limits
No replacement Sarvam key: actual STT/TTS, audio codec/provider handling, microphone-permission UX and multilingual speech accuracy not live-tested. Real OTP, bank/payment settlement feeds, WhatsApp/Soundbox execution, real lending, ML forecasting/backtesting, real merchant retention/business effects and native installs are not implemented. No external message or payment was sent.

## Final verification additions
- 10 automated tests passed; production bundle built successfully; Prettier check passed.
- Sarvam adapter tests use a mocked transport with a dummy key to check English/Hindi/Hinglish request modes, MIME filename selection, audio response contracts and sanitized upstream failures. These are NOT live provider tests.
- Grouped reminder preview combined two Sharma ji dues into one recipient. Approval produced a simulation-only success result and an audit event, with cash unchanged.
- Partial collection of ₹1,000 against the ₹2,000 Sharma due reduced that due to ₹1,000; total pending moved ₹10,500 -> ₹9,500; Home cash moved ₹12,000 -> ₹13,000. Day-3 projected shortage recomputed ₹18,000 -> ₹17,000.
- A typed cash question returned the updated ₹13,000 grounded balance; Listen remained disabled while key was absent.
- All three language selections were exercised; Hindi UI labels and dates rendered in Devanagari. Dynamic merchant/customer names remain user data.
- Home, voice/review sheets, dues/collection, Plan chart/day table, Profile and Readiness were inspected in browser.
- Compact browser layout measured 354px CSS width and desktop measured 1309px; no document-level horizontal overflow. Header mic present, no bottom mic. Viewport overrides were reset afterward. Other sizes should receive additional device QA before release.
- Direct HTTP requests to /server/domain.js and /.env.example returned 403; /api/health returned 200. No real key was read, transmitted or reused.
- Mobile and desktop Home screenshots saved in the chat outputs folder. The visible shop contains the synthetic QA entries above; use the in-app own-demo reset to restore the original seed if desired.

## Remaining live gate
Replacement Sarvam key is awaited. Owner said they will provide it after dinner. Continue independent work; do not use the deleted key, invent successful audio tests or mark P4 complete prematurely.

## Live Sarvam update — replacement key received
On30 October2026 the replacement key was saved in restricted ignored storage and the app server restarted. /api/health returned voiceConfigured:true. Live synthetic round trips succeeded:
- English: TTS79072 bytes, STT “Record a sale of ₹500.”, amount50000paise.
- Hindi: TTS82834 bytes, STT “शर्मा जी को ₹500 उधार लिखो।” and correct name/type/amount.
- Hinglish: TTS109176 bytes, STT “Sharma ji ko paanch sau rupaye udhaar likho” and correct name/type/amount.
No real merchant audio or personal data was sent. No financial entry was saved by these tests. Live browser microphone permission, capture/playback and noisy input are still unverified. Earlier missing-key blockers in this record are superseded.
