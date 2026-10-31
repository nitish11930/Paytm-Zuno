import test from "node:test";
import assert from "node:assert/strict";
import { database, seed } from "../server/domain.js";
import { voiceAnswer } from "../server/advisor.js";
test("advisor answers grounded cash, dues and forecast questions in selected language", () => {
  const db = database(":memory:");
  seed(db, "m");
  assert.match(
    voiceAnswer(db, "m", "How much cash?", "english").answer,
    /12,000/,
  );
  assert.match(
    voiceAnswer(db, "m", "pending udhaar kitna hai", "hinglish").answer,
    /10,000/,
  );
  assert.match(voiceAnswer(db, "m", "cash ki kami?", "hindi").answer, /18,000/);
  assert.equal(
    voiceAnswer(db, "m", "Sharma ji ko 500 udhaar", "english").kind,
    "udhaar",
  );
  db.close();
});
