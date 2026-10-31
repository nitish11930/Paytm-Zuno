import { extractPromise, noPromise } from "./promise-date.js";
import { randomUUID } from "node:crypto";
import {
  addEntry,
  dues,
  DomainError,
  followUpQueue,
  propose,
} from "./domain.js";
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
    "haan save kar do",
    "han save kar do",
    "haan save kardo",
    "haan record kar do",
    "haan record kardo",
    "haan likh lo",
    "yes record it",
    "save it",
    "record it",
    "proceed and save",
    "हाँ सेव कर दो",
    "हां सेव कर दो",
    "हाँ रिकॉर्ड करो",
    "हाँ रिकॉर्ड कर दो",
    "हां लिख लो",
    "हाँ दर्ज कर दो",
    "जी सेव कर दो",
    "जी हाँ सेव करो",
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
        "What is the total amount in rupees?",
        "कुल कितने रुपये?",
        "Total kitne rupaye?",
      ]),
    ];
  if (!draft.name?.trim())
    return [
      "name",
      choose(language, [
        "Whose name should I record?",
        "किसके नाम लिखूँ?",
        "Kiske naam likhun?",
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
        "When will they repay the dues? Is a date agreed?",
        "उधार कब लौटाएँगे? कोई तारीख तय है?",
        "Udhaar kab lautayenge? Koi date tay hai?",
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
  const command = input.text.replace(
    /^\s*(?:hey\s+zuno|hi\s+zuno|हे\s*ज़?ूनो|हे\s*जूनो)[,\s:।-]*/iu,
    "",
  );
  const promise = extractPromise(command);
  const wantsFollowUp =
    !!input.followUpDueId ||
    (/remind|follow[ -]?up|रिमाइंडर|याद दिला/i.test(command) &&
      !/likh|लिख|record.*transaction|दर्ज/i.test(command));
  const parsed =
    !row && !wantsFollowUp && !cancel(input.text)
      ? await understand(promise.date ? promise.text : command)
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
    } else if (
      draft.flow === "followup" ||
      (row.stage === "new" && wantsFollowUp)
    ) {
      if (row.stage === "new") {
        const pending = followUpQueue(db, m).filter(
          (d) => d.status === "payment_check_required",
        );
        const compact = (value) =>
          normalize(value)
            .replace(/[^\p{L}\p{M}\p{N}]/gu, "")
            .replace(/ji$/u, "");
        const matches = input.followUpDueId
          ? pending.filter((d) => d.dueId === input.followUpDueId)
          : pending.filter((d) => compact(command).includes(compact(d.name)));
        if (matches.length !== 1) {
          draft = { flow: "followup" };
          row.stage = "manual";
          answer = choose(input.language, [
            "Choose the due customer from payment follow-ups so I do not contact the wrong person.",
            "गलत व्यक्ति को याद न दिलाऊँ, इसलिए फॉलो-अप में सही बकाया चुनें।",
            "Galat person ko reminder na jaye, follow-ups mein sahi due chunein.",
          ]);
        } else {
          const target = matches[0];
          draft = {
            flow: "followup",
            dueId: target.dueId,
            name: target.name,
            amount: target.outstanding,
          };
          row.stage = "payment_check";
          answer = choose(input.language, [
            `${draft.name} has ${amountText(draft.amount)} due. Was payment received, including cash?`,
            `${draft.name} के ${amountText(draft.amount)} बाकी हैं। नकद सहित भुगतान मिला था क्या?`,
            `${draft.name} ke ${amountText(draft.amount)} baaki hain. Cash mila kar payment mila tha kya?`,
          ]);
        }
      } else {
        const current = followUpQueue(db, m).find(
          (d) =>
            d.dueId === draft.dueId && d.status === "payment_check_required",
        );
        if (!current) {
          row.stage = "complete";
          answer = choose(input.language, [
            "This due is no longer awaiting follow-up. No reminder was sent.",
            "यह बकाया अब फॉलो-अप में नहीं है। कोई रिमाइंडर नहीं गया।",
            "Ye due ab follow-up mein nahi hai. Koi reminder nahi gaya.",
          ]);
        } else if (row.stage === "payment_check") {
          const value = words(input.text);
          if (
            /^(?:nahi|nahin|nahi diye|nahi diya|nahi mile|payment nahi aaya|not received|no|नहीं|नहीं दिए|नहीं दिया|पैसे नहीं दिए|भुगतान नहीं मिला|नहीं मिले)(?:\s+(?:bhej do|bhejdo|reminder bhejo|whatsapp par|whatsapp pe|भेज दो))*$/u.test(
              value,
            )
          ) {
            const proposal = propose(db, m, {
              dueId: draft.dueId,
              unpaidConfirmed: true,
            });
            draft.amount = proposal.payload[0].amount;
            draft.proposalId = proposal.id;
            draft.message = proposal.payload[0].message;
            row.stage = "reminder_review";
            answer = choose(input.language, [
              `${draft.message} Shall I send this on WhatsApp?`,
              `${draft.message} यह WhatsApp पर भेजना है?`,
              `${draft.message} Ye WhatsApp par bhejna hai?`,
            ]);
          } else if (
            /^(?:haan|ha|yes|received|mil gaye|हाँ|हां|मिल गए|मिल गये)$/u.test(
              value,
            )
          ) {
            row.stage = "manual";
            answer = choose(input.language, [
              "Please record the actual amount and Cash/UPI collection in the payment form. I have not changed the balance.",
              "कितनी राशि और नकद/UPI मिला, वसूली फॉर्म में दर्ज करें। मैंने राशि नहीं बदली है।",
              "Actual amount aur Cash/UPI collection form mein record karein. Maine balance nahi badla.",
            ]);
          } else
            answer = choose(input.language, [
              "Please say received or not received. I will not assume from silence.",
              "मिला या नहीं मिला कहें। चुप रहने को जवाब नहीं मानूँगा।",
              "Mila ya nahi mila bolein. Chup rehne ko jawab nahi manunga.",
            ]);
        } else if (row.stage === "reminder_review") {
          const saved = db
            .prepare("SELECT * FROM proposals WHERE id=? AND merchant=?")
            .get(draft.proposalId, m);
          if (
            current.outstanding !== draft.amount ||
            !saved ||
            saved.expires < Date.now()
          ) {
            row.stage = "payment_check";
            answer = choose(input.language, [
              "The amount or draft changed. Check payment again before preparing a fresh reminder.",
              "राशि या ड्राफ्ट बदला है। नया रिमाइंडर बनाने से पहले भुगतान फिर जाँचें।",
              "Amount ya draft badla hai. Naye reminder se pehle payment phir check karein.",
            ]);
          } else if (
            /whatsapp|व्हाट्सएप|व्हाट्सऐप|भेज दो|bhej\s*do|send/i.test(
              input.text,
            )
          ) {
            row.stage = "delivery_pending";
            answer = choose(input.language, [
              "Your reminder draft is saved. WhatsApp is not connected, so no message has been sent.",
              "रिमाइंडर ड्राफ्ट सेव है। WhatsApp जुड़ा नहीं है, इसलिए कोई संदेश नहीं भेजा गया।",
              "Reminder draft saved hai. WhatsApp connected nahi, isliye koi message nahi bheja gaya.",
            ]);
          } else
            answer = choose(input.language, [
              "Review the draft, then say send on WhatsApp or cancel.",
              "ड्राफ्ट जाँचें, फिर WhatsApp पर भेजो या रद्द करो कहें।",
              "Draft check karein, phir WhatsApp par bhejo ya cancel bolein.",
            ]);
        } else
          answer = choose(input.language, [
            "No WhatsApp message has been sent. The saved draft is waiting for integration.",
            "WhatsApp संदेश नहीं गया है। सेव ड्राफ्ट कनेक्शन की प्रतीक्षा में है।",
            "WhatsApp message nahi gaya. Saved draft integration ka wait kar raha hai.",
          ]);
      }
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

export function currentVoiceLedger(db, m) {
  const row = db
    .prepare(
      "SELECT * FROM voice_drafts WHERE merchant=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(m);
  if (!row || row.stage === "cancelled" || row.expires < Date.now())
    return null;
  const turn = db
    .prepare(
      "SELECT result FROM voice_turns WHERE merchant=? AND json_extract(result,'$.draftId')=? AND json_extract(result,'$.version')=? ORDER BY rowid DESC LIMIT 1",
    )
    .get(m, row.id, row.version);
  return turn ? JSON.parse(turn.result) : null;
}
