import { randomUUID } from "node:crypto";
import { addEntry, day, DomainError, validDueDate } from "./domain.js";

export function parseCsv(csv) {
  if (typeof csv !== "string" || Buffer.byteLength(csv) > 128 * 1024)
    throw new DomainError("IMPORT_FILE_LIMIT");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const finish = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell.trim() || closed) throw new DomainError("IMPORT_INVALID_CSV");
      quoted = true;
    } else if (c === ",") {
      finish();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      finish();
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      if (closed && !/\s/.test(c)) throw new DomainError("IMPORT_INVALID_CSV");
      cell += c;
    }
    if (rows.length > 200) throw new DomainError("IMPORT_ROW_LIMIT");
  }
  if (quoted) throw new DomainError("IMPORT_INVALID_CSV");
  finish();
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2 || rows.length > 201)
    throw new DomainError("IMPORT_ROW_LIMIT");
  rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  if (new Set(rows[0]).size !== rows[0].length || rows[0].some((v) => !v))
    throw new DomainError("IMPORT_COLUMNS");
  if (rows.some((r) => r.length !== rows[0].length))
    throw new DomainError("IMPORT_COLUMNS");
  return { headers: rows[0], rows: rows.slice(1) };
}
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = {
  reference: ["transactionid", "txnid", "reference", "utr", "utrnumber"],
  date: ["date", "transactiondate", "paymentdate", "settlementdate"],
  amount: ["amount", "transactionamount", "paymentamount", "netsettledamount"],
  name: ["name", "customername", "payername"],
  status: ["status", "transactionstatus", "paymentstatus", "settlementstatus"],
  recordType: ["recordtype"],
};
export function importColumns(csv) {
  const { headers } = parseCsv(csv);
  const suggested = {};
  for (const [field, keys] of Object.entries(aliases)) {
    const found = headers.filter((h) => keys.includes(normalize(h)));
    if (found.length === 1) suggested[field] = found[0];
  }
  return { headers, suggested };
}
function rupees(value) {
  if (
    !/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(
      value,
    )
  )
    throw new DomainError("IMPORT_INVALID_AMOUNT");
  const clean = value.replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean))
    throw new DomainError("IMPORT_INVALID_AMOUNT");
  const [whole, fraction = ""] = clean.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000)
    throw new DomainError("IMPORT_INVALID_AMOUNT");
  return amount;
}
function exactDate(value, format) {
  if (format !== "iso") {
    const match =
      format === "dmySlash"
        ? value.match(
            /^(\d{2})\/(\d{2})\/(\d{4})(?: ([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?$/,
          )
        : value.match(
            /^(\d{2})-(\d{2})-(\d{4})(?: ([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?$/,
          );
    if (!match) throw new DomainError("IMPORT_INVALID_DATE");
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    if (!validDueDate(date)) throw new DomainError("IMPORT_INVALID_DATE");
    return date;
  }
  if (validDueDate(value)) return value;
  // Timestamp offsets must be explicit; naive dates/times are not guessed.
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    validDueDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  ) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  throw new DomainError("IMPORT_INVALID_DATE");
}
const same = (a, b) =>
  a.record_type === b.record_type &&
  a.date === b.date &&
  a.amount === b.amount &&
  a.name === b.name;
export function previewImport(
  db,
  m,
  csv,
  mapping,
  defaultType,
  dateFormat = "iso",
) {
  const parsed = parseCsv(csv);
  for (const key of ["reference", "date", "amount", "status"])
    if (!parsed.headers.includes(mapping[key]))
      throw new DomainError("IMPORT_COLUMNS");
  for (const key of ["name", "recordType"])
    if (mapping[key] && !parsed.headers.includes(mapping[key]))
      throw new DomainError("IMPORT_COLUMNS");
  const get = (row, key) => row[parsed.headers.indexOf(mapping[key])] || "";
  const seen = new Set(),
    rows = [];
  let skipped = 0;
  for (const row of parsed.rows) {
    const rawStatus = normalize(get(row, "status"));
    if (["pending", "failed", "failure", "txnfailure"].includes(rawStatus)) {
      skipped++;
      continue;
    }
    if (!["success", "successful", "txnsuccess", "settled"].includes(rawStatus))
      throw new DomainError("IMPORT_STATUS_REVIEW");
    const record_type = get(row, "recordType").toLowerCase() || defaultType;
    if (!["payment", "settlement"].includes(record_type))
      throw new DomainError("IMPORT_RECORD_TYPE");
    if (
      record_type === "payment" &&
      (rawStatus === "settled" ||
        normalize(mapping.amount) === "netsettledamount" ||
        normalize(mapping.date) === "settlementdate")
    )
      throw new DomainError("IMPORT_RECORD_TYPE");
    const reference = get(row, "reference");
    if (!reference || reference.length > 100)
      throw new DomainError("IMPORT_REFERENCE");
    const key = record_type + ":" + reference;
    if (seen.has(key)) throw new DomainError("IMPORT_DUPLICATE_ROWS");
    seen.add(key);
    const data = {
      reference,
      record_type,
      date: exactDate(get(row, "date"), dateFormat),
      amount: rupees(get(row, "amount")),
      name: get(row, "name") || "Paytm report",
    };
    if (data.date > day() || data.name.length > 80)
      throw new DomainError("IMPORT_INVALID_DATE");
    const prior = db
      .prepare(
        "SELECT * FROM imported_payments WHERE merchant=? AND record_type=? AND reference=?",
      )
      .get(m, record_type, reference);
    if (prior && !same(prior, data))
      throw new DomainError("IMPORT_CONFLICT", 409);
    rows.push({ ...data, duplicate: !!prior });
  }
  if (!rows.length) throw new DomainError("IMPORT_NO_SUCCESSFUL_ROWS");
  const batch = {
    id: randomUUID(),
    merchant: m,
    payload: JSON.stringify(rows),
    expires: Date.now() + 600000,
    result: null,
  };
  db.prepare(
    "INSERT INTO payment_import_batches VALUES(@id,@merchant,@payload,@expires,@result)",
  ).run(batch);
  return {
    batchId: batch.id,
    rows,
    skipped,
    newCount: rows.filter((r) => !r.duplicate).length,
    expires: batch.expires,
  };
}
export function confirmImport(db, m, id) {
  return db.transaction(() => {
    const batch = db
      .prepare("SELECT * FROM payment_import_batches WHERE id=? AND merchant=?")
      .get(id, m);
    if (!batch) throw new DomainError("ACTION_NOT_FOUND", 404);
    if (batch.result) return { ...JSON.parse(batch.result), replayed: true };
    if (batch.expires < Date.now())
      throw new DomainError("APPROVAL_EXPIRED", 409);
    let imported = 0,
      duplicates = 0;
    for (const row of JSON.parse(batch.payload)) {
      const prior = db
        .prepare(
          "SELECT * FROM imported_payments WHERE merchant=? AND record_type=? AND reference=?",
        )
        .get(m, row.record_type, row.reference);
      if (prior) {
        if (!same(prior, row)) throw new DomainError("IMPORT_CONFLICT", 409);
        duplicates++;
        continue;
      }
      db.prepare(
        "INSERT INTO imported_payments VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL)",
      ).run(
        randomUUID(),
        m,
        id,
        row.reference,
        row.record_type,
        row.date,
        row.amount,
        row.name,
        "report_unverified",
      );
      imported++;
    }
    const result = { imported, duplicates };
    db.prepare(
      "UPDATE payment_import_batches SET result=? WHERE id=? AND merchant=?",
    ).run(JSON.stringify(result), id, m);
    db.prepare("INSERT INTO audit VALUES(?,?,?,?,?)").run(
      randomUUID(),
      m,
      "payment_report_imported",
      JSON.stringify({ ...result, batch: id, moneyReceived: 0 }),
      new Date().toISOString(),
    );
    return result;
  })();
}
export function classifyPayment(db, m, id, input) {
  return db.transaction(() => {
    const p = db
      .prepare("SELECT * FROM imported_payments WHERE id=? AND merchant=?")
      .get(id, m);
    if (!p) throw new DomainError("ENTRY_NOT_FOUND", 404);
    if (p.record_type !== "payment")
      throw new DomainError("SETTLEMENT_NOT_INCOME", 409);
    const decision = JSON.stringify(input);
    if (p.decision) {
      if (p.decision !== decision)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      return { entryId: p.entry_id, replayed: true };
    }
    if (!["link", "sale", "receipt", "collection"].includes(input.category))
      throw new DomainError("IMPORT_RECORD_TYPE");
    let entryId;
    if (input.category === "link") {
      const e = db
        .prepare(
          "SELECT * FROM entries WHERE id=? AND merchant=? AND method='upi' AND kind IN ('sale','receipt','collection') AND NOT EXISTS(SELECT 1 FROM entry_voids WHERE entry_id=entries.id)",
        )
        .get(input.entryId, m);
      if (!e || e.amount !== p.amount || e.date !== p.date)
        throw new DomainError("IMPORT_LINK_MISMATCH", 409);
      if (
        db
          .prepare(
            "SELECT 1 FROM imported_payments WHERE merchant=? AND entry_id=?",
          )
          .get(m, e.id)
      )
        throw new DomainError("IMPORT_ALREADY_LINKED", 409);
      entryId = e.id;
    } else {
      if (input.receivedConfirmed !== true)
        throw new DomainError("IMPORT_RECEIPT_CONFIRMATION", 409);
      const possible = db
        .prepare(
          "SELECT id FROM entries WHERE merchant=? AND date=? AND amount=? AND method='upi' AND kind IN ('sale','receipt','collection') AND NOT EXISTS(SELECT 1 FROM entry_voids WHERE entry_id=entries.id)",
        )
        .all(m, p.date, p.amount);
      if (possible.length && input.separateConfirmed !== true)
        throw new DomainError("IMPORT_POSSIBLE_DUPLICATE", 409);
      if (input.category === "collection") {
        const due = db
          .prepare(
            "SELECT date FROM entries WHERE id=? AND merchant=? AND kind='udhaar'",
          )
          .get(input.dueId, m);
        if (!due || due.date > p.date)
          throw new DomainError("DUE_NOT_FOUND", 409);
      }
      const entry = addEntry(
        db,
        m,
        {
          kind: input.category,
          name: p.name,
          amount: p.amount,
          method: "upi",
          dueId: input.dueId,
          requestKey: p.id,
          note: `Paytm report: ${p.reference}`,
        },
        { date: p.date, source: "report_unverified" },
      );
      entryId = entry.id;
    }
    db.prepare(
      "UPDATE imported_payments SET entry_id=?,decision=? WHERE id=? AND merchant=?",
    ).run(entryId, decision, id, m);
    db.prepare("INSERT INTO audit VALUES(?,?,?,?,?)").run(
      randomUUID(),
      m,
      "payment_report_classified",
      JSON.stringify({ payment: id, entry: entryId, category: input.category }),
      new Date().toISOString(),
    );
    return { entryId };
  })();
}
