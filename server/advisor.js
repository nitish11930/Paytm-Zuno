import { snapshot } from "./domain.js";
import { understand, localUnderstanding } from "./understanding.js";
const index = (l) => ({ english: 0, hindi: 1, hinglish: 2 })[l] ?? 2;
const pick = (l, items) => items[index(l)];
export function renderAnswer(db, m, parsed, language, scenario = "expected") {
  const data = snapshot(db, m, scenario);
  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
      n / 100,
    );
  if (parsed.negated)
    return {
      answer: pick(language, [
        "No action has been taken. You can review a new plan whenever you want.",
        "कोई कार्रवाई नहीं की गई है। जब चाहें नया प्रस्ताव जाँच सकते हैं।",
        "Koi action nahi hua. Jab chahein naya plan review karein.",
      ]),
      type: "help",
      engine: parsed.model ? "sarvam" : "local",
    };
  if (parsed.topic === "entry") {
    const matching = data.dues.filter(
      (d) =>
        d.name.toLowerCase().replace(/\s+/g, " ").trim() ===
        parsed.name.toLowerCase().replace(/\s+/g, " ").trim(),
    );
    return {
      ...parsed,
      dueId: matching.length === 1 ? matching[0].id : undefined,
      needsReview: true,
    };
  }
  const gap = data.forecast.firstGap;
  const shortage = gap ? Math.max(0, -gap.balance) : 0;
  const drivers = gap
    ? data.forecast.obligations.filter((o) => o.date <= gap.date)
    : [];
  const driverText = drivers
    .map((o) => `${o.label}: ${fmt(o.amount)}`)
    .join("; ");
  const residual = Math.max(0, shortage - data.pending);
  let answer;
  switch (parsed.topic) {
    case "cash":
      answer = pick(language, [
        `Your available funds are ${fmt(data.cash)} rupees, based on recorded settled receipts and expenses.`,
        `दर्ज प्राप्ति और खर्च के आधार पर उपलब्ध राशि ${fmt(data.cash)} रुपये है।`,
        `Recorded receipts aur kharch ke hisaab se available funds ${fmt(data.cash)} rupaye hain.`,
      ]);
      break;
    case "dues":
      answer = pick(language, [
        `Pending customer dues total ${fmt(data.pending)} rupees. They are excluded from available cash until collected.`,
        `ग्राहकों का बकाया ${fmt(data.pending)} रुपये है। वसूली दर्ज होने तक यह उपलब्ध राशि नहीं है।`,
        `Pending udhaar ${fmt(data.pending)} rupaye hai. Collection ke baad hi ye available cash hoga.`,
      ]);
      break;
    case "sales":
      answer = pick(language, [
        `Recorded sales today are ${fmt(data.salesToday)} rupees, including unpaid sales. Sales are different from cash received.`,
        `आज दर्ज बिक्री ${fmt(data.salesToday)} रुपये है, जिसमें उधार बिक्री शामिल है। बिक्री और प्राप्त राशि अलग हैं।`,
        `Aaj recorded bikri ${fmt(data.salesToday)} rupaye hai, udhaar mila kar. Bikri aur received cash alag hain.`,
      ]);
      break;
    case "why":
      answer = gap
        ? pick(language, [
            `The first projected shortage is ${fmt(shortage)} rupees on ${gap.date}. Scheduled payments are ${driverText}. These are compared with your current funds and dated expected receipts. This is an editable cash plan, not a guaranteed prediction.`,
            `पहली अनुमानित कमी ${gap.date} को ${fmt(shortage)} रुपये है। तय भुगतान: ${driverText}। इन्हें वर्तमान राशि और अपेक्षित प्राप्तियों से तुलना की गई है। यह बदल सकने वाली योजना है, गारंटी नहीं।`,
            `Pehli projected kami ${gap.date} ko ${fmt(shortage)} rupaye hai. Scheduled payments: ${driverText}. Current funds aur expected receipts se compare kiya hai. Ye editable plan hai, guarantee nahi.`,
          ])
        : pick(language, [
            "No shortage is projected in the next 14 days with your current planning inputs.",
            "वर्तमान योजना के अनुसार अगले 14 दिन में कमी नहीं है।",
            "Current planning ke hisaab se 14 din mein kami nahi hai.",
          ]);
      break;
    case "plan":
    case "reminders":
      answer = gap
        ? pick(language, [
            `Start by reviewing dues of ${fmt(data.pending)} rupees. Even if every due is collected before ${gap.date}, ${fmt(residual)} rupees of the first shortage remain. Review payment dates with suppliers; any deferral needs their agreement. No money will move and reminders require your approval.`,
            `पहले ${fmt(data.pending)} रुपये का बकाया जाँचें। ${gap.date} से पहले पूरा वसूल होने पर भी पहली कमी में ${fmt(residual)} रुपये बाकी रहेंगे। भुगतान तिथि बदलने के लिए सप्लायर की सहमति चाहिए। रिमाइंडर आपकी अनुमति से ही होगा।`,
            `Pehle ${fmt(data.pending)} rupaye ke dues review karein. ${gap.date} se pehle poori collection ho tab bhi ${fmt(residual)} rupaye ka pehla gap bachega. Supplier ki permission se payment date review karein. Reminder aapki approval se hoga.`,
          ])
        : pick(language, [
            `No cash gap is currently projected. You can still review ${fmt(data.pending)} rupees in pending dues.`,
            `अभी कमी का अनुमान नहीं। ${fmt(data.pending)} रुपये का बकाया जाँच सकते हैं।`,
            `Abhi gap projected nahi. ${fmt(data.pending)} rupaye ke dues review kar sakte hain.`,
          ]);
      break;
    case "forecast":
      answer = gap
        ? pick(language, [
            `Your editable cash plan shows the first shortfall of ${fmt(shortage)} rupees on ${gap.date}. Scheduled receipts are assumptions, not money already received.`,
            `नकदी योजना में पहली कमी ${gap.date} को ${fmt(shortage)} रुपये है। अपेक्षित प्राप्ति अनुमान है, प्राप्त पैसा नहीं।`,
            `Cash plan mein pehli kami ${gap.date} ko ${fmt(shortage)} rupaye hai. Expected receipts assumptions hain, received paisa nahi.`,
          ])
        : pick(language, [
            "No gap is projected with current inputs.",
            "वर्तमान जानकारी में कमी का अनुमान नहीं।",
            "Current inputs mein gap projected nahi.",
          ]);
      break;
    default:
      answer = pick(language, [
        "I can record entries, explain cash and sales, review dues and help you plan payments. Ask “Why is my cash short?” or “Record a 500 rupee sale”. Real loans, stock orders and WhatsApp delivery are not connected.",
        "मैं एंट्री दर्ज करने, बिक्री, बकाया और नकदी योजना में मदद कर सकता हूँ। पूछें “राशि कम क्यों पड़ेगी?” या “500 रुपये की बिक्री लिखो”। वास्तविक ऋण, स्टॉक ऑर्डर और व्हाट्सऐप जुड़े नहीं हैं।",
        "Main entries, cash, bikri, dues aur payment planning mein help kar sakta hoon. Poochein “cash kam kyun padega?” ya “500 rupaye ki bikri likho”. Real loans, stock orders aur WhatsApp connected nahi hain.",
      ]);
  }
  return {
    answer,
    type: parsed.topic,
    engine: parsed.model ? "sarvam" : "local",
    evidence: {
      cash: data.cash,
      pending: data.pending,
      salesToday: data.salesToday,
      gap,
      drivers,
      remainingGap: residual,
    },
    suggestedAction:
      ["plan", "reminders"].includes(parsed.topic) && data.dues.length
        ? "review_reminders"
        : undefined,
  };
}
// Synchronous deterministic path used by offline fallback tests.
export function voiceAnswer(db, m, text, language) {
  return renderAnswer(db, m, localUnderstanding(text), language);
}
export async function assistantAnswer(
  db,
  m,
  text,
  language,
  previousTopic,
  scenario = "expected",
) {
  return renderAnswer(
    db,
    m,
    await understand(text, previousTopic),
    language,
    scenario,
  );
}
