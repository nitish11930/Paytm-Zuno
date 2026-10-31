import React, { useState } from "react";
import { ArrowDownToLine, Upload, ChevronLeft } from "lucide-react";
import { api, money, shortDate } from "../lib";

export default function PaymentImport({
  state,
  t,
  lang,
  online,
  onRefresh,
  onError,
  onBack,
}) {
  const [csv, setCsv] = useState(""),
    [columns, setColumns] = useState(null),
    [mapping, setMapping] = useState({}),
    [kind, setKind] = useState("payment"),
    [dateFormat, setDateFormat] = useState("iso"),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [tab, setTab] = useState("payment");
  async function run(fn) {
    setBusy(true);
    onError("");
    try {
      await fn();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const inbox = (state.paymentInbox || []).filter((p) => p.record_type === tab);
  const groups = [...new Set(inbox.map((p) => p.date))];
  return (
    <>
      <button className="text-button" onClick={onBack}>
        <ChevronLeft size={18} />
        {t("khata")}
      </button>
      <h2>{t("importPayments")}</h2>
      <p className="notice">{t("reportImportNotice")}</p>
      <section className="card import-card">
        <label className="secondary import-upload">
          <Upload size={18} />
          {t("chooseCsv")}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy || !online}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              run(async () => {
                if (file.size > 131072) throw new Error("IMPORT_FILE_LIMIT");
                setCsv(await file.text());
                setColumns(null);
                setPreview(null);
                setResult(null);
              });
            }}
          />
        </label>
        <a className="text-button" href="/demo-payment-template.csv" download>
          <ArrowDownToLine size={15} />
          {t("demoCsv")}
        </a>
        <details>
          <summary>{t("pasteCsv")}</summary>
          <textarea
            rows={5}
            value={csv}
            maxLength={131072}
            disabled={busy}
            onChange={(e) => {
              setCsv(e.target.value);
              setColumns(null);
              setPreview(null);
              setResult(null);
            }}
            aria-label={t("pasteCsv")}
          />
        </details>
        {!columns && (
          <button
            className="secondary"
            disabled={!csv.trim() || busy || !online}
            onClick={() =>
              run(async () => {
                const r = await api("/payments/preview", {
                  method: "POST",
                  body: { csv },
                });
                setColumns(r.headers);
                setMapping(r.suggested);
              })
            }
          >
            {t("readColumns")}
          </button>
        )}
        {columns && !preview && (
          <>
            <div className="import-mapping">
              {[
                "reference",
                "date",
                "amount",
                "status",
                "name",
                "recordType",
              ].map((field) => (
                <label key={field}>
                  {t("column_" + field)}
                  <select
                    disabled={busy}
                    value={mapping[field] || ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [field]: e.target.value })
                    }
                  >
                    <option value="">
                      {t(
                        ["name", "recordType"].includes(field)
                          ? "optionalColumn"
                          : "choose",
                      )}
                    </option>
                    {columns.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                {t("reportType")}
                <select
                  disabled={busy}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="payment">{t("paymentRecords")}</option>
                  <option value="settlement">{t("bankSettlements")}</option>
                </select>
              </label>
              <label>
                {t("reportDateFormat")}
                <select
                  disabled={busy}
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                >
                  <option value="iso">YYYY-MM-DD / ISO timestamp</option>
                  <option value="dmySlash">DD/MM/YYYY · IST</option>
                  <option value="dmyDash">DD-MM-YYYY · IST</option>
                </select>
              </label>
            </div>
            <button
              className="primary"
              disabled={
                busy ||
                !online ||
                ["reference", "date", "amount", "status"].some(
                  (k) => !mapping[k],
                )
              }
              onClick={() =>
                run(async () =>
                  setPreview(
                    await api("/payments/preview", {
                      method: "POST",
                      body: { csv, mapping, defaultType: kind, dateFormat },
                    }),
                  ),
                )
              }
            >
              {t("previewImport")}
            </button>
          </>
        )}
        {preview && (
          <>
            <p>
              {preview.newCount} · {t("newReportRows")} ·{" "}
              {preview.rows.length - preview.newCount} {t("duplicateRows")} ·{" "}
              {preview.skipped} {t("skippedRows")}
            </p>
            <details open>
              <summary>{t("reviewReportRows")}</summary>
              <div className="import-preview">
                {preview.rows.map((p) => (
                  <div
                    className="import-preview-row"
                    key={p.record_type + p.reference}
                  >
                    <strong>
                      {p.name} · {money(p.amount)}
                    </strong>
                    <small>
                      {p.date} · {p.reference} ·{" "}
                      {t(
                        p.record_type === "settlement"
                          ? "bankSettlements"
                          : "paymentRecords",
                      )}
                      {p.duplicate ? " · " + t("duplicateRows") : ""}
                    </small>
                  </div>
                ))}
              </div>
            </details>
            <p className="microcopy">{t("importNoCash")}</p>
            {!result && (
              <button
                className="primary"
                disabled={busy || !online}
                onClick={() =>
                  run(async () => {
                    const r = await api(
                      "/payments/imports/" + preview.batchId + "/confirm",
                      { method: "POST", body: {} },
                    );
                    setResult(r);
                    await onRefresh();
                  })
                }
              >
                {t("saveReport")}
              </button>
            )}
            {result && (
              <p role="status">
                {t("reportSaved")} · {result.imported} / {result.duplicates}{" "}
                {t("duplicateRows")}
              </p>
            )}
          </>
        )}
      </section>
      <div className="filters">
        {["payment", "settlement"].map((k) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {t(k === "payment" ? "paymentRecords" : "bankSettlements")}
          </button>
        ))}
      </div>
      {!inbox.length && <p className="microcopy">{t("noImportedRows")}</p>}
      {groups.map((date) => (
        <section key={date}>
          <h3>{shortDate(date, lang)}</h3>
          {inbox
            .filter((p) => p.date === date)
            .map((p) => (
              <PaymentRow
                key={p.id}
                p={p}
                state={state}
                t={t}
                online={online}
                busy={busy}
                run={run}
                onRefresh={onRefresh}
              />
            ))}
        </section>
      ))}
    </>
  );
}
function PaymentRow({ p, state, t, online, busy, run, onRefresh }) {
  const [category, setCategory] = useState(""),
    [link, setLink] = useState(""),
    [received, setReceived] = useState(false),
    [separate, setSeparate] = useState(false);
  const matches = state.entries.filter(
    (e) =>
      !e.reversed &&
      e.method === "upi" &&
      ["sale", "receipt", "collection"].includes(e.kind) &&
      e.amount === p.amount &&
      e.date === p.date,
  );
  const eligible = matches.filter(
    (e) => !(state.paymentInbox || []).some((r) => r.entry_id === e.id),
  );
  const linked = p.entry_id && state.entries.find((e) => e.id === p.entry_id);
  return (
    <details className="due-card imported-payment">
      <summary>
        <strong>
          {p.name} · {money(p.amount)}
        </strong>
        <small>
          {p.reference} ·{" "}
          {p.record_type === "settlement"
            ? t("settlementOnly")
            : p.reversed
              ? t("reversed")
              : p.entry_id
                ? t("recordedInKhata")
                : t("needsClassification")}
        </small>
      </summary>
      <p className="microcopy">{t("reportUnverified")}</p>
      {linked && (
        <p>
          {t(linked.kind)} · {linked.name} · {p.date}
        </p>
      )}
      {p.record_type === "settlement" && <p>{t("settlementNoCash")}</p>}
      {p.record_type === "payment" && !p.entry_id && (
        <>
          {matches.length > 0 && (
            <p className="notice">{t("possibleDuplicate")}</p>
          )}
          <label>
            {t("category")}
            <select
              value={category}
              disabled={busy}
              onChange={(e) => {
                setCategory(e.target.value);
                setLink("");
                setReceived(false);
                setSeparate(false);
              }}
            >
              <option value="">{t("choose")}</option>
              <option value="link">{t("linkExisting")}</option>
              {["sale", "collection", "receipt"].map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </label>
          {category === "link" && (
            <label>
              {t("linkExisting")}
              <select
                disabled={busy}
                value={link}
                onChange={(e) => setLink(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {eligible.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name} · {t(e.kind)} · {e.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {category === "collection" && (
            <label>
              {t("chooseDue")}
              <select
                disabled={busy}
                value={link}
                onChange={(e) => setLink(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {state.dues
                  .filter((d) => d.outstanding >= p.amount && d.date <= p.date)
                  .map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name} · {money(d.outstanding)} ·{" "}
                      {d.customerId.slice(0, 6)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {category && category !== "link" && (
            <label className="import-consent">
              <input
                type="checkbox"
                checked={received}
                disabled={busy}
                onChange={(e) => setReceived(e.target.checked)}
              />
              {t("receivedConfirmed")}
            </label>
          )}
          {category && category !== "link" && matches.length > 0 && (
            <label className="import-consent">
              <input
                type="checkbox"
                checked={separate}
                disabled={busy}
                onChange={(e) => setSeparate(e.target.checked)}
              />
              {t("separatePayment")}
            </label>
          )}
          <button
            className="secondary"
            disabled={
              busy ||
              !online ||
              !category ||
              (["link", "collection"].includes(category) && !link) ||
              (category !== "link" &&
                (!received || (matches.length > 0 && !separate)))
            }
            onClick={() =>
              run(async () => {
                const body =
                  category === "link"
                    ? { category, entryId: link }
                    : {
                        category,
                        receivedConfirmed: received,
                        ...(category === "collection" ? { dueId: link } : {}),
                        ...(matches.length
                          ? { separateConfirmed: separate }
                          : {}),
                      };
                await api("/payments/" + p.id + "/classify", {
                  method: "POST",
                  body,
                });
                await onRefresh();
              })
            }
          >
            {t("recordInKhata")}
          </button>
        </>
      )}
    </details>
  );
}
