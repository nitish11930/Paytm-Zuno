import React, { useState, useRef } from "react";
import { LoaderCircle, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { money } from "../lib";
export default function EntryForm({
  t,
  lang,
  initial,
  state,
  busy,
  online,
  onSave,
}) {
  const [kind, setKind] = useState(
      initial.kind === undefined ? "sale" : initial.kind,
    ),
    [amount, setAmount] = useState(initial.amount || ""),
    [name, setName] = useState(initial.name || ""),
    [method, setMethod] = useState(initial.method || "cash"),
    [note, setNote] = useState(initial.note || ""),
    [dueId, setDueId] = useState(initial.dueId || ""),
    [review, setReview] = useState(!!initial.pending),
    [attempted, setAttempted] = useState(!!initial.pending),
    [dueDate, setDueDate] = useState(initial.dueDate || ""),
    [customerId, setCustomerId] = useState(initial.customerId || "");
  const requestKey = useRef(initial.requestKey || crypto.randomUUID());
  const paise = Math.round(Number(amount) * 100);
  const due = state.dues.find((d) => d.id === dueId);
  const invalid =
    !initial.pending &&
    (!["sale", "expense", "udhaar", "collection", "receipt"].includes(kind) ||
      !Number.isFinite(paise) ||
      paise <= 0 ||
      paise > 100000000 ||
      (kind === "collection"
        ? !due || paise > due.outstanding
        : !name.trim()) ||
      (kind === "expense" && paise > state.cash));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        if (!review) {
          setReview(true);
          return;
        }
        setAttempted(true);
        onSave({
          kind,
          amount: paise,
          name:
            kind === "collection"
              ? initial.pending
                ? initial.name
                : due.name
              : name.trim(),
          method,
          note,
          dueId: kind === "collection" ? dueId : undefined,
          dueDate: kind === "udhaar" ? dueDate || undefined : undefined,
          requestKey: requestKey.current,
          scheduleId: initial.scheduleId,
          scheduleVersion: initial.scheduleVersion,
          customerId: kind === "udhaar" ? customerId || undefined : undefined,
        });
      }}
    >
      {initial.pending && <p className="notice">{t("resumePending")}</p>}
      <div className="filters entry-types">
        {["sale", "expense", "udhaar", "collection", "receipt"].map((k) => (
          <button
            key={k}
            type="button"
            className={kind === k ? "active" : ""}
            disabled={review || !!initial.scheduleId}
            onClick={() => setKind(k)}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {kind === "udhaar" && (
        <label>
          {t("customerIdentity")}
          <select
            value={customerId}
            disabled={review}
            onChange={(e) => {
              setCustomerId(e.target.value);
              const c = state.customers.find((c) => c.id === e.target.value);
              if (c) setName(c.name);
            }}
          >
            <option value="">{t("newCustomer")}</option>
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.id.slice(0, 6)}
                {c.legacy ? " *" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "udhaar" && (
        <label>
          {t("promiseDate")}
          <input
            type="date"
            value={dueDate}
            disabled={review}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <small>{t("promiseDateHint")}</small>
        </label>
      )}
      {review && (
        <div className="notice">
          <ShieldCheck size={18} />
          {t("correct")}
        </div>
      )}
      {initial.transcript && <blockquote>{initial.transcript}</blockquote>}
      {!kind && <p className="notice">{t("chooseType")}</p>}
      {kind === "collection" ? (
        <label>
          {t("chooseDue")}
          <select
            value={dueId}
            disabled={review}
            required
            onChange={(e) => setDueId(e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {initial.pending && !due && (
              <option value={dueId}>{initial.name}</option>
            )}
            {state.dues.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name} · {money(d.outstanding)} · {d.customerId.slice(0, 6)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          {t("customer")}
          <input
            value={name}
            disabled={review || (kind === "udhaar" && !!customerId)}
            required
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      )}
      <label>
        {t("amount")}
        <div className="amount-input">
          <span>₹</span>
          <input
            name="amount"
            aria-label={t("amount")}
            type="number"
            inputMode="decimal"
            min="0.01"
            max="1000000"
            step="0.01"
            required
            value={amount}
            disabled={review}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </label>
      {kind === "collection" && due && paise > due.outstanding && (
        <p className="warning-text">
          {money(due.outstanding)} · {t("pending")}
        </p>
      )}
      <label>
        {t("method")}
        <select
          value={method}
          disabled={review}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="cash">{t("cashMethod")}</option>
          <option value="upi">UPI</option>
        </select>
      </label>
      <label>
        {t("note")}
        <input
          value={note}
          disabled={review}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <span className="badge">{t("merchant")}</span>
      <button className="primary" disabled={invalid || busy || !online}>
        {busy ? (
          <LoaderCircle className="spin" size={19} />
        ) : review ? (
          <Check size={19} />
        ) : (
          <ArrowRight size={19} />
        )}{" "}
        {review ? t("save") : t("review")}
      </button>
      {review && (
        <button
          className="secondary"
          type="button"
          disabled={busy || attempted}
          onClick={() => {
            setReview(false);
          }}
        >
          {t("edit")}
        </button>
      )}
    </form>
  );
}
