import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { mkdirSync, chmodSync, existsSync } from "node:fs";
export async function backup(source, target) {
  if (!existsSync(source) || existsSync(target))
    throw new Error("Source must exist and target must be new");
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = new Database(source, { readonly: true });
  try {
    await db.backup(target);
    chmodSync(target, 0o600);
    verify(target);
  } finally {
    db.close();
  }
}
export function verify(path) {
  const db = new Database(path, { readonly: true });
  try {
    if (
      db.pragma("integrity_check", { simple: true }) !== "ok" ||
      db.pragma("foreign_key_check").length
    )
      throw new Error("Backup integrity check failed");
    for (const name of ["merchants", "entries", "audit", "schedule"])
      if (
        !db
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
          .get(name)
      )
        throw new Error("Not a Zuno database");
  } finally {
    db.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const source = resolve(
    process.argv[2] ||
      (existsSync("data/zuno.sqlite")
        ? "data/zuno.sqlite"
        : "data/munim.sqlite"),
  );
  const target = resolve(
    process.argv[3] || `data/backups/zuno-${Date.now()}.sqlite`,
  );
  await backup(source, target);
  console.log("Verified owner-only backup created.");
}
