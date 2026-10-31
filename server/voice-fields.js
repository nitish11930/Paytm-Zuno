import { parseIntent } from "./voice.js";
import { extractPromise, noPromise } from "./promise-date.js";

const allowedAmountWords = new Set([
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  "hundred", "thousand",
  "ek", "do", "teen", "char", "paanch", "panch", "chhe", "saat", "aath", "nau", "das",
  "bees", "tees", "chalis", "chaalis", "pachas", "pachaas", "sath", "saath", "sattar", "assi", "nabbe",
  "sau", "hazar", "hazaar",
  "एक", "दो", "तीन", "चार", "पांच", "पाँच", "छह", "सात", "आठ", "नौ", "दस",
  "बीस", "तीस", "चालीस", "पचास", "साठ", "सत्तर", "अस्सी", "नब्बे",
  "सौ", "हजार", "हज़ार",
]);

export function applyVoiceFields(draft, stage, text, parsed) {
  const promise = extractPromise(text);
  const words = (s) =>
    s
      .toLowerCase()
      .replace(/[.!।,?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (
    ["new", "kind"].includes(stage) &&
    parsed?.topic === "entry" &&
    !parsed.negated
  ) {
    draft = {
      ...draft,
      kind: parsed.kind || draft.kind,
      amount: parsed.amount ?? draft.amount,
      name: parsed.name || draft.name || "",
      ...((parsed.kind === "udhaar" || draft.kind === "udhaar") && promise.date
        ? { dueDate: promise.date, promiseCaptured: true }
        : {}),
    };
    if (/\bupi\b|यूपीआई/i.test(text)) draft.method = "upi";
    else if (/\bcash\b|नकद|नकदी/i.test(text)) draft.method = "cash";
  } else if (stage === "kind") {
    const t = words(text);
    const matchedKind = /udhaar|उधार|unpaid|baaki|बाकी/.test(t)
      ? "udhaar"
      : /collection|वसूली|vasooli|vasuli|wasooli|mila|mil gaye/.test(t)
        ? "collection"
        : /expense|खर्च|kharch|kharcha|diya/.test(t)
          ? "expense"
          : /sale|बिक्री|bikri|bikree|becha/.test(t)
            ? "sale"
            : undefined;
    if (matchedKind) draft.kind = matchedKind;
    const n = parseIntent(text);
    if (n.amount && !draft.amount) draft.amount = n.amount;
    if (n.name && !draft.name) draft.name = n.name;
    if (promise.date && draft.kind === "udhaar") {
      draft.dueDate = promise.date;
      draft.promiseCaptured = true;
    }
  } else if (stage === "amount") {
    const n = parseIntent(text).amount;
    const value = text
      .toLowerCase()
      .replace(/(?:rupees|rupaye|रुपये|रुपए|rs\.?)/g, " ")
      .trim();
    draft.amount =
      /^[\d०-९.,₹\s]+$/.test(value) ||
      value.split(/\s+/).every((w) => allowedAmountWords.has(w))
        ? n
        : null;
  } else if (stage === "promise") {
    if (promise.date) {
      draft.dueDate = promise.date;
      draft.promiseCaptured = true;
    } else if (noPromise(text)) {
      draft.promiseCaptured = true;
      delete draft.dueDate;
    }
  } else if (stage === "name") {
    const clean = text
      .trim()
      .replace(/(?:ke\s*naam(?:\s*likho)?|ko|ka|ki|likho)$/iu, "")
      .trim()
      .slice(0, 80);
    draft.name = clean || text.trim().slice(0, 80);
  } else if (stage === "method") {
    const t = words(text);
    if (/cash|nakad|नकद|नकदी/i.test(t)) draft.method = "cash";
    else if (/upi|यूपीआई/i.test(t)) draft.method = "upi";
  }

  return draft;
}
