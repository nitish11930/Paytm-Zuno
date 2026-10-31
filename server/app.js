import { importColumns } from "./payment-import.js";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { database, DomainError, validDueDate } from "./domain.js";
import { transcribe, speak } from "./voice.js";
import { initializeVoiceLedger } from "./voice-ledger.js";
import { createSqliteRepository } from "./sqlite-adapter.js";
import { createPostgresPool, createPostgresRepository } from "./postgres.js";

const hash = (s) => createHash("sha256").update(s).digest("hex");
const sessionCookie = (req) => req.cookies?.zuno || req.cookies?.munim || "";
const deviceCookie = (req) =>
  req.cookies?.zuno_device || req.cookies?.munim_device || "";
const lang = z.enum(["english", "hindi", "hinglish"]);

export function createApp(dbOrRepo) {
  let repo;
  if (
    dbOrRepo &&
    (dbOrRepo.provider === "postgres" || dbOrRepo.provider === "sqlite")
  ) {
    repo = dbOrRepo;
  } else if (dbOrRepo && typeof dbOrRepo.prepare === "function") {
    initializeVoiceLedger(dbOrRepo);
    repo = createSqliteRepository(dbOrRepo);
  } else if (
    process.env.DB_PROVIDER === "postgres" ||
    (process.env.SUPABASE_DB_URL && process.env.NODE_ENV !== "test")
  ) {
    const pool = createPostgresPool();
    repo = createPostgresRepository(pool);
  } else {
    const db = database();
    initializeVoiceLedger(db);
    repo = createSqliteRepository(db);
  }

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
  app.use("/api/payments/preview", express.json({ limit: "256kb" }));
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
      databaseProvider: repo.provider,
    }),
  );

  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 60000,
      limit: 10,
      message: { error: "RATE_LIMITED" },
    }),
    async (req, res) => {
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

      let m;
      const existing = await repo.getMerchantBySession(
        hash(sessionCookie(req)),
      );
      const device = await repo.getMerchantByDevice(hash(deviceCookie(req)));

      if (data.data.recoveryKey) {
        const merchant = await repo.getMerchantByRecoveryKey(
          hash(data.data.recoveryKey),
        );
        if (!merchant)
          return res.status(401).json({ error: "INVALID_ACCESS_KEY" });
        m = merchant;
      } else if (existing) m = existing;
      else if (device) m = device;
      else {
        m = randomBytes(16).toString("hex");
        await repo.seed(m);
      }

      if (!device || device !== m) {
        const deviceToken = randomBytes(32).toString("hex");
        await repo.createDemoDevice(
          hash(deviceToken),
          m,
          Date.now() + 30 * 86400000,
        );
        res.cookie("zuno_device", deviceToken, {
          httpOnly: true,
          sameSite: "strict",
          secure: process.env.NODE_ENV === "production",
          maxAge: 30 * 86400000,
          path: "/",
        });
      }

      const token = randomBytes(32).toString("hex");
      await repo.createSession(hash(token), m, Date.now() + 86400000);
      res.cookie("zuno", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 86400000,
        path: "/",
      });
      res.json({ ok: true });
    },
  );

  app.use("/api", async (req, res, next) => {
    const merchant = await repo.getMerchantBySession(hash(sessionCookie(req)));
    if (!merchant) return res.status(401).json({ error: "AUTH_REQUIRED" });
    req.merchant = merchant;
    const device = await repo.getMerchantByDevice(hash(deviceCookie(req)));
    if (!device || device !== req.merchant) {
      const token = randomBytes(32).toString("hex");
      await repo.createDemoDevice(
        hash(token),
        req.merchant,
        Date.now() + 30 * 86400000,
      );
      res.cookie("zuno_device", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 86400000,
        path: "/",
      });
    }
    next();
  });

  app.get("/api/state", async (q, r) =>
    r.json(
      await repo.snapshot(
        q.merchant,
        q.query.scenario === "conservative" ? "conservative" : "expected",
      ),
    ),
  );

  app.post("/api/auth/logout", async (q, r) => {
    await repo.deleteSession(hash(sessionCookie(q)));
    await repo.deleteDemoDevice(hash(deviceCookie(q)));
    r.clearCookie("zuno", { path: "/" })
      .clearCookie("zuno_device", { path: "/" })
      .clearCookie("munim", { path: "/" })
      .clearCookie("munim_device", { path: "/" })
      .json({ ok: true });
  });

  app.post("/api/auth/recovery-key", async (q, r) => {
    const key = randomBytes(32).toString("hex");
    await repo.createRecoveryKey(q.merchant, hash(key));
    r.json({ key });
  });

  app.patch("/api/shop", async (q, r) => {
    const values = z
      .object({
        shop: z.string().trim().min(2).max(60),
        owner: z.string().trim().min(2).max(60),
        language: lang,
      })
      .parse(q.body);
    await repo.updateShop(q.merchant, values);
    r.json({ ok: true });
  });

  app.post("/api/entries", async (q, r) => {
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
        dueDate: z.string().refine(validDueDate).optional(),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.status(201).json(await repo.addEntry(q.merchant, value));
  });

  app.post("/api/entries/:id/reverse", async (q, r) => {
    const v = z
      .object({
        reason: z.string().trim().min(3).max(300),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.json(
      await repo.reverseEntry(q.merchant, q.params.id, v.reason, v.requestKey),
    );
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

  app.post("/api/schedule", async (q, r) => {
    const v = z
      .object({
        ...scheduleFields,
        direction: z.enum(["in", "out"]),
        kind: z.enum(["sale", "collection", "receipt"]).optional(),
        dueId: z.string().max(100).optional(),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.status(201).json(await repo.addSchedule(q.merchant, v));
  });

  app.patch("/api/schedule/:id", async (q, r) => {
    const v = z
      .union([
        z.object({
          status: z.literal("cancelled"),
          version: z.number().int().positive(),
        }),
        z.object({ ...scheduleFields, version: z.number().int().positive() }),
      ])
      .parse(q.body);
    r.json(await repo.changeSchedule(q.merchant, q.params.id, v));
  });

  app.post("/api/payments/preview", async (q, r) => {
    const v = z
      .object({
        csv: z.string().max(131072),
        mapping: z
          .object({
            reference: z.string(),
            date: z.string(),
            amount: z.string(),
            status: z.string(),
            name: z.string().optional(),
            recordType: z.string().optional(),
          })
          .optional(),
        defaultType: z.enum(["payment", "settlement"]).default("payment"),
        dateFormat: z.enum(["iso", "dmySlash", "dmyDash"]).default("iso"),
      })
      .parse(q.body);
    if (!v.mapping) return r.json(importColumns(v.csv));
    r.json(
      await repo.previewImport(
        q.merchant,
        v.csv,
        v.mapping,
        v.defaultType,
        v.dateFormat,
      ),
    );
  });

  app.post("/api/payments/imports/:id/confirm", async (q, r) =>
    r.json(
      await repo.confirmImport(
        q.merchant,
        z.string().uuid().parse(q.params.id),
      ),
    ),
  );

  app.post("/api/payments/:id/classify", async (q, r) => {
    const v = z
      .discriminatedUnion("category", [
        z.object({ category: z.literal("link"), entryId: z.string().uuid() }),
        z.object({
          category: z.literal("collection"),
          receivedConfirmed: z.literal(true),
          separateConfirmed: z.boolean().optional(),
          dueId: z.string().max(100),
        }),
        z.object({
          category: z.enum(["sale", "receipt"]),
          receivedConfirmed: z.literal(true),
          separateConfirmed: z.boolean().optional(),
        }),
      ])
      .parse(q.body);
    r.json(
      await repo.classifyPayment(
        q.merchant,
        z.string().uuid().parse(q.params.id),
        v,
      ),
    );
  });

  app.get("/api/follow-ups", async (q, r) =>
    r.json(await repo.followUpQueue(q.merchant)),
  );

  app.post("/api/actions/propose", async (q, r) => {
    const options = z
      .object({
        dueId: z.string().max(100).optional(),
        customerIds: z
          .array(z.string().min(1).max(100))
          .min(1)
          .max(200)
          .optional(),
        unpaidConfirmed: z.boolean().optional(),
      })
      .parse(q.body || {});
    r.status(201).json(await repo.propose(q.merchant, options));
  });

  app.post("/api/actions/:id/whatsapp-draft", async (q, r) => {
    const { customerId, phone } = z
      .object({
        customerId: z.string().min(1).max(100),
        phone: z.string().min(8).max(30),
      })
      .parse(q.body);
    r.json(
      await repo.whatsappDraft(q.merchant, q.params.id, customerId, phone),
    );
  });

  app.post("/api/actions/:id/decision", async (q, r) => {
    const { approve, customerIds } = z
      .object({
        approve: z.boolean(),
        customerIds: z
          .array(z.string().min(1).max(100))
          .min(1)
          .max(200)
          .optional(),
      })
      .parse(q.body);
    r.json(await repo.execute(q.merchant, q.params.id, approve, customerIds));
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

  app.get("/api/voice/ledger/current", async (q, r) =>
    r.json(await repo.currentVoiceLedger(q.merchant)),
  );

  app.post("/api/voice/ledger", async (q, r) => {
    const input = z
      .object({
        text: z.string().trim().min(1).max(1000),
        language: lang,
        requestKey: z.string().uuid(),
        followUpDueId: z.string().max(100).optional(),
        draftId: z.string().uuid().optional(),
        version: z.number().int().positive().optional(),
      })
      .refine((v) => !!v.draftId === !!v.version)
      .parse(q.body);
    r.json(await repo.voiceLedgerTurn(q.merchant, input));
  });

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
      await repo.assistantAnswer(
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

  app.post("/api/voice/ledger/audio", upload.single("audio"), async (q, r) => {
    if (!q.file) throw new DomainError("AUDIO_REQUIRED");
    const input = z
      .object({
        language: lang,
        requestKey: z.string().uuid(),
        followUpDueId: z.string().max(100).optional(),
        draftId: z.string().uuid().optional(),
        version: z.coerce.number().int().positive().optional(),
      })
      .refine((v) => !!v.draftId === !!v.version)
      .parse(q.body);
    const inputHash = createHash("sha256")
      .update(JSON.stringify(input))
      .update(q.file.buffer)
      .digest("hex");
    const cached = await repo.getAudioRequest(q.merchant, input.requestKey);
    if (cached) {
      if (cached.input_hash !== inputHash)
        throw new DomainError("IDEMPOTENCY_CONFLICT", 409);
      return r.json(
        typeof cached.result === "string"
          ? JSON.parse(cached.result)
          : cached.result,
      );
    }
    const spoken = await transcribe(q.file, input.language);
    const result = {
      ...(await repo.voiceLedgerTurn(q.merchant, {
        ...input,
        text: spoken.transcript,
      })),
      transcript: spoken.transcript,
    };
    await repo.saveAudioRequest(
      q.merchant,
      input.requestKey,
      inputHash,
      result,
    );
    r.json(result);
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

  // Product Catalog
  app.get("/api/products", async (q, r) => {
    r.json({ products: await repo.listProducts(q.merchant) });
  });

  app.post("/api/products", async (q, r) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(100),
        unit: z.string().trim().max(30).optional(),
        price: z.number().int().nonnegative().max(100000000),
        stock: z.number().nonnegative().optional(),
      })
      .parse(q.body);
    r.status(201).json({ product: await repo.addProduct(q.merchant, data) });
  });

  app.put("/api/products/:id", async (q, r) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        unit: z.string().trim().max(30).optional(),
        price: z.number().int().nonnegative().max(100000000).optional(),
        stock: z.number().nonnegative().optional(),
        active: z.boolean().optional(),
      })
      .parse(q.body);
    r.json({
      product: await repo.updateProduct(q.merchant, q.params.id, data),
    });
  });

  app.delete("/api/products/:id", async (q, r) => {
    r.json(await repo.deleteProduct(q.merchant, q.params.id));
  });

  // Orders & Billing
  app.post("/api/orders/parse", async (q, r) => {
    const data = z
      .object({ text: z.string().trim().min(1).max(500) })
      .parse(q.body);
    const catalog = await repo.listProducts(q.merchant);
    r.json(repo.parseOrderText(data.text, catalog));
  });

  app.get("/api/orders", async (q, r) => {
    const limit = Math.min(Number(q.query.limit) || 50, 100);
    r.json({ orders: await repo.listOrders(q.merchant, limit) });
  });

  app.post("/api/orders", async (q, r) => {
    const data = z
      .object({
        customerId: z.string().uuid().nullable().optional(),
        customerName: z.string().trim().max(80).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid().nullable().optional(),
              name: z.string().trim().min(1).max(100),
              quantity: z.number().positive(),
              unit: z.string().trim().max(30).optional(),
              unitPrice: z.number().int().nonnegative(),
            }),
          )
          .min(1),
        source: z.enum(["manual", "voice"]).optional(),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.status(201).json(await repo.createOrder(q.merchant, data));
  });

  app.post("/api/orders/:id/accept", async (q, r) => {
    r.json(await repo.acceptOrder(q.merchant, q.params.id));
  });

  app.post("/api/orders/:id/reject", async (q, r) => {
    const data = z
      .object({
        reason: z.string().trim().max(200).optional(),
      })
      .parse(q.body);
    r.json({ order: await repo.rejectOrder(q.merchant, q.params.id, data) });
  });

  app.post("/api/orders/:id/payment", async (q, r) => {
    const data = z
      .object({
        paymentStatus: z.enum(["paid", "unpaid"]),
        paymentMethod: z.enum(["cash", "upi"]).optional(),
        promiseDate: z.string().refine(validDueDate).nullable().optional(),
        customerId: z.string().uuid().nullable().optional(),
        customerName: z.string().trim().max(80).optional(),
        requestKey: z.string().uuid(),
      })
      .parse(q.body);
    r.json(await repo.completeOrderPayment(q.merchant, q.params.id, data));
  });

  app.get("/api/export", async (q, r) =>
    r
      .attachment("zuno-demo-export.json")
      .json(await repo.exportArchive(q.merchant)),
  );

  app.post("/api/demo/reset", async (q, r) => {
    await repo.resetDemo(q.merchant);
    r.clearCookie("zuno", { path: "/" })
      .clearCookie("zuno_device", { path: "/" })
      .clearCookie("munim", { path: "/" })
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
