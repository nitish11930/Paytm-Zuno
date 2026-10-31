export const day = (offset = 0) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const d = new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
export class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function cash(db, m) {
  const opening = db
    .prepare("SELECT opening FROM merchants WHERE id=?")
    .get(m).opening;
  const rows = db
    .prepare(
      "SELECT kind,amount FROM entries WHERE merchant=? AND date<=? AND kind!='udhaar' AND NOT EXISTS(SELECT 1 FROM entry_voids v WHERE v.entry_id=entries.id)",
    )
    .all(m, day());
  return (
    opening +
    rows.reduce((s, e) => s + (e.kind === "expense" ? -e.amount : e.amount), 0)
  );
}
