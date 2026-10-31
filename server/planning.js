import { randomUUID } from "node:crypto";
// Shared date and cash primitives keep planning independent of domain orchestration.
import { cash, day, DomainError } from "./core.js";
export function initPlanning(db, m) {
  if (db.prepare("SELECT 1 FROM planning_initialized WHERE merchant=?").get(m))
    return;
  db.transaction(() => {
    const rows = db
      .prepare("SELECT * FROM obligations WHERE merchant=?")
      .all(m);
    const put = db.prepare(
      "INSERT INTO schedule(id,merchant,direction,label,amount,date,status,source,request_key) VALUES(?,?,?,?,?,?,?,?,?)",
    );
    for (const r of rows)
      put.run(
        r.id,
        m,
        "out",
        r.label,
        r.amount,
        r.date,
        "pending",
        "demo",
        `legacy-${r.id}`,
      );
    const created = db
      .prepare(
        "SELECT created FROM audit WHERE merchant=? AND event='demo_created' ORDER BY rowid LIMIT 1",
      )
      .get(m)?.created;
    const base = created
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(created))
      : day();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(`${base}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + i);
      put.run(
        randomUUID(),
        m,
        "in",
        "Expected settled sales",
        i < 3 ? 250000 : i === 3 ? 300000 : 120000,
        date.toISOString().slice(0, 10),
        "pending",
        "demo",
        `seed-in-${i}`,
      );
    }
    db.prepare(
      "UPDATE schedule SET kind='expense' WHERE merchant=? AND direction='out'",
    ).run(m);
    db.prepare("INSERT INTO planning_initialized VALUES(?)").run(m);
  })();
}
export function schedules(db, m) {
  initPlanning(db, m);
  return db
    .prepare(
      "SELECT * FROM schedule WHERE merchant=? AND status='pending' ORDER BY date,id",
    )
    .all(m);
}
export function planForecast(db, m, scenario = "expected") {
  const rows = schedules(db, m);
  let balance = cash(db, m);
  const points = Array.from({ length: 14 }, (_, i) => {
    const date = day(i + 1);
    const due = rows.filter(
      (r) =>
        r.date === date ||
        (i === 0 && r.direction === "out" && r.date <= day()),
    );
    const inflow = due
      .filter((r) => r.direction === "in")
      .reduce((s, r) => s + r.amount, 0);
    const outflow = due
      .filter((r) => r.direction === "out")
      .reduce((s, r) => s + r.amount, 0);
    const adjusted = Math.round(
      inflow * (scenario === "conservative" ? 0.7 : 1),
    );
    balance += adjusted - outflow;
    return { date, inflow: adjusted, outflow, balance };
  });
  return {
    points,
    obligations: rows.filter((r) => r.direction === "out"),
    schedule: rows,
    firstGap: points.find((p) => p.balance < 0) || null,
    method: "scheduled-cash-flow",
    scenario,
    overdue: rows.filter((r) => r.date <= day()),
  };
}
const audit = (db, m, event, detail) =>
  db
    .prepare("INSERT INTO audit VALUES(?,?,?,?,?)")
    .run(
      randomUUID(),
      m,
      event,
      JSON.stringify(detail),
      new Date().toISOString(),
    );
export function addSchedule(db, m, v) {
  return db.transaction(() => {
    const prior = db
      .prepare("SELECT * FROM schedule WHERE merchant=? AND request_key=?")
      .get(m, v.requestKey);
    const payload = JSON.stringify({
      direction: v.direction,
      label: v.label,
      amount: v.amount,
      date: v.date,
      kind: v.direction === "out" ? "expense" : v.kind || "sale",
      dueId: v.kind === "collection" ? v.dueId || null : null,
    });
    if (prior) {
      const saved = db
        .prepare(
          "SELECT payload FROM schedule_requests WHERE merchant=? AND request_key=?",
        )
        .get(m, v.requestKey);
      const legacy = JSON.stringify({
        direction: prior.direction,
        label: prior.label,
        amount: prior.amount,
        date: prior.date,
        kind: prior.kind,
        dueId: prior.due_id,
      });
      if ((saved?.payload || legacy) !== payload)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      return prior;
    }
    const kind = v.direction === "out" ? "expense" : v.kind || "sale";
    if (kind === "collection") {
      if (!v.dueId) throw new DomainError("DUE_NOT_FOUND", 400);
      const due = db
        .prepare(
          "SELECT * FROM entries WHERE id=? AND merchant=? AND kind='udhaar' AND NOT EXISTS(SELECT 1 FROM entry_voids WHERE entry_id=entries.id)",
        )
        .get(v.dueId, m);
      if (!due) throw new DomainError("DUE_NOT_FOUND", 400);
    }
    const row = {
      version: 1,
      kind,
      due_id: kind === "collection" ? v.dueId : null,
      id: randomUUID(),
      merchant: m,
      direction: v.direction,
      label: v.label,
      amount: v.amount,
      date: v.date,
      status: "pending",
      source: "merchant",
      request_key: v.requestKey,
    };
    db.prepare(
      "INSERT INTO schedule(id,merchant,direction,label,amount,date,status,source,request_key,version,kind,due_id) VALUES(@id,@merchant,@direction,@label,@amount,@date,@status,@source,@request_key,@version,@kind,@due_id)",
    ).run(row);
    db.prepare("INSERT INTO schedule_requests VALUES(?,?,?)").run(
      m,
      v.requestKey,
      payload,
    );
    audit(db, m, "plan_item_added", { id: row.id, amount: row.amount });
    return row;
  })();
}
export function changeSchedule(db, m, id, v) {
  return db.transaction(() => {
    const row = db
      .prepare(
        "SELECT * FROM schedule WHERE id=? AND merchant=? AND status='pending'",
      )
      .get(id, m);
    if (!row) throw new DomainError("PLAN_ITEM_NOT_FOUND", 404);
    if (v.version !== row.version) throw new DomainError("PLAN_CHANGED", 409);
    if (v.status === "cancelled") {
      db.prepare(
        "UPDATE schedule SET version=version+1,status='cancelled' WHERE id=? AND merchant=?",
      ).run(id, m);
      audit(db, m, "plan_item_cancelled", { id });
    } else {
      db.prepare(
        "UPDATE schedule SET version=version+1,label=?,amount=?,date=?,source='merchant' WHERE id=? AND merchant=?",
      ).run(v.label, v.amount, v.date, id, m);
      audit(db, m, "plan_item_updated", {
        id,
        previous: {
          label: row.label,
          amount: row.amount,
          date: row.date,
          version: row.version,
        },
        previousDate: row.date,
        date: v.date,
        amount: v.amount,
      });
    }
    return { ok: true };
  })();
}
export function recommendations(db, m, dues, scenario = "expected") {
  const f = planForecast(db, m, scenario);
  const gap = f.firstGap;
  if (!gap) return [];
  const pending = dues.reduce((s, d) => s + d.outstanding, 0),
    shortage = -gap.balance;
  const affected = f.obligations.filter((o) => o.date <= gap.date);
  return [
    pending > 0
      ? {
          type: "collect_dues",
          potential: pending,
          assumed: Math.round(pending * 0.5),
          residual: Math.max(0, shortage - pending),
          sourceIds: dues.map((d) => d.id),
          conditional: true,
        }
      : null,
    affected.length
      ? {
          type: "review_payments",
          amount: affected.reduce((s, o) => s + o.amount, 0),
          sourceIds: affected.map((o) => o.id),
          conditional: true,
        }
      : null,
  ].filter(Boolean);
}
