import { extractPromise, noPromise } from "./promise-date.js";
import { randomUUID } from "node:crypto";
import { addEntry, dues, DomainError } from "./domain.js";
import { understand } from "./understanding.js";
import { parseIntent } from "./voice.js";

const choose = (language, values) =>
  values[{ english: 0, hindi: 1, hinglish: 2 }[language] ?? 2];
const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/(?:\s+ji|\s+जी)$/u, "")
    .replace(/\s+/g, " ")
    .trim();
const words = (text) =>
  text
    .toLowerCase()
    .replace(/[.!।,?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const confirm = (text) =>
  [
    "confirm save",
    "yes save",
    "haan save karo",
    "han save karo",
    "हाँ सेव करो",
    "हां सेव करो",
    "हाँ दर्ज करो",
  ].includes(words(text));
const cancel = (text) =>
  [
    "cancel",
    "cancel entry",
    "radd karo",
    "रद्द करो",
    "रद्द",
    "mat likho",
    "मत लिखो",
  ].includes(words(text));
const amountText = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value / 100);
const kinds = {
  sale: ["received sale", "प्राप्त बिक्री", "received sale"],
  expense: ["paid expense", "दिया गया खर्च", "paid kharch"],
  udhaar: ["unpaid sale", "उधार बिक्री", "udhaar bikri"],
  collection: [
    "collection of existing dues",
    "पुराने उधार की वसूली",
    "purane udhaar ki collection",
  ],
};
export function initializeVoiceLedger(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS voice_drafts(id TEXT PRIMARY KEY,merchant TEXT NOT NULL REFERENCES merchants(id),version INTEGER NOT NULL,payload TEXT NOT NULL,stage TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS voice_turns(merchant TEXT NOT NULL REFERENCES merchants(id),request_key TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(merchant,request_key));`);
}
function response(row, language, answer, engine = "local") {
  return {
    type: "voice-ledger",
    draftId: row.id,
    version: row.version,
    stage: row.stage,
    draft: JSON.parse(row.payload),
    answer,
    engine,
  };
}
function question(db, m, draft, language) {
  if (!draft.kind)
    return [
      "kind",
      choose(language, [
        "Is this a received sale, paid expense, unpaid sale, or collection of existing dues?",
        "यह प्राप्त बिक्री, खर्च, उधार बिक्री या पुराने उधार की वसूली है?",
        "Ye received sale, kharch, udhaar bikri ya purane udhaar ki collection hai?",
      ]),
    ];
  if (
    !Number.isSafeInteger(draft.amount) ||
    draft.amount <= 0 ||
    draft.amount > 100000000
  )
    return [
      "amount",
      choose(language, [
        "What is the total amount in rupees? Say only the amount, not item quantities.",
        "कुल कितने रुपये? केवल राशि बताएँ, सामान की गिनती नहीं।",
        "Total kitne rupaye? Sirf amount batayein, item quantity nahi.",
      ]),
    ];
  if (!draft.name?.trim())
    return [
      "name",
      choose(language, [
        "Whose name should I record? For a counter sale, say Counter.",
        "किसके नाम लिखूँ? काउंटर बिक्री के लिए काउंटर कहें।",
        "Kiske naam likhun? Counter sale ke liye Counter bolein.",
      ]),
    ];
  const customers = db
    .prepare("SELECT id,name FROM customers WHERE merchant=?")
    .all(m)
    .filter((c) => normalize(c.name) === normalize(draft.name));
  if (draft.kind === "udhaar") {
    if (customers.length > 1)
      return [
        "manual",
        choose(language, [
          "Several customer accounts have this name. Use the review form to choose the right account.",
          "इस नाम के कई खाते हैं। सही ग्राहक चुनने के लिए फॉर्म खोलें।",
          "Is naam ke kai accounts hain. Sahi customer chunne ke liye form kholein.",
        ]),
      ];
    if (customers.length === 1) {
      draft.customerId = customers[0].id;
      draft.name = customers[0].name;
    }
  }
  if (draft.kind === "collection") {
    const matches = dues(db, m).filter(
      (d) => normalize(d.name) === normalize(draft.name),
    );
    if (matches.length !== 1)
      return [
        "manual",
        choose(language, [
          "I cannot safely choose a single outstanding entry. Use the review form to choose the due.",
          "एक सही बकाया नहीं चुन पाया। फॉर्म में बकाया चुनें।",
          "Ek sahi due nahi chun paya. Form mein due chunein.",
        ]),
      ];
    if (draft.amount > matches[0].outstanding)
      return [
        "amount",
        choose(language, [
          `Only ${amountText(matches[0].outstanding)} remains. What amount was received?`,
          `केवल ${amountText(matches[0].outstanding)} बाकी है। कितनी राशि मिली?`,
          `Sirf ${amountText(matches[0].outstanding)} baaki hai. Kitna mila?`,
        ]),
      ];
    draft.remainingBefore = matches[0].outstanding;
    draft.dueId = matches[0].id;
    draft.name = matches[0].name;
  }
  if (draft.kind === "udhaar" && !draft.promiseCaptured)
    return [
      "promise",
      choose(language, [
        "When did they promise to pay? Say, for example, in three days, or say no date.",
        "कब देने का वादा किया? जैसे तीन दिन बाद कहें, या तारीख नहीं कहें।",
        "Kab dene ka promise kiya? Jaise teen din baad bolein, ya date nahi bolein.",
      ]),
    ];
  if (draft.kind !== "udhaar" && !draft.method)
    return [
      "method",
      choose(language, [
        "Was the money actually received or paid in cash or UPI? Say Cash or UPI only if completed. Otherwise cancel.",
        "पैसा वास्तव में नकद या UPI से मिला या दिया? पूरा हो चुका है तो नकद या UPI कहें, वरना रद्द करें।",
        "Paisa actually cash ya UPI se mila ya diya? Complete hua ho toh Cash ya UPI bolein, warna cancel karein.",
      ]),
    ];
  const summary = `${draft.name} · ${amountText(draft.amount)} · ${choose(language, kinds[draft.kind])}${draft.kind === "udhaar" ? (draft.dueDate ? ` · ${draft.dueDate}` : choose(language, [" · no promised date", " · तारीख तय नहीं", " · date tay nahi"])) : ` · ${draft.method.toUpperCase()}`}`;
  return [
    "confirm",
    choose(language, [
      `${summary}. Say “confirm save” to record, or “cancel”. Nothing is saved yet.`,
      `${summary}। दर्ज करने के लिए “हाँ सेव करो” या “रद्द करो” कहें। अभी सेव नहीं हुआ है।`,
      `${summary}. Record karne ke liye “haan save karo” ya “cancel” bolein. Abhi save nahi hua.`,
    ]),
  ];
}
export async function voiceLedgerTurn(db, m, input) {
  const signature = JSON.stringify(input);
  const previous = db
    .prepare("SELECT * FROM voice_turns WHERE merchant=? AND request_key=?")
    .get(m, input.requestKey);
  if (previous) {
    if (previous.input !== signature)
      throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
    return JSON.parse(previous.result);
  }
  let row = input.draftId
    ? db
        .prepare("SELECT * FROM voice_drafts WHERE id=? AND merchant=?")
        .get(input.draftId, m)
    : null;
  if (input.draftId && !row) throw new DomainError("ACTION_NOT_FOUND", 404);
  if (row && (row.version !== input.version || row.expires < Date.now()))
    throw new DomainError("VOICE_DRAFT_CHANGED", 409);
  const promise = extractPromise(input.text);
  const parsed =
    !row && !cancel(input.text)
      ? await understand(promise.date ? promise.text : input.text)
      : null;
  return db.transaction(() => {
    // Recheck after external model latency; concurrent turns cannot overwrite a newer draft.
    const replay = db
      .prepare("SELECT * FROM voice_turns WHERE merchant=? AND request_key=?")
      .get(m, input.requestKey);
    if (replay) {
      if (replay.input !== signature)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      return JSON.parse(replay.result);
    }
    if (row) {
      row = db
        .prepare("SELECT * FROM voice_drafts WHERE id=? AND merchant=?")
        .get(input.draftId, m);
      if (row.version !== input.version || row.expires < Date.now())
        throw new DomainError("VOICE_DRAFT_CHANGED", 409);
    } else
      row = {
        id: randomUUID(),
        merchant: m,
        version: 0,
        payload: "{}",
        stage: "new",
        expires: Date.now() + 1800000,
      };
    if (["saved", "cancelled"].includes(row.stage))
      throw new DomainError("VOICE_DRAFT_CLOSED", 409);
    let draft = JSON.parse(row.payload),
      answer;
    if (cancel(input.text)) {
      row.stage = "cancelled";
      answer = choose(input.language, [
        "Cancelled. No entry was saved.",
        "रद्द किया। कोई एंट्री सेव नहीं हुई।",
        "Cancel kiya. Koi entry save nahi hui.",
      ]);
    } else if (row.stage === "confirm" && confirm(input.text)) {
      const before = JSON.stringify(draft);
      const [stage, prompt] = question(db, m, draft, input.language);
      if (stage !== "confirm" || before !== JSON.stringify(draft)) {
        row.stage = stage;
        answer = prompt;
      } else {
        const entry = addEntry(db, m, {
          ...draft,
          method: draft.method || "cash",
          requestKey: row.id,
        });
        draft.entryId = entry.id;
        row.stage = "saved";
        answer = choose(input.language, [
          `Saved: ${draft.name}, ${amountText(draft.amount)}.`,
          `${draft.name}, ${amountText(draft.amount)} दर्ज कर लिया।`,
          `${draft.name}, ${amountText(draft.amount)} record kar liya.`,
        ]);
      }
    } else {
      if (row.stage === "new" && parsed?.topic === "entry" && !parsed.negated) {
        draft = {
          kind: parsed.kind,
          amount: parsed.amount,
          name: parsed.name || "",
          ...(parsed.kind === "udhaar" && promise.date
            ? { dueDate: promise.date, promiseCaptured: true }
            : {}),
        };
        if (/\bupi\b|यूपीआई/i.test(input.text)) draft.method = "upi";
        else if (/\bcash\b|नकद|नकदी/i.test(input.text)) draft.method = "cash";
      } else if (row.stage === "kind") {
        const t = words(input.text);
        draft.kind = /udhaar|उधार|unpaid/.test(t)
          ? "udhaar"
          : /collection|वसूली|vasooli/.test(t)
            ? "collection"
            : /expense|खर्च|kharch/.test(t)
              ? "expense"
              : /sale|बिक्री|bikri/.test(t)
                ? "sale"
                : undefined;
      } else if (row.stage === "amount") {
        const n = parseIntent(input.text).amount;
        // Only amount-only replies are accepted locally; do not add quantities or dates.
        const value = input.text
          .toLowerCase()
          .replace(/(?:rupees|rupaye|रुपये|रुपए|rs\.?)/g, " ")
          .trim();
        const allowed = new Set([
          "one",
          "two",
          "three",
          "four",
          "five",
          "six",
          "seven",
          "eight",
          "nine",
          "ten",
          "fifty",
          "hundred",
          "thousand",
          "ek",
          "do",
          "teen",
          "char",
          "paanch",
          "panch",
          "sau",
          "hazar",
          "hazaar",
          "एक",
          "दो",
          "तीन",
          "चार",
          "पांच",
          "पाँच",
          "छह",
          "सात",
          "आठ",
          "नौ",
          "दस",
          "पचास",
          "सौ",
          "हजार",
          "हज़ार",
        ]);
        draft.amount =
          /^[\d०-९.,₹\s]+$/.test(value) ||
          value.split(/\s+/).every((w) => allowed.has(w))
            ? n
            : null;
      } else if (row.stage === "promise") {
        if (promise.date) {
          draft.dueDate = promise.date;
          draft.promiseCaptured = true;
        } else if (noPromise(input.text)) {
          draft.promiseCaptured = true;
          delete draft.dueDate;
        }
      } else if (row.stage === "name") {
        draft.name = input.text.trim().slice(0, 80);
      } else if (row.stage === "method") {
        const t = words(input.text);
        if (["cash", "nakad", "नकद", "नकदी"].includes(t)) draft.method = "cash";
        else if (["upi", "यूपीआई"].includes(t)) draft.method = "upi";
      }
      const [stage, prompt] = question(db, m, draft, input.language);
      row.stage = stage;
      answer = prompt;
    }
    row.version++;
    row.payload = JSON.stringify(draft);
    db.prepare(
      "INSERT INTO voice_drafts VALUES(@id,@merchant,@version,@payload,@stage,@expires) ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload,stage=excluded.stage",
    ).run(row);
    const result = response(
      row,
      input.language,
      answer,
      parsed?.model ? "sarvam" : "local",
    );
    db.prepare("INSERT INTO voice_turns VALUES(?,?,?,?)").run(
      m,
      input.requestKey,
      signature,
      JSON.stringify(result),
    );
    return result;
  })();
}
