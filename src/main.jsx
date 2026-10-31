import {
  PlanningInputs,
  PlanItemForm,
  ReverseForm,
} from "./components/Planning";
import { money, shortDate, api } from "./lib";
import {
  Brand,
  Section,
  Empty,
  PageTitle,
  CashChart,
  Modal,
} from "./components/Shared";
import PaymentImport from "./components/PaymentImport";
import LoanReadiness from "./components/LoanReadiness";
import EntryForm from "./components/EntryForm";
import Voice from "./components/Voice";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Store,
  Mic,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Plus,
  Wallet,
  BookOpen,
  ChartNoAxesCombined,
  UserRound,
  LayoutGrid,
  Bell,
  Eye,
  EyeOff,
  Check,
  CheckCheck,
  ShieldCheck,
  ArrowDownToLine,
  LogOut,
  Settings,
  Search,
  X,
  Volume2,
  Square,
  RefreshCw,
  TriangleAlert,
  Receipt,
  Send,
  Globe,
  LoaderCircle,
  Clock,
  NotebookPen,
  Leaf,
  CheckCircle2,
} from "lucide-react";
import { translate, languages, kindKey } from "./i18n";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "./styles.css";
const errors = {
  IMPORT_FILE_LIMIT: [
    "CSV must be at most 128 KB.",
    "CSV अधिकतम 128 KB हो।",
    "CSV maximum 128 KB ho.",
  ],
  IMPORT_ROW_LIMIT: [
    "Use 1–200 rows per report.",
    "रिपोर्ट में 1–200 पंक्तियाँ रखें।",
    "Report mein 1–200 rows rakhein.",
  ],
  IMPORT_INVALID_CSV: [
    "Invalid CSV quoting. Check the report format.",
    "CSV प्रारूप गलत है। रिपोर्ट जाँचें।",
    "CSV format galat hai. Report check karein.",
  ],
  IMPORT_COLUMNS: [
    "Choose valid, unique columns for ID, date, amount and status.",
    "ID, तारीख, राशि और स्थिति के सही कॉलम चुनें।",
    "ID, date, amount aur status ke sahi columns chunein.",
  ],
  IMPORT_INVALID_AMOUNT: [
    "Use a positive rupee amount with up to two decimals.",
    "सही रुपये की राशि दें, अधिकतम दो दशमलव।",
    "Sahi rupee amount dein, maximum do decimals.",
  ],
  IMPORT_INVALID_DATE: [
    "Check date format: dates must be valid and not in the future. Names must be at most 80 characters.",
    "तारीख प्रारूप जाँचें; भविष्य की तारीख नहीं। नाम अधिकतम 80 अक्षर।",
    "Date format check karein; future date nahi. Naam maximum 80 characters.",
  ],
  IMPORT_STATUS_REVIEW: [
    "Unrecognized/refund status needs manual review; nothing imported.",
    "अज्ञात/रिफंड स्थिति की जाँच चाहिए; इम्पोर्ट नहीं हुआ।",
    "Unknown/refund status review karein; import nahi hua.",
  ],
  IMPORT_RECORD_TYPE: [
    "Choose payment or settlement correctly. Settlement rows cannot be imported as customer payments.",
    "पेमेंट या सेटलमेंट सही चुनें। सेटलमेंट को ग्राहक पेमेंट न बनाएँ।",
    "Payment ya settlement sahi chunein. Settlement ko customer payment na banayein.",
  ],
  IMPORT_REFERENCE: [
    "A transaction ID / UTR is required (up to 100 characters).",
    "ट्रांज़ैक्शन ID / UTR जरूरी है (अधिकतम 100 अक्षर)।",
    "Transaction ID / UTR chahiye (maximum 100 characters).",
  ],
  IMPORT_DUPLICATE_ROWS: [
    "The file repeats a transaction ID. Remove duplicate rows first.",
    "फ़ाइल में ID दोहराई गई है। पहले दोहराव हटाएँ।",
    "File mein ID repeat hai. Pehle duplicates hatayein.",
  ],
  IMPORT_CONFLICT: [
    "This ID has different saved details. Resolve the report mismatch first.",
    "इस ID के सेव विवरण अलग हैं। रिपोर्ट जाँचें।",
    "Is ID ke saved details alag hain. Report mismatch check karein.",
  ],
  IMPORT_NO_SUCCESSFUL_ROWS: [
    "No successful payment or settlement rows found.",
    "सफल पेमेंट या सेटलमेंट रिकॉर्ड नहीं मिला।",
    "Successful payment ya settlement row nahi mili.",
  ],
  IMPORT_LINK_MISMATCH: [
    "Choose an unreversed UPI entry with the same date and amount.",
    "समान तारीख/राशि की सही UPI एंट्री चुनें।",
    "Same date/amount ki sahi UPI entry chunein.",
  ],
  IMPORT_ALREADY_LINKED: [
    "That entry is already linked to a report payment.",
    "यह एंट्री पहले से पेमेंट से जुड़ी है।",
    "Ye entry pehle se payment se linked hai.",
  ],
  IMPORT_POSSIBLE_DUPLICATE: [
    "Link the matching entry or confirm this is a separate payment.",
    "मिलती एंट्री जोड़ें या अलग पेमेंट की पुष्टि करें।",
    "Matching entry link karein ya separate payment confirm karein.",
  ],
  IMPORT_RECEIPT_CONFIRMATION: [
    "Confirm actual receipt before changing the ledger.",
    "हिसाब बदलने से पहले पैसा मिलने की पुष्टि करें।",
    "Ledger badalne se pehle paisa milna confirm karein.",
  ],
  SETTLEMENT_NOT_INCOME: [
    "Settlement is not new income and cannot be added again.",
    "सेटलमेंट नई कमाई नहीं है; दोबारा न जोड़ें।",
    "Settlement nayi income nahi; dobara nahi jodega.",
  ],

  PAYMENT_CHECK_REQUIRED: [
    "Confirm that payment has not been received before preparing a reminder.",
    "रिमाइंडर से पहले जाँचें कि भुगतान नहीं मिला है।",
    "Reminder se pehle payment na milna confirm karein.",
  ],
  FOLLOW_UP_NOT_DUE: [
    "The promised date has not arrived yet.",
    "वादा की तारीख अभी नहीं आई है।",
    "Promise date abhi nahi aayi.",
  ],

  OWNER_VOICE_MISMATCH: [
    "Voice did not match the enrolled owner. Nothing was recorded. Try again in a quiet place.",
    "आवाज़ मालिक से नहीं मिली। कोई एंट्री नहीं बनी। शांत जगह फिर कोशिश करें।",
    "Awaaz owner se match nahi hui. Koi entry nahi bani. Quiet jagah retry karein.",
  ],
  OWNER_VOICE_UNAVAILABLE: [
    "Local voice service is unavailable. Retry or use the manual form.",
    "लोकल वॉइस सेवा उपलब्ध नहीं। फिर प्रयास करें या फॉर्म उपयोग करें।",
    "Local voice service available nahi. Retry ya manual form use karein.",
  ],
  OWNER_VOICE_NOT_CONFIGURED: [
    "Set up your owner voice first.",
    "पहले अपनी आवाज़ सेट करें।",
    "Pehle apni awaaz set karein.",
  ],
  OWNER_ALREADY_ENROLLED: [
    "An owner voice is already enrolled for this workspace.",
    "इस खाते की आवाज़ पहले से सेट है।",
    "Is workspace ki awaaz pehle se set hai.",
  ],
  VOICE_SAMPLE_DURATION: [
    "Use 10–25 seconds for enrollment; 1–25 seconds for a clear full command.",
    "सेटअप में 10–25 सेकंड; साफ पूरा आदेश 1–25 सेकंड बोलें।",
    "Setup mein 10–25 second; clear poori command 1–25 second bolein.",
  ],
  VOICE_SAMPLE_TOO_QUIET: [
    "Audio is too quiet. Speak clearly and retry.",
    "आवाज़ बहुत धीमी है। साफ बोलकर फिर प्रयास करें।",
    "Awaaz bahut dheemi hai. Clear bolkar retry karein.",
  ],
  VOICE_DRAFT_CHANGED: [
    "Draft changed or expired. Start a new entry.",
    "ड्राफ्ट बदला या समाप्त हुआ। नई एंट्री शुरू करें।",
    "Draft badla ya expire hua. Nayi entry shuru karein.",
  ],
  VOICE_DRAFT_CLOSED: [
    "This entry is closed. Start a new entry.",
    "यह एंट्री पूरी हो चुकी है। नई एंट्री शुरू करें।",
    "Ye entry closed hai. Nayi entry shuru karein.",
  ],

  AUDIO_TOO_LARGE: [
    "Use audio smaller than 5 MB.",
    "5 MB से छोटा ऑडियो चुनें।",
    "5 MB se chhota audio use karein.",
  ],
  MIC_PERMISSION_DENIED: [
    "Microphone was blocked. Enable it in browser settings or upload/type instead.",
    "माइक्रोफ़ोन बंद है। ब्राउज़र में अनुमति दें या लिखें।",
    "Mic blocked hai. Browser settings mein allow karein ya type/upload karein.",
  ],
  REVERSE_COLLECTIONS_FIRST: [
    "Reverse the linked collections first, then correct this unpaid sale.",
    "पहले जुड़ी वसूली वापस करें, फिर उधार सुधारें।",
    "Pehle linked collections reverse karein, phir udhaar correct karein.",
  ],
  ALREADY_REVERSED: [
    "This entry has already been reversed.",
    "यह एंट्री पहले ही वापस की गई है।",
    "Entry pehle reverse ho chuki hai.",
  ],
  INVALID_TEST_ACCESS: [
    "Enter the private test access code shared by the owner.",
    "मालिक से मिला निजी टेस्ट कोड दर्ज करें।",
    "Owner se mila private test code enter karein.",
  ],
  ACTION_ALREADY_DECIDED: [
    "This action already has a different decision. Review action history.",
    "इस कार्रवाई का निर्णय हो चुका है। इतिहास देखें।",
    "Is action ka decision ho chuka hai. History check karein.",
  ],
  VOICE_BUDGET_EXHAUSTED: [
    "Today's voice allowance is used. You can still type.",
    "आज की आवाज़ सीमा पूरी है। लिखकर जारी रखें।",
    "Aaj ka voice allowance complete hai. Type karke continue karein.",
  ],
  VOICE_RATE_LIMITED: [
    "Voice service is busy. Retry shortly or type.",
    "आवाज़ सेवा व्यस्त है। लिखें या थोड़ी देर में प्रयास करें।",
    "Voice service busy hai. Thodi der mein retry karein ya type karein.",
  ],
  PLAN_CHANGED: [
    "This plan changed. Close and reopen it before saving.",
    "योजना बदल गई। बंद करके फिर खोलें।",
    "Plan badal gaya. Close karke phir kholein.",
  ],
  CUSTOMER_CHANGED: [
    "Customer changed. Review the customer again.",
    "ग्राहक फिर जाँचें।",
    "Customer phir check karein.",
  ],
  RATE_LIMITED: [
    "Too many requests. Wait a minute and retry.",
    "एक मिनट रुककर प्रयास करें।",
    "Ek minute rukkar retry karein.",
  ],
  INVALID_ACCESS_KEY: [
    "Invalid workspace recovery key.",
    "रिकवरी कुंजी गलत है।",
    "Recovery key galat hai.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "This request was already used for different details. Reopen the form.",
    "यह अनुरोध दूसरे विवरण के लिए उपयोग हुआ है। फ़ॉर्म फिर खोलें।",
    "Request alag details ke liye use ho chuki. Form phir kholein.",
  ],
  SCHEDULE_MISMATCH: [
    "The recorded amount must match the planning item. Edit the plan first.",
    "दर्ज राशि योजना के बराबर हो। पहले योजना बदलें।",
    "Amount plan item se match hona chahiye. Pehle plan edit karein.",
  ],
  PLAN_ITEM_NOT_FOUND: [
    "This plan item changed. Refresh and review it again.",
    "योजना बदली है। फिर जाँचें।",
    "Plan item badal gaya. Refresh karke check karein.",
  ],
  COLLECTION_EXCEEDS_DUE: [
    "Amount exceeds pending dues.",
    "राशि बकाया से अधिक है।",
    "Amount pending dues se zyada hai.",
  ],
  INVALID_INPUT: [
    "Please check all fields.",
    "सभी फ़ील्ड जाँचें।",
    "Sab fields check karein.",
  ],
  INVALID_DEMO_CREDENTIALS: [
    "Use the demo number and PIN shown below.",
    "नीचे दिए डेमो नंबर और पिन का उपयोग करें।",
    "Neeche wale demo number aur PIN use karein.",
  ],
  INSUFFICIENT_CASH: [
    "Expense exceeds available cash.",
    "खर्च उपलब्ध राशि से अधिक है।",
    "Kharch available cash se zyada hai.",
  ],
  VOICE_NOT_CONFIGURED: [
    "Sarvam key is not configured. Use typing for now.",
    "सर्वम कुंजी उपलब्ध नहीं। अभी लिखकर जारी रखें।",
    "Sarvam key configured nahi. Abhi type karein.",
  ],
  VOICE_PROVIDER_ERROR: [
    "Voice service failed. Check key/credits or use typing.",
    "आवाज़ सेवा विफल। कुंजी/क्रेडिट जाँचें या लिखें।",
    "Voice service failed. Key/credits check karein ya type karein.",
  ],
  VOICE_UNAVAILABLE: [
    "Voice service is unavailable. Please type instead.",
    "आवाज़ सेवा उपलब्ध नहीं। लिखकर जारी रखें।",
    "Voice service unavailable. Type karein.",
  ],
  APPROVAL_EXPIRED: [
    "Approval expired. Prepare a fresh proposal.",
    "अनुमति समाप्त। नया प्रस्ताव बनाएँ।",
    "Approval expire hua. Naya proposal banayein.",
  ],
  PROPOSAL_CHANGED: [
    "Dues changed. Review a fresh proposal.",
    "बकाया बदला। नया प्रस्ताव जाँचें।",
    "Dues badle hain. Naya proposal check karein.",
  ],
  NO_PENDING_DUES: [
    "All dues are collected.",
    "सभी बकाया वसूल हो गए।",
    "Sab udhaar collect ho gaya.",
  ],
};
const icons = {
  sale: ArrowDownLeft,
  expense: ArrowUpRight,
  udhaar: BookOpen,
  collection: CheckCheck,
  receipt: Wallet,
};
function App() {
  const [lang, setLang] = useState(() => {
    const value = localStorage.getItem("munim-language");
    return ["english", "hindi", "hinglish"].includes(value)
      ? value
      : "hinglish";
  });
  const t = (k) => translate(lang, k);
  const [state, setState] = useState(null),
    [loading, setLoading] = useState(true),
    [screen, setScreen] = useState("home"),
    [auth, setAuth] = useState("welcome"),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [health, setHealth] = useState({ voiceConfigured: false }),
    [busy, setBusy] = useState(false),
    [scenario, setScenario] = useState("expected"),
    [online, setOnline] = useState(navigator.onLine),
    [hidden, setHidden] = useState(false),
    [collectPercent, setCollectPercent] = useState(50);
  const spokenAudio = useRef(null);
  useEffect(
    () => () => {
      spokenAudio.current?.pause();
    },
    [],
  );
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const next = await api("/state?scenario=" + scenario);
      if (sequence !== refreshSequence.current) return;
      setState(next);
      setError("");
    } catch (e) {
      if (sequence === refreshSequence.current) {
        if (e.status === 401) setState(null);
        else setError(e.message);
      }
      throw e;
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [scenario]);
  useEffect(() => {
    refresh().catch(() => {});
    api("/health")
      .then(setHealth)
      .catch(() => {});
  }, [refresh]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    };
    const timer = setInterval(update, 60000);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh]);
  useEffect(() => {
    localStorage.setItem("munim-language", lang);
    document.documentElement.lang = lang === "hindi" ? "hi" : "en";
  }, [lang]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const errText = (e) =>
    errors[e]?.[{ english: 0, hindi: 1, hinglish: 2 }[lang]] || t("error");
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (e.status === 401 && state) {
        setState(null);
        setAuth("login");
        setModal(null);
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const navigate = (s) => {
    setScreen(s);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const pendingKey = state ? "munim-pending-entry-" + state.merchant.id : "";
  const readPending = () => {
    try {
      return JSON.parse(localStorage.getItem(pendingKey) || "null");
    } catch {
      return null;
    }
  };
  const openEntry = (initial = {}) => {
    const pending = readPending();
    setModal({
      type: "entry",
      initial: pending
        ? { ...pending, amount: String(pending.amount / 100), pending: true }
        : initial,
    });
  };
  async function prepare() {
    await run(async () =>
      setModal({
        type: "approval",
        proposal: await api("/actions/propose", { method: "POST", body: {} }),
      }),
    );
  }
  async function speak(text) {
    await run(async () => {
      const r = await api("/voice/speak", {
        method: "POST",
        body: { text, language: lang },
      });
      spokenAudio.current?.pause();
      const audio = new Audio("data:audio/wav;base64," + r.audio);
      spokenAudio.current = audio;
      await audio.play();
    });
  }
  const languageControl = (
    <div className="language" aria-label={t("language")}>
      {languages.map(([key, label]) => (
        <button
          key={key}
          className={lang === key ? "selected" : ""}
          aria-pressed={lang === key}
          onClick={() => setLang(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  const errorBox = error && (
    <div className="error-box" role="alert">
      <TriangleAlert size={18} />
      <span>{errText(error)}</span>
      <button
        aria-label={t("cancel")}
        className="icon-button"
        onClick={() => setError("")}
      >
        <X size={16} />
      </button>
    </div>
  );
  function EntryRows({ entries }) {
    return entries.length ? (
      <div className="entries">
        {entries.map((e) => {
          const Icon = icons[e.kind];
          return (
            <button
              className={"entry-row " + (e.reversed ? "reversed-entry" : "")}
              key={e.id}
              onClick={() => setModal({ type: "detail", entry: e })}
            >
              <span className={"entry-icon " + e.kind}>
                <Icon size={21} />
              </span>
              <span className="entry-name">
                <strong>
                  {e.name === "Counter sale"
                    ? t("sale")
                    : e.name === "Supplier"
                      ? t("expense")
                      : e.name}
                </strong>
                <small>
                  {e.reversed ? t("reversed") : t(kindKey(e.kind))} ·{" "}
                  {shortDate(e.date, lang)}
                  {e.source === "report_unverified"
                    ? " · " + t("reportSource")
                    : ""}
                </small>
              </span>
              <span className="entry-value">
                <strong
                  className={
                    e.kind === "expense"
                      ? "negative"
                      : e.kind === "udhaar"
                        ? "muted"
                        : "positive"
                  }
                >
                  {e.kind === "expense" ? "−" : e.kind === "udhaar" ? "" : "+"}
                  {money(e.amount)}
                </strong>
                <small>
                  {e.kind === "udhaar"
                    ? t("pending")
                    : e.method === "cash"
                      ? t("cashMethod")
                      : "UPI"}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    ) : (
      <Empty t={t} />
    );
  }
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <LoaderCircle className="spin" />
        <p>{t("loading")}</p>
      </div>
    );
  if (!state)
    return (
      <div className="auth-shell">
        <div className="auth-language">{languageControl}</div>
        <div className={"auth-page " + (auth === "welcome" ? "welcome" : "")}>
          <Brand light={auth === "welcome"} />
          {auth === "welcome" ? (
            <>
              <div className="welcome-art">
                <div className="orbit orbit1" />
                <div className="orbit orbit2" />
                <div className="ledger-art">
                  <BookOpen size={86} strokeWidth={1.3} />
                  <span className="art-check">
                    <Check size={24} />
                  </span>
                </div>
                <span className="coin">₹</span>
                <div className="small-leaf">
                  <Leaf size={26} />
                </div>
              </div>
              <div className="eyebrow">{t("brandLine")}</div>
              <h1>{t("loginTitle")}</h1>
              <p>{t("loginHint")}</p>
              <button className="primary" onClick={() => setAuth("login")}>
                {t("start")}
                <ArrowRight size={20} />
              </button>
              <small>{t("demoOnly")}</small>
            </>
          ) : (
            <>
              <button className="back" onClick={() => setAuth("welcome")}>
                <ChevronLeft size={18} />
                {t("back")}
              </button>
              <div className="auth-symbol">
                <Store size={34} />
              </div>
              <h1>{t("login")}</h1>
              <p>{t("loginHint")}</p>
              {errorBox}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(async () => {
                    await api("/auth/login", {
                      method: "POST",
                      body: d.get("recoveryKey")?.trim()
                        ? {
                            recoveryKey: d.get("recoveryKey").trim(),
                            testAccessCode:
                              d.get("testAccessCode") || undefined,
                          }
                        : {
                            phone: d.get("phone"),
                            pin: d.get("pin"),
                            testAccessCode:
                              d.get("testAccessCode") || undefined,
                          },
                    });
                    await refresh();
                  });
                }}
              >
                {health.testAccessRequired && (
                  <label>
                    {t("testAccessCode")}
                    <input
                      name="testAccessCode"
                      type="password"
                      autoComplete="off"
                      required
                      maxLength={200}
                    />
                  </label>
                )}
                <label>
                  {t("recoveryKey")}
                  <input
                    name="recoveryKey"
                    type="password"
                    autoComplete="off"
                    maxLength={64}
                    placeholder={t("optionalRecovery")}
                  />
                </label>
                <label>
                  {t("phone")}
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="username"
                    defaultValue="9876543210"
                    required
                    maxLength={10}
                  />
                </label>
                <label>
                  {t("pin")}
                  <input
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    defaultValue="123456"
                    required
                    maxLength={6}
                  />
                </label>
                <button className="primary" disabled={busy || !online}>
                  {busy ? <LoaderCircle className="spin" /> : t("login")}
                  <ArrowRight size={19} />
                </button>
              </form>
              <div className="demo-credentials">
                <ShieldCheck size={17} />
                {t("credentials")}
              </div>
              <small>{t("demoOnly")}</small>
            </>
          )}
        </div>
      </div>
    );
  if (!state.merchant.setup)
    return (
      <div className="setup">
        <Brand />
        {languageControl}
        <div className="auth-symbol">
          <Store size={32} />
        </div>
        <h1>{t("setupTitle")}</h1>
        <p>{t("setupHint")}</p>
        {errorBox}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              await api("/shop", {
                method: "PATCH",
                body: {
                  shop: f.get("shop"),
                  owner: f.get("owner"),
                  language: lang,
                },
              });
              await refresh();
            });
          }}
        >
          <label>
            {t("owner")}
            <input
              required
              minLength={2}
              maxLength={60}
              name="owner"
              defaultValue={state.merchant.owner}
            />
          </label>
          <label>
            {t("shopName")}
            <input
              required
              minLength={2}
              maxLength={60}
              name="shop"
              defaultValue={state.merchant.shop}
            />
          </label>
          <div className="notice">
            {t("demoOnly")} · {money(state.cash)}
          </div>
          <button disabled={busy || !online} className="primary">
            {t("setup")}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    );
  const gap = state.forecast.firstGap;
  return (
    <div className="workspace">
      <aside className="desktop-rail">
        <Brand />
        <span className="rail-caption">{t("railLine")}</span>
        <div className="rail-nav">
          {[
            [Store, "home"],
            [BookOpen, "khata"],
            [ChartNoAxesCombined, "plan"],
            [UserRound, "profile"],
          ].map(([I, k]) => (
            <button
              className={screen === k ? "active" : ""}
              key={k}
              onClick={() => navigate(k)}
            >
              <I size={20} />
              {t(k)}
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <span className="leaf-mark">
            <Leaf size={25} />
          </span>
          <strong>{state.merchant.shop}</strong>
          <small>{t("demoOnly")}</small>
        </div>
      </aside>
      <div className="app">
        <header className="app-header">
          <div className="header-line">
            <div className="greeting">
              <div className="avatar">{state.merchant.owner.charAt(0)}</div>
              <div>
                <small>
                  {t("greeting")}, {state.merchant.owner.split(" ")[0]}
                </small>
                <strong>{state.merchant.shop}</strong>
              </div>
            </div>
            <div className="header-tools">
              <span className="demo-badge">{t("demo")}</span>
              <button
                className="icon-button"
                aria-label={t("notifications")}
                onClick={() => setModal({ type: "updates" })}
              >
                <Bell size={21} />
                <span className="notification-dot" />
              </button>
            </div>
          </div>
          <div className="header-language">{languageControl}</div>
          {(screen === "home" || screen === "khata") && (
            <div className="header-import">
              <button
                className="text-button"
                onClick={() => navigate("payments")}
              >
                <ArrowDownToLine size={16} />
                {t("importPayments")}
              </button>
            </div>
          )}
          {screen === "home" && (
            <button
              className="voice-header"
              onClick={() => setModal({ type: "voice" })}
            >
              <span>
                <span className="voice-label">
                  <span className="live-dot" />
                  {t("voice")}
                </span>
                <small>{t("voiceHint")}</small>
              </span>
              <span className="mic-circle">
                <Mic size={27} />
              </span>
            </button>
          )}
        </header>
        <main id="main-content">
          {!online && (
            <div className="notice warn" role="status">
              {t("offline")}
            </div>
          )}
          {errorBox}
          {screen === "home" && (
            <>
              <section className="balance-card">
                <div className="balance-top">
                  <span>
                    <Wallet size={17} />
                    {t("cash")}
                  </span>
                  <button
                    className="glass-button"
                    aria-label={hidden ? t("showCash") : t("hideCash")}
                    onClick={() => setHidden(!hidden)}
                  >
                    {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <div className="cash-figure">
                  {hidden ? "₹ •••••" : money(state.cash)}
                </div>
                <div className="balance-bottom">
                  <small>
                    <span className="mint-dot" />
                    {t("cashNote")}
                  </small>
                  <button
                    className="balance-add"
                    aria-label={t("entry")}
                    onClick={() => openEntry()}
                  >
                    <Plus size={22} />
                  </button>
                </div>
                <div className="balance-wave" />
              </section>
              <div className="quick-actions">
                {[
                  [Plus, "entry", () => openEntry()],
                  [BookOpen, "dues", () => navigate("dues")],
                  [ChartNoAxesCombined, "cashPlan", () => navigate("plan")],
                  [LayoutGrid, "all", () => setModal({ type: "services" })],
                ].map(([I, key, fn]) => (
                  <button key={key} onClick={fn}>
                    <span>
                      <I size={23} />
                    </span>
                    <strong>{t(key)}</strong>
                  </button>
                ))}
              </div>
              <div className="metrics">
                <div>
                  <span className="metric-label">
                    {t("sales")}
                    <Receipt size={17} />
                  </span>
                  <strong>{money(state.salesToday)}</strong>
                  <small>{t("demoOnly")}</small>
                </div>
                <button onClick={() => navigate("dues")}>
                  <span className="metric-label">
                    {t("pending")}
                    <BookOpen size={17} />
                  </span>
                  <strong>{money(state.pending)}</strong>
                  <small>
                    {new Set(state.dues.map((d) => d.customerId)).size}{" "}
                    {lang === "hindi"
                      ? "ग्राहक खाते"
                      : lang === "hinglish"
                        ? "customer accounts"
                        : "customer accounts"}
                    <ChevronRight size={14} />
                  </small>
                </button>
              </div>
              {gap && (
                <section className="warning-card">
                  <span className="warning-icon">
                    <ChartNoAxesCombined size={22} />
                  </span>
                  <div>
                    <div className="eyebrow">{t("projection")}</div>
                    <h3>{t("gap")}</h3>
                    <p>
                      <strong>{money(-gap.balance)}</strong> ·{" "}
                      {shortDate(gap.date, lang)}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => navigate("plan")}
                    >
                      {t("viewPlan")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              )}
              <Section
                title={t("recent")}
                action={t("seeAll")}
                onAction={() => navigate("khata")}
              />
              <EntryRows entries={state.entries.slice(0, 3)} />
              <div className="quiet-reminder">
                <Send size={18} />
                <span>{t("ready")}</span>
                <button
                  className="text-button"
                  disabled={busy || !online || !state.dues.length}
                  onClick={prepare}
                >
                  {t("review")}
                  <ChevronRight size={15} />
                </button>
              </div>
            </>
          )}
          {screen === "payments" && (
            <PaymentImport
              state={state}
              t={t}
              lang={lang}
              online={online}
              onRefresh={refresh}
              onError={setError}
              onBack={() => navigate("khata")}
            />
          )}
          {screen === "khata" && (
            <Ledger
              state={state}
              t={t}
              lang={lang}
              EntryRows={EntryRows}
              openEntry={openEntry}
              navigate={navigate}
            />
          )}
          {screen === "dues" && (
            <>
              <PageTitle
                title={t("dues")}
                subtitle={t("pending")}
                amount={money(state.pending)}
                back={() => navigate("khata")}
              />
              {state.customers.some((c) => c.legacy) && (
                <p className="notice">{t("legacyCustomers")}</p>
              )}
              {!state.dues.length ? (
                <Empty t={t} />
              ) : (
                state.dues.map((d) => (
                  <div className="due-card" key={d.id}>
                    <div className="due-heading">
                      <span className="customer-avatar">
                        {d.name.charAt(0)}
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        <small>
                          {shortDate(d.date, lang)} · {d.customerId.slice(0, 6)}
                        </small>
                      </div>
                      <strong>{money(d.outstanding)}</strong>
                    </div>
                    <button
                      className="secondary"
                      onClick={() =>
                        openEntry({
                          kind: "collection",
                          dueId: d.id,
                          name: d.name,
                        })
                      }
                    >
                      {t("recordPayment")}
                      <ArrowDownLeft size={17} />
                    </button>
                  </div>
                ))
              )}
              <button
                className="primary"
                disabled={busy || !online || !state.dues.length}
                onClick={prepare}
              >
                <Send size={18} />
                {t("reminder")}
              </button>
            </>
          )}
          {screen === "plan" && (
            <>
              <PageTitle title={t("next14")} subtitle={t("projection")} />
              <div className="segmented">
                {["expected", "conservative"].map((s) => (
                  <button
                    key={s}
                    className={scenario === s ? "active" : ""}
                    onClick={() => setScenario(s)}
                  >
                    {t(s)}
                  </button>
                ))}
              </div>
              <section className="plan-card">
                <span className="eyebrow">{gap ? t("gap") : t("noGap")}</span>
                <h2>
                  {gap
                    ? money(-gap.balance)
                    : money(state.forecast.points.at(-1).balance)}
                </h2>
                <small>
                  {gap
                    ? shortDate(gap.date, lang)
                    : shortDate(state.forecast.points.at(-1).date, lang)}
                </small>
                <CashChart
                  points={state.forecast.points}
                  label={t("projection")}
                />
                <div className="chart-labels">
                  <span>{shortDate(state.forecast.points[0].date, lang)}</span>
                  <span>
                    {shortDate(state.forecast.points.at(-1).date, lang)}
                  </span>
                </div>
              </section>
              <details className="explanation">
                <summary>{t("assumptions")}</summary>
                <p>{t("forecastDynamic")}</p>
              </details>
              <button
                className="secondary"
                onClick={() => navigate("planning")}
              >
                <Settings size={18} />
                {t("planningInputs")}
                <ChevronRight size={17} />
              </button>
              {gap && (
                <section className="whatif-card">
                  <h3>{t("whatIf")}</h3>
                  <p>{t("whatIfHint")}</p>
                  <label htmlFor="collect-percent">
                    {t("collectPercent")}: {collectPercent}% ·{" "}
                    {money(Math.round((state.pending * collectPercent) / 100))}
                  </label>
                  <input
                    id="collect-percent"
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={collectPercent}
                    onChange={(e) => setCollectPercent(Number(e.target.value))}
                  />
                  <div className="action-metric">
                    <span>{t("projectedGap")}</span>
                    <strong>
                      {money(
                        Math.max(
                          0,
                          -gap.balance -
                            Math.round((state.pending * collectPercent) / 100),
                        ),
                      )}
                    </strong>
                  </div>
                </section>
              )}
              <Section title={t("actions")} />
              <div className="card action-card">
                <div className="icon-tile">
                  <Send size={23} />
                </div>
                <h3>{t("ready")}</h3>
                <p>{t("readyNote")}</p>
                <div className="action-metric">
                  <span>{t("pending")}</span>
                  <strong>{money(state.pending)}</strong>
                </div>
                {gap && (
                  <p className="warning-text">
                    {t("remaining")}:{" "}
                    <strong>
                      {money(Math.max(0, -gap.balance - state.pending))}
                    </strong>
                  </p>
                )}
                <button
                  className="primary"
                  disabled={busy || !online || !state.dues.length}
                  onClick={prepare}
                >
                  {t("reminder")}
                  <ArrowRight size={18} />
                </button>
              </div>
              <Section title={t("daily")} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["date", "inflow", "outflow", "balance"].map((k) => (
                        <th key={k}>{t(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.forecast.points.map((p) => (
                      <tr key={p.date}>
                        <td>{shortDate(p.date, lang)}</td>
                        <td>{money(p.inflow)}</td>
                        <td>{money(p.outflow)}</td>
                        <td className={p.balance < 0 ? "negative" : ""}>
                          {money(p.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="secondary" onClick={() => navigate("history")}>
                <Clock size={18} />
                {t("history")}
                <ChevronRight size={17} />
              </button>
            </>
          )}
          {screen === "planning" && (
            <>
              <PageTitle
                title={t("planningInputs")}
                back={() => navigate("plan")}
              />
              <PlanningInputs
                state={state}
                t={t}
                lang={lang}
                onNew={() => setModal({ type: "planItem", item: null })}
                onEdit={(item) => setModal({ type: "planItem", item })}
                onRecord={(item) =>
                  openEntry({
                    kind: item.direction === "out" ? "expense" : item.kind,
                    dueId: item.due_id || undefined,
                    scheduleVersion: item.version,
                    name: item.label,
                    amount: String(item.amount / 100),
                    scheduleId: item.id,
                  })
                }
              />
            </>
          )}
          {screen === "history" && (
            <>
              <PageTitle title={t("history")} back={() => navigate("plan")} />
              {state.audit.length ? (
                state.audit.map((a) => {
                  const detail = JSON.parse(a.detail);
                  return (
                    <div className="audit-row" key={a.id}>
                      <span className="entry-icon">
                        <ShieldCheck size={20} />
                      </span>
                      <div>
                        <strong>
                          {a.event === "reminder_simulated"
                            ? t("sent")
                            : a.event === "action_rejected"
                              ? t("rejected")
                              : a.event === "entry_recorded"
                                ? t("saved")
                                : a.event === "shop_updated"
                                  ? t("shop")
                                  : a.event === "entry_reversed"
                                    ? t("reversed")
                                    : a.event.startsWith("plan_item_")
                                      ? t("planSaved")
                                      : t("demo")}
                        </strong>
                        <small>
                          {new Date(a.created).toLocaleString(
                            lang === "hindi" ? "hi-IN" : "en-IN",
                          )}
                        </small>
                        {detail.amount && <span>{money(detail.amount)}</span>}
                        {a.event === "reminder_simulated" && (
                          <small>{t("simulated")}</small>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p>{t("noHistory")}</p>
              )}
            </>
          )}
          {screen === "readiness" && (
            <LoanReadiness
              state={state}
              t={t}
              onBack={() => navigate("profile")}
              onEntry={() => openEntry({ kind: "expense" })}
              onPlan={() => navigate("planning")}
              onExport={() => {
                window.location.href = "/api/export";
              }}
            />
          )}
          {screen === "profile" && (
            <>
              <div className="profile-hero">
                <div className="avatar large">
                  {state.merchant.owner.charAt(0)}
                </div>
                <h2>{state.merchant.owner}</h2>
                <p>{state.merchant.shop}</p>
                <span className="badge">{t("demo")}</span>
              </div>
              <div className="settings-list">
                {[
                  [Store, "shop", () => setModal({ type: "shop" })],
                  [Leaf, "readiness", () => navigate("readiness")],
                  [
                    ShieldCheck,
                    "recoveryKey",
                    () =>
                      run(async () => {
                        const result = await api("/auth/recovery-key", {
                          method: "POST",
                          body: {},
                        });
                        setModal({ type: "recovery", key: result.key });
                      }),
                  ],
                  [Clock, "history", () => navigate("history")],
                  [ShieldCheck, "privacy", () => setModal({ type: "privacy" })],
                  [
                    ArrowDownToLine,
                    "export",
                    () => {
                      window.location.href = "/api/export";
                    },
                  ],
                ].map(([I, k, fn]) => (
                  <button onClick={fn} key={k}>
                    <I size={20} />
                    <span>{t(k)}</span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
              <div className="settings-language">
                <strong>{t("language")}</strong>
                {languageControl}
              </div>
              <div className="notice">
                <Mic size={18} />
                {health.voiceConfigured ? t("voiceOn") : t("voiceOff")}
              </div>
              <p className="notice">{t("logoutHint")}</p>
              <button
                className="secondary"
                onClick={() =>
                  run(async () => {
                    await api("/auth/logout", { method: "POST", body: {} });
                    ++refreshSequence.current;
                    setModal(null);
                    setState(null);
                    setAuth("login");
                  })
                }
              >
                <LogOut size={18} />
                {t("logout")}
              </button>
              <button
                className="danger-link"
                onClick={() => setModal({ type: "reset" })}
              >
                {t("reset")}
              </button>
            </>
          )}
          {(screen === "home" || screen === "khata") &&
            state.followUps?.length > 0 && (
              <section className="card" aria-label={t("followUp")}>
                <h3>{t("followUp")}</h3>
                {state.followUps.map((f) => (
                  <div className="due-card" key={f.dueId}>
                    <strong>
                      {f.name} · {money(f.outstanding)}
                    </strong>
                    <p>
                      {shortDate(f.dueDate, lang)} ·{" "}
                      {f.status === "payment_check_required"
                        ? t("paymentCheck")
                        : t("promiseDate")}
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        openEntry({
                          kind: "collection",
                          dueId: f.dueId,
                          name: f.name,
                        })
                      }
                    >
                      {t("recordPayment")}
                    </button>
                    {f.status === "payment_check_required" && (
                      <button
                        className="secondary"
                        onClick={() =>
                          setModal({ type: "voice", followUpDueId: f.dueId })
                        }
                      >
                        <Mic size={16} />
                        {t("askZunoFollowUp")}
                      </button>
                    )}
                    {f.status === "payment_check_required" && (
                      <button
                        className="secondary"
                        disabled={busy || !online}
                        onClick={() =>
                          run(async () => {
                            const proposal = await api("/actions/propose", {
                              method: "POST",
                              body: { dueId: f.dueId, unpaidConfirmed: true },
                            });
                            setModal({ type: "approval", proposal });
                          })
                        }
                      >
                        {t("unpaidPrepare")}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}
          <footer className="app-footer">
            <Leaf size={13} /> Munim · {t("demoOnly")}
          </footer>
        </main>
        <nav className="bottom-nav" aria-label="Main navigation">
          {[
            [Store, "home"],
            [BookOpen, "khata"],
            [ChartNoAxesCombined, "plan"],
            [UserRound, "profile"],
          ].map(([I, k]) => (
            <button
              key={k}
              aria-current={screen === k ? "page" : undefined}
              className={screen === k ? "active" : ""}
              onClick={() => navigate(k)}
            >
              <I size={22} />
              <span>{t(k)}</span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "recovery"
              ? t("recoveryKey")
              : modal.type === "planItem"
                ? t("planningInputs")
                : modal.type === "reverse"
                  ? t("reverseEntry")
                  : modal.type === "voice"
                    ? t("voice")
                    : modal.type === "entry"
                      ? t("entry")
                      : modal.type === "approval"
                        ? t("approval")
                        : modal.type === "result"
                          ? t("done")
                          : modal.type === "shop"
                            ? t("shop")
                            : modal.type === "privacy"
                              ? t("privacy")
                              : modal.type === "reset"
                                ? t("reset")
                                : modal.type === "services"
                                  ? t("services")
                                  : modal.type === "detail"
                                    ? t("khata")
                                    : t("notifications")
          }
          onClose={() => {
            if (!busy) {
              setModal(null);
              setError("");
            }
          }}
          closeLabel={t("cancel")}
          busy={busy}
        >
          {errorBox}
          {modal.type === "recovery" && (
            <>
              <p className="notice warn">{t("recoveryHint")}</p>
              <textarea
                aria-label={t("recoveryKey")}
                readOnly
                value={modal.key}
                rows={4}
              />
              <p>{t("copyRecovery")}</p>
            </>
          )}
          {modal.type === "planItem" && (
            <PlanItemForm
              initial={modal.item}
              state={state}
              t={t}
              busy={busy}
              onSave={(v) =>
                run(async () => {
                  await api(
                    modal.item ? "/schedule/" + modal.item.id : "/schedule",
                    { method: modal.item ? "PATCH" : "POST", body: v },
                  );
                  await refresh();
                  setModal(null);
                  setToast(t("planSaved"));
                })
              }
              onCancel={() =>
                run(async () => {
                  await api("/schedule/" + modal.item.id, {
                    method: "PATCH",
                    body: { status: "cancelled", version: modal.item.version },
                  });
                  await refresh();
                  setModal(null);
                  setToast(t("planSaved"));
                })
              }
            />
          )}
          {modal.type === "reverse" && (
            <ReverseForm
              entry={modal.entry}
              t={t}
              busy={busy}
              onReverse={(v) =>
                run(async () => {
                  await api("/entries/" + modal.entry.id + "/reverse", {
                    method: "POST",
                    body: v,
                  });
                  await refresh();
                  setModal(null);
                  setToast(t("reversed"));
                })
              }
            />
          )}
          {modal.type === "entry" && (
            <EntryForm
              t={t}
              lang={lang}
              initial={modal.initial}
              state={state}
              busy={busy}
              online={online}
              onSave={(v) =>
                run(async () => {
                  localStorage.setItem(pendingKey, JSON.stringify(v));
                  try {
                    await api("/entries", { method: "POST", body: v });
                    localStorage.removeItem(pendingKey);
                  } catch (e) {
                    if (e.status && e.status < 500 && e.status !== 429)
                      localStorage.removeItem(pendingKey);
                    throw e;
                  }
                  setModal(null);
                  setToast(t("saved"));
                  try {
                    await refresh();
                  } catch {
                    setToast(t("savedNeedsRefresh"));
                  }
                })
              }
            />
          )}
          {modal.type === "voice" && (
            <Voice
              onViewLedger={(kind) => {
                setModal(null);
                navigate(kind === "udhaar" ? "dues" : "khata");
              }}
              onSaved={async () => {
                try {
                  await refresh();
                  setToast(t("saved"));
                } catch {
                  setToast(t("savedNeedsRefresh"));
                }
              }}
              scenario={scenario}
              t={t}
              lang={lang}
              configured={health.voiceConfigured}
              initialFollowUpDueId={modal.followUpDueId}
              errorText={errText}
              onError={(e) => setError(e)}
              onAction={prepare}
              onEvidence={() => {
                setModal(null);
                navigate("plan");
              }}
              onReview={(intent) =>
                setModal({
                  type: "entry",
                  initial: {
                    ...intent,
                    amount: intent.amount ? String(intent.amount / 100) : "",
                    kind: intent.kind || "",
                  },
                })
              }
            />
          )}
          {modal.type === "approval" && (
            <>
              <span className="badge warn">{t("simulated")}</span>
              <p>{t("approvalNote")}</p>
              <div className="approval-recipients">
                {modal.proposal.payload.map((p) => (
                  <div key={p.id}>
                    <span title={p.customerId}>
                      {p.name}
                      <small className="account-id">
                        {p.customerId?.slice(0, 6)}
                      </small>
                    </span>
                    <strong>{money(p.amount)}</strong>
                    <p className="reminder-draft">{p.message}</p>
                  </div>
                ))}
              </div>
              <button
                className="secondary"
                disabled={!health.voiceConfigured || busy}
                onClick={() =>
                  speak(modal.proposal.payload.map((p) => p.message).join("\n"))
                }
              >
                <Volume2 size={18} />
                {t("hear")}
              </button>
              <button
                className="primary"
                disabled={busy || !online}
                onClick={() =>
                  run(async () => {
                    const result = await api(
                      "/actions/" + modal.proposal.id + "/decision",
                      { method: "POST", body: { approve: true } },
                    );
                    await refresh();
                    setModal({ type: "result", result });
                  })
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Check size={18} />
                )}{" "}
                {t("approve")}
              </button>
              <button
                className="text-button centered"
                disabled={busy || !online}
                onClick={() =>
                  run(async () => {
                    await api("/actions/" + modal.proposal.id + "/decision", {
                      method: "POST",
                      body: { approve: false },
                    });
                    await refresh();
                    setModal(null);
                    setToast(t("rejected"));
                  })
                }
              >
                {t("cancel")}
              </button>
            </>
          )}
          {modal.type === "result" && (
            <div className="result">
              <div className="success-circle">
                <Check size={42} />
              </div>
              <span className="badge">{t("simulated")}</span>
              <h2>{t("sent")}</h2>
              <p>{t("sentHint")}</p>
              <strong>
                {modal.result.payload.length}{" "}
                {lang === "hindi" ? "ग्राहक" : "customers"}
              </strong>
              <button
                className="primary"
                onClick={() => {
                  setModal(null);
                  navigate("history");
                }}
              >
                {t("history")}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          {modal.type === "detail" && (
            <>
              <div className="detail-amount">{money(modal.entry.amount)}</div>
              <div className="readiness-row">
                <span>{t("customer")}</span>
                <strong>{modal.entry.name}</strong>
              </div>
              <div className="readiness-row">
                <span>{t("date")}</span>
                <strong>{shortDate(modal.entry.date, lang)}</strong>
              </div>
              <div className="readiness-row">
                <span>{t("method")}</span>
                <strong>
                  {modal.entry.method === "cash" ? t("cashMethod") : "UPI"}
                </strong>
              </div>
              <span className="badge">
                {modal.entry.source === "matched"
                  ? t("matched")
                  : t("merchant")}
              </span>
              {modal.entry.note && <p>{modal.entry.note}</p>}
              {modal.entry.reversed ? (
                <p className="notice">
                  {t("reversed")}: {modal.entry.reversed}
                </p>
              ) : (
                <button
                  className="secondary"
                  onClick={() =>
                    setModal({ type: "reverse", entry: modal.entry })
                  }
                >
                  {t("reverseEntry")}
                </button>
              )}
              {modal.entry.kind === "udhaar" && (
                <button
                  className="primary"
                  onClick={() => {
                    setModal(null);
                    navigate("dues");
                  }}
                >
                  {t("dues")}
                  <ChevronRight size={17} />
                </button>
              )}
            </>
          )}
          {modal.type === "updates" && (
            <div className="empty">
              <Bell size={32} />
              <p>{t("noUpdates")}</p>
            </div>
          )}
          {modal.type === "services" && (
            <div className="services-grid">
              {[
                [Plus, "entry", () => openEntry()],
                [
                  BookOpen,
                  "dues",
                  () => {
                    setModal(null);
                    navigate("dues");
                  },
                ],
                [
                  ChartNoAxesCombined,
                  "cashPlan",
                  () => {
                    setModal(null);
                    navigate("plan");
                  },
                ],
                [
                  Leaf,
                  "readiness",
                  () => {
                    setModal(null);
                    navigate("readiness");
                  },
                ],
                [Mic, "voice", () => setModal({ type: "voice" })],
                [
                  Clock,
                  "history",
                  () => {
                    setModal(null);
                    navigate("history");
                  },
                ],
              ].map(([I, k, fn]) => (
                <button className="card" key={k} onClick={fn}>
                  <I size={24} />
                  {t(k)}
                </button>
              ))}
            </div>
          )}
          {modal.type === "privacy" && (
            <>
              <ShieldCheck size={35} />
              <p>{t("securityNote")}</p>
              <p>{t("voicePrivacy")}</p>
              <p>{t("readinessNote")}</p>
            </>
          )}
          {modal.type === "shop" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  await api("/shop", {
                    method: "PATCH",
                    body: {
                      owner: f.get("owner"),
                      shop: f.get("shop"),
                      language: lang,
                    },
                  });
                  await refresh();
                  setModal(null);
                });
              }}
            >
              <label>
                {t("owner")}
                <input
                  name="owner"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={state.merchant.owner}
                />
              </label>
              <label>
                {t("shopName")}
                <input
                  name="shop"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={state.merchant.shop}
                />
              </label>
              <button disabled={busy || !online} className="primary">
                {t("save")}
              </button>
            </form>
          )}
          {modal.type === "reset" && (
            <>
              <p>{t("resetHint")}</p>
              <button
                className="primary danger"
                disabled={busy || !online}
                onClick={() =>
                  run(async () => {
                    await api("/demo/reset", { method: "POST", body: {} });
                    ++refreshSequence.current;
                    setModal(null);
                    setState(null);
                    setAuth("login");
                    setModal(null);
                    navigate("home");
                  })
                }
              >
                {t("reset")}
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function Ledger({ state, t, lang, EntryRows, openEntry, navigate }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const rows = state.entries.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      `${e.name} ${e.note}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle title={t("khata")} subtitle={t("demoOnly")} />
      <div className="ledger-toolbar">
        <div className="search">
          <Search size={18} />
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="square-primary"
          aria-label={t("entry")}
          onClick={() => openEntry()}
        >
          <Plus size={24} />
        </button>
      </div>
      <div className="filters">
        {["all", "sale", "expense", "udhaar", "collection", "receipt"].map(
          (k) => (
            <button
              key={k}
              className={filter === k ? "active" : ""}
              onClick={() => setFilter(k)}
            >
              {k === "all"
                ? lang === "hindi"
                  ? "सभी"
                  : lang === "hinglish"
                    ? "Sab"
                    : "All"
                : t(k)}
            </button>
          ),
        )}
      </div>
      <button className="dues-banner" onClick={() => navigate("dues")}>
        <span>
          <BookOpen size={20} />
          {t("pending")}
        </span>
        <strong>
          {money(state.pending)}
          <ChevronRight size={18} />
        </strong>
      </button>
      {!rows.length && <Empty t={t} />}
      {[...new Set(rows.map((e) => e.date))].map((date) => {
        const book = state.dayBooks?.find((b) => b.date === date);
        return (
          <section key={date} className="day-ledger">
            <div className="day-ledger-heading">
              <h3>
                {shortDate(date, lang)} · {date.slice(0, 4)}
              </h3>
              {book && <small>{t("dayTotals")}</small>}
            </div>
            {book && (
              <div className="day-ledger-totals">
                <span>
                  {t("cashIn")} <strong>{money(book.inflow)}</strong>
                </span>
                <span>
                  {t("cashOut")} <strong>{money(book.outflow)}</strong>
                </span>
                <span>
                  {t("creditSales")} <strong>{money(book.creditSales)}</strong>
                </span>
              </div>
            )}
            <EntryRows entries={rows.filter((e) => e.date === date)} />
          </section>
        );
      })}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
