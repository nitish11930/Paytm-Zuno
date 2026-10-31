import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import {
  database,
  exportArchive,
  seed,
  snapshot,
  addEntry,
  propose,
  execute,
  updateShop,
  resetDemo,
  reverseEntry,
  DomainError,
} from "./domain.js";
import { transcribe, speak } from "./voice.js";
import { assistantAnswer } from "./advisor.js";
import { addSchedule, changeSchedule } from "./planning.js";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const lang = z.enum(["english", "hindi", "hinglish"]);
export function createApp(db = database()) {
  const app = express();
  const allowedOrigins = new Set([
    `http://127.0.0.1:${process.env.PORT || 5187}`,
    `http://localhost:${process.env.PORT || 5187}`,
  ]);
  const deploymentOrigin =
    process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  if (deploymentOrigin) {
    const configured = new URL(deploymentOrigin);
    if (
      configured.protocol !== "https:" ||
      configured.origin !== deploymentOrigin
    )
      throw new Error("APP_ORIGIN must be an exact HTTPS origin");
    allowedOrigins.add(configured.origin);
  }
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(process.env.NODE_ENV === "production"
              ? []
              : ["'unsafe-inline'"]),
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          mediaSrc: ["'self'", "blob:", "data:"],
          connectSrc: [
            "'self'",
            ...(process.env.NODE_ENV === "production"
              ? []
              : ["ws://127.0.0.1:*", "ws://localhost:*"]),
          ],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use("/api", (_q, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      message: { error: "RATE_LIMITED" },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (
        (origin && !allowedOrigins.has(origin)) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return res.status(403).json({ error: "ORIGIN_REJECTED" });
      if (!req.is("application/json") && !req.is("multipart/form-data"))
        return res.status(415).json({ error: "JSON_REQUIRED" });
    }
    next();
  });
  app.get("/api/health", (_q, r) =>
    r.json({
      ok: true,
      voiceConfigured: !!process.env.SARVAM_API_KEY,
      mode:
        process.env.NODE_ENV === "production" ? "online-test" : "local-demo",
      testAccessRequired: !!process.env.TEST_ACCESS_CODE,
    }),
  );
  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 60000,
      limit: 10,
      message: { error: "RATE_LIMITED" },
    }),
    (req, res) => {
      if (process.env.TEST_ACCESS_CODE) {
        const value = z.string().max(200).safeParse(req.body.testAccessCode);
        const digest = (s) => createHash("sha256").update(s).digest();
        if (
          !value.success ||
          !timingSafeEqual(
            digest(value.data),
            digest(process.env.TEST_ACCESS_CODE),
          )
        )
          return res.status(401).json({ error: "INVALID_TEST_ACCESS" });
      }
      const data = z
        .union([
          z.object({ recoveryKey: z.string().regex(/^[a-f0-9]{64}$/) }),
          z.object({
            phone: z.literal("9876543210"),
            pin: z.literal("123456"),
          }),
        ])
        .safeParse(req.body);
      if (!data.success)
        return res.status(401).json({ error: "INVALID_DEMO_CREDENTIALS" });
      // Every fresh browser session receives its own isolated synthetic merchant.
      let m;
      const existing = db
        .prepare("SELECT merchant FROM sessions WHERE hash=? AND expires>?")
        .get(hash(req.cookies.munim || ""), Date.now());
      const device = db
        .prepare("SELECT merchant FROM demo_devices WHERE hash=? AND expires>?")
        .get(hash(req.cookies.munim_device || ""), Date.now());
      if (data.data.recoveryKey) {
        const access = db
          .prepare("SELECT merchant FROM workspace_access WHERE hash=?")
          .get(hash(data.data.recoveryKey));
        if (!access)
          return res.status(401).json({ error: "INVALID_ACCESS_KEY" });
        m = access.merchant;
      } else if (existing) m = existing.merchant;
      else if (device) m = device.merchant;
      else {
        m = randomBytes(16).toString("hex");
        seed(db, m);
      }
      if (!device || device.merchant !== m) {
        const deviceToken = randomBytes(32).toString("hex");
        db.prepare("INSERT INTO demo_devices VALUES(?,?,?)").run(
          hash(deviceToken),
          m,
          Date.now() + 30 * 86400000,
        );
        res.cookie("munim_device", deviceToken, {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          maxAge: 30 * 86400000,
          path: "/",
        });
      }
      const token = randomBytes(32).toString("hex");
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        hash(token),
        m,
        Date.now() + 86400000,
      );
      res.cookie("munim", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 86400000,
        path: "/",
      });
      res.json({ ok: true });
    },
  );
  app.use("/api", (req, res, next) => {
    const s = db
      .prepare("SELECT merchant FROM sessions WHERE hash=? AND expires>?")
      .get(hash(req.cookies.munim || ""), Date.now());
    if (!s) return res.status(401).json({ error: "AUTH_REQUIRED" });
    req.merchant = s.merchant;
    const device = db
      .prepare("SELECT merchant FROM demo_devices WHERE hash=? AND expires>?")
      .get(hash(req.cookies.munim_device || ""), Date.now());
    if (!device || device.merchant !== s.merchant) {
      const token = randomBytes(32).toString("hex");
      db.prepare("INSERT INTO demo_devices VALUES(?,?,?)").run(
        hash(token),
        s.merchant,
        Date.now() + 30 * 86400000,
      );
      res.cookie("munim_device", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 86400000,
        path: "/",
      });
    }
    next();
  });
  app.get("/api/state", (q, r) =>
    r.json(
      snapshot(
        db,
        q.merchant,
        q.query.scenario === "conservative" ? "conservative" : "expected",
      ),
    ),
  );
  app.post("/api/auth/logout", (q, r) => {
    db.prepare("DELETE FROM sessions WHERE hash=?").run(hash(q.cookies.munim));
    db.prepare("DELETE FROM demo_devices WHERE hash=?").run(
      hash(q.cookies.munim_device || ""),
    );
    r.clearCookie("munim", { path: "/" })
      .clearCookie("munim_device", { path: "/" })
      .json({ ok: true });
  });
  app.post("/api/auth/recovery-key", (q, r) => {
    const key = randomBytes(32).toString("hex");
    db.transaction(() => {
      db.prepare("DELETE FROM workspace_access WHERE merchant=?").run(
        q.merchant,
      );
      db.prepare("INSERT INTO workspace_access VALUES(?,?)").run(
        hash(key),
        q.merchant,
      );
    })();
    r.json({ key });
  });
  app.patch("/api/shop", (q, r) => {
    const values = z
      .object({
        shop: z.string().trim().min(2).max(60),
        owner: z.string().trim().min(2).max(60),
        language: lang,
      })
      .parse(q.body);
    updateShop(db, q.merchant, values);
    r.json({ ok: true });
  });
  app.post("/api/entries", (q, r) => {
    const value = z
      .object({
        kind: z.enum(["sale", "expense", "udhaar", "collection", "receipt"]),
        amount: z.number().int().positive().max(100000000),
        name: z.string().trim().min(1).max(80),
        method: z.enum(["cash", "upi"]),
        note: z.string().max(300).optional(),
        dueId: z.string().max(100).optional(),
        scheduleId: z.string().max(100).optional(),
        scheduleVersion: z.number().int().positive().optional(),
        customerId: z.string().uuid().optional(),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.status(201).json(addEntry(db, q.merchant, value));
  });
  app.post("/api/entries/:id/reverse", (q, r) => {
    const v = z
      .object({
        reason: z.string().trim().min(3).max(300),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.json(reverseEntry(db, q.merchant, q.params.id, v.reason, v.requestKey));
  });
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      const d = new Date(v + "T12:00:00Z");
      return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, "Invalid date");
  const scheduleFields = {
    label: z.string().trim().min(2).max(80),
    amount: z.number().int().positive().max(100000000),
    date,
  };
  app.post("/api/schedule", (q, r) => {
    const v = z
      .object({
        ...scheduleFields,
        direction: z.enum(["in", "out"]),
        kind: z.enum(["sale", "collection", "receipt"]).optional(),
        dueId: z.string().max(100).optional(),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.status(201).json(addSchedule(db, q.merchant, v));
  });
  app.patch("/api/schedule/:id", (q, r) => {
    const v = z
      .union([
        z.object({
          status: z.literal("cancelled"),
          version: z.number().int().positive(),
        }),
        z.object({ ...scheduleFields, version: z.number().int().positive() }),
      ])
      .parse(q.body);
    r.json(changeSchedule(db, q.merchant, q.params.id, v));
  });
  app.post("/api/actions/propose", (q, r) =>
    r.status(201).json(propose(db, q.merchant)),
  );
  app.post("/api/actions/:id/decision", (q, r) => {
    const { approve } = z.object({ approve: z.boolean() }).parse(q.body);
    r.json(execute(db, q.merchant, q.params.id, approve));
  });
  app.use(
    "/api/voice",
    rateLimit({
      windowMs: 60000,
      limit: 30,
      keyGenerator: (q) => q.merchant,
      message: { error: "RATE_LIMITED" },
    }),
  );
  app.post("/api/voice/intent", async (q, r) => {
    const { text, language, previousTopic, scenario } = z
      .object({
        scenario: z.enum(["expected", "conservative"]).default("expected"),
        text: z.string().trim().min(1).max(1000),
        language: lang.default("hinglish"),
        previousTopic: z
          .enum([
            "cash",
            "dues",
            "forecast",
            "why",
            "plan",
            "sales",
            "entry",
            "reminders",
            "help",
          ])
          .optional(),
      })
      .parse(q.body);
    r.json(
      await assistantAnswer(
        db,
        q.merchant,
        text,
        language,
        previousTopic,
        scenario,
      ),
    );
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/voice/transcribe",
    rateLimit({
      windowMs: 60000,
      limit: 12,
      message: { error: "RATE_LIMITED" },
    }),
    upload.single("audio"),
    async (q, r) => {
      if (
        !q.file ||
        !["audio/webm", "audio/wav", "audio/mp4", "audio/ogg"].includes(
          q.file.mimetype,
        )
      )
        throw new DomainError("INVALID_AUDIO");
      r.json(await transcribe(q.file, lang.parse(q.body.language)));
    },
  );
  app.post(
    "/api/voice/speak",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      message: { error: "RATE_LIMITED" },
    }),
    async (q, r) => {
      const d = z
        .object({ text: z.string().trim().min(1).max(1200), language: lang })
        .parse(q.body);
      r.json(await speak(d.text, d.language));
    },
  );
  app.post("/api/loan/estimate", (q, r) => {
    const { amount, months, annualRate } = z
      .object({
        amount: z.number().int().min(10000).max(100000000),
        months: z.number().int().min(1).max(120),
        annualRate: z.number().min(0).max(60),
      })
      .parse(q.body);
    const rate = annualRate / 1200;
    const emi = Math.round(
      rate === 0
        ? amount / months
        : (amount * rate) / (1 - Math.pow(1 + rate, -months)),
    );
    const total = Math.max(amount, emi * months);
    r.json({
      emi,
      total,
      interest: total - amount,
      amount,
      months,
      annualRate,
      illustrative: true,
    });
  });
  app.get("/api/export", (q, r) =>
    r.attachment("munim-demo-export.json").json(exportArchive(db, q.merchant)),
  );
  app.post("/api/demo/reset", (q, r) => {
    resetDemo(db, q.merchant);
    r.clearCookie("munim", { path: "/" })
      .clearCookie("munim_device", { path: "/" })
      .json({ ok: true });
  });
  app.use("/api", (_q, r) => r.status(404).json({ error: "NOT_FOUND" }));
  app.use((err, _q, res, _next) => {
    const status =
      err instanceof z.ZodError
        ? 400
        : err instanceof multer.MulterError
          ? 413
          : err.status || 500;
    res.status(status).json({
      error:
        err instanceof z.ZodError
          ? "INVALID_INPUT"
          : status === 500
            ? "SERVER_ERROR"
            : err.message,
    });
  });
  return app;
}
