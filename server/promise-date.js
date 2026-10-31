import { day } from "./core.js";
const counts = {
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
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
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
};
const dateValid = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
export function extractPromise(text, today = day()) {
  const normalized = text
    .toLowerCase()
    .replace(/[०-९]/g, (c) => "०१२३४५६७८९".indexOf(c));
  const matches = [
    ...normalized.matchAll(
      /\b\d{4}-\d{2}-\d{2}\b|(?:\d+|[\p{L}\p{M}]+)\s+(?:days?|din|दिन|weeks?|hafte|हफ्ते)\s*(?:baad|mein|me|बाद|में)?|day after tomorrow|परसों|parson|tomorrow|कल|\bkal\b|today|आज|\baaj\b/gu,
    ),
  ];
  if (matches.length !== 1)
    return { date: null, text, found: matches.length > 0 };
  const match = matches[0],
    value = match[0];
  let date;
  if (/^\d{4}-/.test(value)) date = dateValid(value) ? value : null;
  else {
    const pair = value.match(
      /^(\d+|[\p{L}\p{M}]+)\s+(days?|din|दिन|weeks?|hafte|हफ्ते)/u,
    );
    let days = pair
      ? (/^\d+$/.test(pair[1]) ? Number(pair[1]) : counts[pair[1]]) *
        (/week|hafte|हफ्ते/.test(pair[2]) ? 7 : 1)
      : /day after|परसों|parson/.test(value)
        ? 2
        : /tomorrow|कल|kal/.test(value)
          ? 1
          : 0;
    if (Number.isInteger(days) && days >= 0 && days <= 365) {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      date = d.toISOString().slice(0, 10);
    }
  }
  if (!date || date < today) return { date: null, text, found: true };
  return {
    date,
    text:
      normalized.slice(0, match.index) +
      " " +
      normalized.slice(match.index + value.length),
    found: true,
  };
}
export const noPromise = (text) =>
  /^(?:skip|no date|date nahi|pata nahi|not decided|तारीख नहीं|पता नहीं|बाद में)$/u.test(
    text.toLowerCase().trim(),
  );
