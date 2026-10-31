import { backup, verify } from "./backup.mjs";
import { resolve } from "node:path";
// Restore into a NEW file only. Never overwrite the running database.
const [source, target] = process.argv.slice(2);
if (!source || !target)
  throw new Error(
    "Usage: node scripts/restore.mjs backup.sqlite NEW-target.sqlite",
  );
verify(resolve(source));
await backup(resolve(source), resolve(target));
console.log(
  "Restored and verified a new database. Stop the app and follow the documented swap procedure to use it.",
);
