import { DomainError } from "./domain.js";
import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
let activeCalls = 0,
  budgetDb;
function reserveProviderCall() {
  if (activeCalls >= 4) throw new DomainError("VOICE_RATE_LIMITED", 429);
  const limit = Number(process.env.SARVAM_DAILY_CALL_LIMIT || 500);
  if (!Number.isInteger(limit) || limit < 1)
    throw new DomainError("VOICE_UNAVAILABLE", 503);
  if (!budgetDb) {
    const budgetPath =
      process.env.SARVAM_BUDGET_DB || "data/provider-budget.sqlite";
    if (budgetPath !== ":memory:")
      mkdirSync(dirname(budgetPath), { recursive: true, mode: 0o700 });
    budgetDb = new Database(budgetPath);
    if (budgetPath !== ":memory:") chmodSync(budgetPath, 0o600);
    budgetDb.exec(
      "CREATE TABLE IF NOT EXISTS usage(day TEXT PRIMARY KEY,calls INTEGER NOT NULL)",
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  budgetDb.transaction(() => {
    const used =
      budgetDb.prepare("SELECT calls FROM usage WHERE day=?").get(today)
        ?.calls || 0;
    if (used >= limit) throw new DomainError("VOICE_BUDGET_EXHAUSTED", 429);
    budgetDb
      .prepare(
        "INSERT INTO usage VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1",
      )
      .run(today);
  })();
  activeCalls++;
}
const nums = {
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  पचास: 50,
  सौ: 100,
  हजार: 1000,
  हज़ार: 1000,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifty: 50,
  hundred: 100,
  thousand: 1000,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  panch: 5,
  sau: 100,
  hazar: 1000,
  hazaar: 1000,
};
export function parseIntent(text) {
  let s = text.toLowerCase().replace(/[०-९]/g, (c) => "०१२३४५६७८९".indexOf(c));
  const digits = s.match(/(?:₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/g) || [];
  const words = s.replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/);
  let total = 0,
    current = 0,
    seen = false;
  for (const w of words) {
    const n = nums[w];
    if (n) {
      seen = true;
      if (n === 100) current = (current || 1) * 100;
      else if (n === 1000) {
        total += (current || 1) * 1000;
        current = 0;
      } else current += n;
    }
  }
  const amount =
    digits.length === 1
      ? Math.round(Number(digits[0].replace(/[^\d.]/g, "")) * 100)
      : digits.length > 1
        ? null
        : seen
          ? (total + current) * 100
          : null;
  let kind =
    /collection|received|receive|vasooli|wasooli|mil gaye|mile|\u0935\u0938\u0942\u0932\u0940|\u092e\u093f\u0932 \u0917\u090f|\u092e\u093f\u0932\u0947/.test(
      s,
    )
      ? "collection"
      : /udhaar|unpaid|baaki|\u0909\u0927\u093e\u0930|\u092c\u093e\u0915\u0940/.test(
            s,
          )
        ? "udhaar"
        : /expense|kharch|\bpaid\b|payment diya|\u0916\u0930\u094d\u091a/.test(
              s,
            )
          ? "expense"
          : /sale|bikri|\u092c\u093f\u0915\u094d\u0930\u0940|\u092c\u0947\u091a\u093e/.test(
                s,
              )
            ? "sale"
            : null;
  let name =
    (s.match(/(?:^|\s)([\p{L}\p{M}]+(?:\s+ji|\s+जी)?)\s+(?:ko|को|se|से)/u) ||
      [])[1] || "";
  if (!name)
    name = (s.match(/(?:from|to)\s+([a-z]+(?:\s+ji)?)/) || [])[1] || "";
  return {
    kind,
    amount,
    name: name ? name.charAt(0).toUpperCase() + name.slice(1) : "",
    method: /upi|यूपीआई/.test(s) ? "upi" : "cash",
    needsReview: true,
    ambiguous: digits.length > 1,
    transcript: text,
  };
}
export async function sarvamRequest(path, options) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new DomainError("VOICE_NOT_CONFIGURED", 503);
  reserveProviderCall();
  try {
    const response = await fetch(`https://api.sarvam.ai${path}`, {
      ...options,
      headers: { ...options.headers, "api-subscription-key": key },
      signal: AbortSignal.timeout(25000),
    }).catch(() => {
      throw new DomainError("VOICE_UNAVAILABLE", 502);
    });
    if (!response.ok)
      throw new DomainError(
        response.status === 429 ? "VOICE_RATE_LIMITED" : "VOICE_PROVIDER_ERROR",
        502,
      );
    return await response.json();
  } finally {
    activeCalls--;
  }
}
export async function transcribe(file, language) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype }),
    file.mimetype === "audio/mp4"
      ? "recording.mp4"
      : file.mimetype === "audio/wav"
        ? "recording.wav"
        : file.mimetype === "audio/ogg"
          ? "recording.ogg"
          : "recording.webm",
  );
  form.append("model", process.env.SARVAM_STT_MODEL || "saaras:v3");
  form.append("language_code", language === "english" ? "en-IN" : "hi-IN");
  form.append("mode", language === "hinglish" ? "translit" : "transcribe");
  const r = await sarvamRequest("/speech-to-text", {
    method: "POST",
    body: form,
  });
  if (typeof r.transcript !== "string")
    throw new DomainError("VOICE_PROVIDER_ERROR", 502);
  return {
    transcript: r.transcript,
    requestId: r.request_id,
    intent: parseIntent(r.transcript),
  };
}
export async function speak(text, language) {
  const r = await sarvamRequest("/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
      speaker: "shubh",
      language_code: language === "english" ? "en-IN" : "hi-IN",
    }),
  });
  if (!r.audios?.[0]) throw new DomainError("VOICE_PROVIDER_ERROR", 502);
  return { audio: r.audios[0], requestId: r.request_id };
}
