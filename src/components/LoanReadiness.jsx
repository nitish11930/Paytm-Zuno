import React, { useState } from "react";
import {
  Leaf,
  ShieldCheck,
  ArrowRight,
  FileCheck2,
  CalendarDays,
  Receipt,
  Calculator,
  Download,
  LoaderCircle,
} from "lucide-react";
import { PageTitle } from "./Shared";
import { api, money } from "../lib";
export default function LoanReadiness({
  state,
  t,
  onBack,
  onEntry,
  onPlan,
  onExport,
}) {
  const [amount, setAmount] = useState("50000"),
    [months, setMonths] = useState("12"),
    [rate, setRate] = useState("18"),
    [estimate, setEstimate] = useState(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const facts = [
    {
      icon: CalendarDays,
      label: "historyDays",
      value: state.readiness.days,
      hint: "historyHint",
    },
    {
      icon: Receipt,
      label: "expenseRecords",
      value: state.readiness.expenses,
      hint: "expensesHint",
    },
    {
      icon: ShieldCheck,
      label: "verifiedReceipts",
      value: 0,
      hint: "verifiedHint",
    },
  ];
  return (
    <>
      <PageTitle
        title={t("loanTitle")}
        subtitle={t("loanSubtitle")}
        back={onBack}
      />
      <section className="loan-hero">
        <div className="loan-hero-top">
          <span className="badge">{t("loanPreparation")}</span>
          <Leaf size={28} />
        </div>
        <h2>{t("loanHero")}</h2>
        <p>{t("loanHeroHint")}</p>
        <div className="loan-status">
          <ShieldCheck size={20} />
          <span>{t("lenderNotConnected")}</span>
        </div>
      </section>
      <div className="loan-facts">
        {facts.map(({ icon: I, label, value, hint }) => (
          <div className="loan-fact" key={label}>
            <I size={20} />
            <strong>{value}</strong>
            <span>{t(label)}</span>
            <small>{t(hint)}</small>
          </div>
        ))}
      </div>
      <section className="loan-next">
        <div className="section-heading">
          <h3>{t("yourNextSteps")}</h3>
          <FileCheck2 size={21} />
        </div>
        <button className="loan-step" onClick={onEntry}>
          <span className="loan-step-num">1</span>
          <span>
            <strong>{t("completeKhata")}</strong>
            <small>{t("completeKhataHint")}</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button className="loan-step" onClick={onPlan}>
          <span className="loan-step-num">2</span>
          <span>
            <strong>{t("reviewCommitments")}</strong>
            <small>{t("reviewCommitmentsHint")}</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button className="loan-step" onClick={onExport}>
          <span className="loan-step-num">3</span>
          <span>
            <strong>{t("exportRecords")}</strong>
            <small>{t("exportRecordsHint")}</small>
          </span>
          <Download size={18} />
        </button>
      </section>
      <details className="loan-calculator">
        <summary>
          <Calculator size={20} />
          {t("emiExplore")}
        </summary>
        <p>{t("emiDisclaimer")}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setFailed(false);
            try {
              setEstimate(
                await api("/loan/estimate", {
                  method: "POST",
                  body: {
                    amount: Math.round(Number(amount) * 100),
                    months: Number(months),
                    annualRate: Number(rate),
                  },
                }),
              );
            } catch {
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("loanAmount")}
            <input
              type="number"
              min="100"
              max="1000000"
              step="0.01"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setEstimate(null);
              }}
            />
          </label>
          <div className="loan-input-pair">
            <label>
              {t("termMonths")}
              <input
                type="number"
                min="1"
                max="120"
                required
                value={months}
                onChange={(e) => {
                  setMonths(e.target.value);
                  setEstimate(null);
                }}
              />
            </label>
            <label>
              {t("annualRate")}
              <input
                type="number"
                min="0"
                max="60"
                step="0.01"
                required
                value={rate}
                onChange={(e) => {
                  setRate(e.target.value);
                  setEstimate(null);
                }}
              />
            </label>
          </div>
          <button className="secondary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Calculator size={18} />
            )}{" "}
            {t("calculateEmi")}
          </button>
        </form>
        {failed && (
          <p role="alert" className="warning-text">
            {t("error")}
          </p>
        )}
        {estimate && (
          <div className="emi-result" role="status">
            <small>{t("estimatedMonthly")}</small>
            <strong>{money(estimate.emi)}</strong>
            <div>
              <span>{t("totalInterest")}</span>
              <b>{money(estimate.interest)}</b>
            </div>
            <div>
              <span>{t("totalRepayment")}</span>
              <b>{money(estimate.total)}</b>
            </div>
            <p>{t("emiExcludesFees")}</p>
          </div>
        )}
      </details>
      <p className="notice loan-note">
        <ShieldCheck size={20} />
        {t("loanBoundary")}
      </p>
    </>
  );
}
