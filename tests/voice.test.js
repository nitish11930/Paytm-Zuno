process.env.SARVAM_BUDGET_DB = ":memory:";
import test from "node:test";
import assert from "node:assert/strict";
import { transcribe, speak } from "../server/voice.js";
test("Sarvam adapters bind language, keep key server-side and decode expected contracts", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "test-only-not-a-real-key";
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () =>
        url.endsWith("/speech-to-text")
          ? { transcript: "Sharma ji ko 500 udhaar", request_id: "test-stt" }
          : { audios: ["dGVzdA=="], request_id: "test-tts" },
    };
  };
  try {
    const file = {
      buffer: Buffer.from("synthetic audio fixture"),
      mimetype: "audio/mp4",
    };
    const english = await transcribe(file, "english");
    assert.equal(english.intent.amount, 50000);
    assert.equal(calls[0].options.body.get("language_code"), "en-IN");
    assert.equal(calls[0].options.body.get("file").name, "recording.mp4");
    assert.equal(
      calls[0].options.headers["api-subscription-key"],
      "test-only-not-a-real-key",
    );
    await transcribe(file, "hindi");
    assert.equal(calls[1].options.body.get("language_code"), "hi-IN");
    assert.equal(calls[1].options.body.get("mode"), "transcribe");
    await transcribe(file, "hinglish");
    assert.equal(calls[2].options.body.get("mode"), "translit");
    const audio = await speak("Test balance", "english");
    assert.equal(audio.audio, "dGVzdA==");
    const body = JSON.parse(calls[3].options.body);
    assert.equal(body.language_code, "en-IN");
    assert.equal(body.speaker, "shubh");
    global.fetch = async () => ({ ok: false, status: 403 });
    await assert.rejects(() => speak("Test", "hindi"), /VOICE_PROVIDER_ERROR/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = originalKey;
  }
});
