# Phase 1: conversational ledger + local owner voice prototype

The app brand remains Munim. Zuno refers to the voice-ledger concept; no global rename was requested conclusively.

## Implemented
- Home header microphone opens Voice ledger by default; business questions remain a separate mode.
- Authenticated, merchant-scoped persistent conversation drafts, 30-minute expiration, optimistic versions and per-turn idempotency. Typed turns are a deliberate manual test/fallback, not biometric authentication.
- Missing type, amount, name and completed cash/UPI method are requested one at a time. Unpaid sales never increase available cash. Ambiguous customer accounts/collection dues require manual selection.
- Summary must be explicitly confirmed using `confirm save`, `haan save karo`, or `हाँ सेव करो`. Bare yes does not save. Cancellation saves no entry. Corrections currently use cancel/new entry or the manual form, not free-form conversational editing.
- Entry commits use the existing transactional finance rules; saved answers include entry ID, and cash/dues refresh. Lost-response retries reuse request IDs. Audio responses are cached against request fields plus an audio hash.
- Local Python SpeechBrain ECAPA-TDNN speaker template setup and per-command matching before Sarvam STT. Python is a long-lived child over private pipes, not an exposed web service. Audio decoding uses bundled ffmpeg; clips are temporary and deleted. Enrollment requires 10–25s, commands 3–25s; basic energy/duration checks reject short/quiet clips.
- Explicit enrollment consent. Speaker vectors are AES-GCM encrypted with merchant-bound associated data, in owner-only ignored privacy/voiceprints. Local key, model and Python environment never belong in Git. Raw enrollment audio is not sent to Sarvam. Accepted command audio still uses configured Sarvam STT; replies use Sarvam TTS.

## Run
Existing local machine: `npm run dev`. Python venv and model are installed under ignored privacy/. First matching request after a restart loads the CPU model.
Fresh machine: Python 3.12; create privacy/voice-venv and install python/owner_voice/requirements.txt. Node locates privacy/voice-venv/bin/python. Model downloads from the official speechbrain/spkrec-ecapa-voxceleb repository into privacy/voice-model. Do not copy someone else's enrolled biometric template or encryption key.
Open header mic -> consent checkbox -> Set up my voice -> tap mic -> speak alone 10–25 seconds -> stop. Only the human owner should enroll their actual voice. After setup, record a ledger instruction, listen/read each follow-up and speak the explicit final confirmation. Browser mic permission is required; no always-on listening, no automatic rearming.

## Limits and validation
This is **speaker similarity**, not liveness, verified legal identity, or secure voice login. A replay, voice clone, mixed-speaker clip or noisy shop can fool/reject a matcher. Threshold 0.70 is a configurable prototype heuristic, not calibrated performance. Enrollment is one sample, authorized by the current demo workspace session; session compromise can affect security. PIN/verified production identity, anti-spoofing, repeated enrollment samples, actual-owner/impostor/noise evaluation and a retention policy and stronger identity controls are further gates. An enrolled owner can explicitly remove their local template in the voice panel; removal locks recording until new enrollment.
Model load + 192-dimensional inference passed on synthetic noise (not speaker accuracy evidence). Python mocked-vector tests cover encrypted storage, matching threshold rejection, cross-workspace isolation and ciphertext tampering. 39 Node tests pass. Node tests cover clarification, explicit confirmation, replay, stale/cross-merchant drafts and fail-closed unmatched audio before transcription. Real owner enrollment/microphone round trip remains pending.
No live Paytm ingestion, background WhatsApp sending, inventory, validated credit score, due-date conversational extraction or voice-only reminder approval is claimed. Existing manual date entry/follow-up queue is separate. No Python service is included in the existing Docker/Android deployment configuration yet; those remain unfinished hosting preparation.
Conversation text/draft payloads are persisted in the private SQLite DB and included in own-workspace archive/reset. Speaker templates are separate biometric files, excluded from archives. Store and manage them privately. Closing a modal discards unsent recording, not an already submitted server request.

Browser QA: English ledger panel, explicit consent/locked mic, actual Sarvam understanding of a typed ₹200 Nikhil udhaar draft, and cancel-with-no-entry verified. No human voice enrollment or microphone permission was exercised. Python encrypted-vector unit test passed; model CPU inference smoke passed. Local user financial data was backed up and not changed by this browser QA.
