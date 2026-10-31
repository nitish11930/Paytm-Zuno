import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DomainError } from "./core.js";
let worker;
const waiting = new Map();
export function ownerVoice(operation, merchant, buffer) {
  const python = resolve("privacy/voice-venv/bin/python");
  if (!existsSync(python))
    throw new DomainError("OWNER_VOICE_UNAVAILABLE", 503);
  if (waiting.size >= 2) throw new DomainError("VOICE_RATE_LIMITED", 429);
  if (!worker) {
    const child = spawn(python, [resolve("python/owner_voice/worker.py")], {
      stdio: ["pipe", "pipe", "ignore"],
      env: process.env,
    });
    worker = child;
    const fail = () => {
      if (worker !== child) return;
      worker = null;
      for (const [id, p] of waiting) {
        clearTimeout(p.timer);
        p.reject(new DomainError("OWNER_VOICE_UNAVAILABLE", 503));
        waiting.delete(id);
      }
    };
    child.on("error", fail);
    child.on("exit", fail);
    child.stdin.on("error", () => {});
    createInterface({ input: child.stdout }).on("line", (line) => {
      try {
        const reply = JSON.parse(line),
          p = waiting.get(reply.id);
        if (!p) return;
        clearTimeout(p.timer);
        waiting.delete(reply.id);
        reply.error
          ? p.reject(
              new DomainError(
                reply.error,
                reply.error === "OWNER_VOICE_MISMATCH" ? 403 : 400,
              ),
            )
          : p.resolve(reply.result);
      } catch {}
    });
  }
  return new Promise((resolvePromise, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new DomainError("OWNER_VOICE_UNAVAILABLE", 503));
      worker?.kill();
    }, 120000);
    waiting.set(id, { resolve: resolvePromise, reject, timer });
    worker.stdin.write(
      JSON.stringify({
        id,
        operation,
        merchant,
        ...(buffer ? { audio: buffer.toString("base64") } : {}),
      }) + "\n",
    );
  });
}
process.once("exit", () => worker?.kill());
