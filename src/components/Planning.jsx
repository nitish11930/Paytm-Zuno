import React, { useState, useRef } from "react";
import {
  Plus,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Trash2,
} from "lucide-react";
import { money, shortDate } from "../lib";
export function PlanningInputs({ state, t, lang, onEdit, onNew, onRecord }) {
  const rows = state.forecast.schedule || [];
  return (
    <>
      <div className="planning-intro">
        <CalendarDays size={28} />
        <p>{t("planningHint")}</p>
      </div>
      <button className="primary" onClick={onNew}>
        <Plus size={18} />
        {t("addPlanItem")}
      </button>
      {["out", "in"].map((direction) => (
        <section key={direction}>
          <h3 className="planning-subtitle">
            {t(direction === "out" ? "plannedPayments" : "expectedReceipts")}
          </h3>
          {rows
            .filter((r) => r.direction === direction)
            .map((r) => (
              <div className="due-card" key={r.id}>
                <button className="plan-input-row" onClick={() => onEdit(r)}>
                  <span className="entry-icon">
                    {direction === "out" ? (
                      <ArrowUpRight size={18} />
                    ) : (
                      <ArrowDownLeft size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{r.label}</strong>
                    <small>
                      {shortDate(r.date, lang)} ·{" "}
                      {t(r.source === "demo" ? "demo" : "merchant")}
                    </small>
                  </span>
                  <strong>{money(r.amount)}</strong>
                  <ChevronRight size={16} />
                </button>
                <button className="text-button" onClick={() => onRecord(r)}>
                  {t(direction === "out" ? "recordPaid" : "recordReceived")}
                  <Check size={16} />
                </button>
              </div>
            ))}
        </section>
      ))}
    </>
  );
}
export function PlanItemForm({ initial, state, t, busy, onSave, onCancel }) {
  const [direction, setDirection] = useState(initial?.direction || "out"),
    [label, setLabel] = useState(initial?.label || ""),
    [amount, setAmount] = useState(initial ? String(initial.amount / 100) : ""),
    [date, setDate] = useState(
      initial?.date ||
        new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    );
  const [kind, setKind] = useState(initial?.kind || "sale"),
    [dueId, setDueId] = useState(initial?.due_id || "");
  const requestKey = useRef(crypto.randomUUID());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          direction,
          kind,
          dueId: kind === "collection" ? dueId : undefined,
          version: initial?.version,
          label: label.trim(),
          amount: Math.round(Number(amount) * 100),
          date,
          requestKey: requestKey.current,
        });
      }}
    >
      <p className="notice">{t("planDoesNotMoveCash")}</p>
      <label>
        {t("planDirection")}
        <select
          disabled={!!initial || busy}
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="out">{t("plannedPayments")}</option>
          <option value="in">{t("expectedReceipts")}</option>
        </select>
      </label>
      {direction === "in" && (
        <label>
          {t("receiptType")}
          <select
            disabled={!!initial || busy}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="sale">{t("sale")}</option>
            <option value="collection">{t("collection")}</option>
            <option value="receipt">{t("receipt")}</option>
          </select>
        </label>
      )}
      {direction === "in" && kind === "collection" && (
        <label>
          {t("chooseDue")}
          <select
            required
            disabled={!!initial || busy}
            value={dueId}
            onChange={(e) => setDueId(e.target.value)}
          >
            <option value="">{t("choose")}</option>
            {state.dues.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {money(d.outstanding)} · {d.customerId.slice(0, 6)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t("planLabel")}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        {t("amount")}
        <input
          type="number"
          min="0.01"
          max="1000000"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label>
        {t("date")}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <button
        className="primary"
        disabled={busy || !label.trim() || !date || !(Number(amount) > 0)}
      >
        {t("savePlan")}
      </button>
      {initial && (
        <button
          className="danger-link"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          <Trash2 size={16} />
          {t("removePlanItem")}
        </button>
      )}
    </form>
  );
}
export function ReverseForm({ entry, t, busy, onReverse }) {
  const [reason, setReason] = useState("");
  const key = useRef(crypto.randomUUID());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onReverse({ reason: reason.trim(), requestKey: key.current });
      }}
    >
      <p className="notice warn">{t("reverseExplanation")}</p>
      <div className="readiness-row">
        <span>{entry.name}</span>
        <strong>{money(entry.amount)}</strong>
      </div>
      <label>
        {t("correctionReason")}
        <textarea
          rows={3}
          required
          minLength={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className="primary danger"
        disabled={busy || reason.trim().length < 3}
      >
        {t("confirmReverse")}
      </button>
    </form>
  );
}
