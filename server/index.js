import dotenv from "dotenv";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.js";
dotenv.config({ path: "privacy/sarvam.env", quiet: true });
dotenv.config({ quiet: true });
if (
  process.env.HOST === "0.0.0.0" &&
  process.env.NODE_ENV === "production" &&
  (!process.env.TEST_ACCESS_CODE || process.env.TEST_ACCESS_CODE.length < 12)
)
  throw new Error(
    "Public test hosting requires a private TEST_ACCESS_CODE (12+ characters).",
  );
const app = createApp();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_q, r) => r.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5187);
app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Munim ready: http://127.0.0.1:${port} · synthetic test build`),
);
