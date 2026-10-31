import { randomUUID, randomBytes } from "node:crypto";
import { day, DomainError } from "./core.js";
import { addEntry } from "./domain.js";

export function initInventorySchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    merchant TEXT NOT NULL REFERENCES merchants(id),
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'packet',
    price INTEGER NOT NULL CHECK(price >= 0),
    stock REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant, active);

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    merchant TEXT NOT NULL REFERENCES merchants(id),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
    status TEXT NOT NULL,
    rejection_reason TEXT,
    bill_number TEXT,
    entry_id TEXT REFERENCES entries(id),
    source TEXT NOT NULL DEFAULT 'manual',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    request_key TEXT NOT NULL,
    created TEXT NOT NULL,
    UNIQUE(merchant, request_key)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant, created);

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL,
    unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
    total_price INTEGER NOT NULL CHECK(total_price >= 0)
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);`);
}

export const DEFAULT_KIRANA_PRODUCTS = [
  { name: "Amul Taza Doodh 500ml", unit: "packet", price: 2800, stock: 40 },
  { name: "Harvest Gold White Bread", unit: "packet", price: 3500, stock: 25 },
  { name: "Cheeni / Sugar", unit: "kg", price: 4400, stock: 80 },
  { name: "Tata Tea Gold 250g", unit: "packet", price: 14000, stock: 30 },
  { name: "Aashirvaad Shudh Chakki Atta 5kg", unit: "packet", price: 23500, stock: 20 },
  { name: "Fortune Kachi Ghani Mustard Oil 1L", unit: "litre", price: 15500, stock: 35 },
  { name: "Dettol Bathing Soap 75g", unit: "piece", price: 4000, stock: 50 },
  { name: "Maggi 2-Minute Noodles 70g", unit: "packet", price: 1400, stock: 60 },
];

export function seedDefaultProducts(db, merchant) {
  const count = db
    .prepare("SELECT COUNT(*) AS c FROM products WHERE merchant=?")
    .get(merchant);
  if (count && count.c > 0) return;

  const insert = db.prepare(
    "INSERT INTO products VALUES(?,?,?,?,?,?,?,?)",
  );
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const item of DEFAULT_KIRANA_PRODUCTS) {
      insert.run(
        randomUUID(),
        merchant,
        item.name,
        item.unit,
        item.price,
        item.stock,
        1,
        now,
      );
    }
  })();
}

export function listProducts(db, merchant) {
  seedDefaultProducts(db, merchant);
  return db
    .prepare("SELECT * FROM products WHERE merchant=? AND active=1 ORDER BY name ASC")
    .all(merchant);
}

export function addProduct(db, merchant, { name, unit = "packet", price = 0, stock = 0 }) {
  if (!name || !name.trim()) throw new DomainError("PRODUCT_NAME_REQUIRED", 400);
  const cleanPrice = Math.round(Number(price));
  if (isNaN(cleanPrice) || cleanPrice < 0) throw new DomainError("INVALID_PRODUCT_PRICE", 400);

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO products VALUES(?,?,?,?,?,?,?,?)").run(
    id,
    merchant,
    name.trim(),
    (unit || "packet").trim().toLowerCase(),
    cleanPrice,
    Number(stock) || 0,
    1,
    now,
  );
  return db.prepare("SELECT * FROM products WHERE id=? AND merchant=?").get(id, merchant);
}

export function updateProduct(db, merchant, id, { name, unit, price, stock, active }) {
  const current = db
    .prepare("SELECT * FROM products WHERE id=? AND merchant=?")
    .get(id, merchant);
  if (!current) throw new DomainError("PRODUCT_NOT_FOUND", 404);

  const newName = name !== undefined ? name.trim() : current.name;
  if (!newName) throw new DomainError("PRODUCT_NAME_REQUIRED", 400);
  const newPrice = price !== undefined ? Math.round(Number(price)) : current.price;
  if (isNaN(newPrice) || newPrice < 0) throw new DomainError("INVALID_PRODUCT_PRICE", 400);
  const newStock = stock !== undefined ? Number(stock) : current.stock;
  const newUnit = unit !== undefined ? unit.trim().toLowerCase() : current.unit;
  const newActive = active !== undefined ? (active ? 1 : 0) : current.active;

  db.prepare(
    "UPDATE products SET name=?, unit=?, price=?, stock=?, active=? WHERE id=? AND merchant=?",
  ).run(newName, newUnit, newPrice, newStock, newActive, id, merchant);

  return db.prepare("SELECT * FROM products WHERE id=? AND merchant=?").get(id, merchant);
}

export function deleteProduct(db, merchant, id) {
  const res = db
    .prepare("UPDATE products SET active=0 WHERE id=? AND merchant=?")
    .run(id, merchant);
  if (res.changes === 0) throw new DomainError("PRODUCT_NOT_FOUND", 404);
  return { ok: true, id };
}

// Number & Unit dictionary for Hinglish / Hindi parsing
const HINDI_NUMBERS = {
  "ek": 1, "एक": 1, "one": 1, "1": 1,
  "do": 2, "दो": 2, "two": 2, "2": 2,
  "teen": 3, "तीन": 3, "three": 3, "3": 3,
  "chaar": 4, "char": 4, "चार": 4, "four": 4, "4": 4,
  "paanch": 5, "panch": 5, "पाँच": 5, "पांच": 5, "five": 5, "5": 5,
  "chhe": 6, "che": 6, "छह": 6, "six": 6, "6": 6,
  "saat": 7, "सात": 7, "seven": 7, "7": 7,
  "aath": 8, "आठ": 8, "eight": 8, "8": 8,
  "nau": 9, "नौ": 9, "nine": 9, "9": 9,
  "das": 10, "दस": 10, "ten": 10, "10": 10,
  "aadha": 0.5, "adha": 0.5, "आधा": 0.5, "half": 0.5,
  "pao": 0.25, "पाव": 0.25,
  "dedh": 1.5, "डेढ़": 1.5,
  "dhai": 2.5, "ढाई": 2.5,
};

const UNIT_PATTERNS = [
  { match: /^(packet|pack|pkt|packets|packeton|पैकेट|पैकेटों)/i, unit: "packet" },
  { match: /^(kg|kilo|kilos|kilogram|किलो|किग्रा)/i, unit: "kg" },
  { match: /^(litre|liter|ltr|ltrs|लीटर)/i, unit: "litre" },
  { match: /^(piece|pc|pcs|पीस|नग)/i, unit: "piece" },
  { match: /^(bottle|bottles|बोतल)/i, unit: "bottle" },
];

export function parseOrderText(text, catalogProducts = []) {
  if (!text || typeof text !== "string") return { items: [], total: 0 };

  const cleaned = text
    .toLowerCase()
    .replace(/[,;+]/g, " aur ")
    .replace(/\s+/g, " ")
    .trim();

  // Split by "aur", "and", "or", or commas/newlines
  const segments = cleaned
    .split(/\s+aur\s+|\s+and\s+|\s+bhi\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsedItems = [];

  for (const seg of segments) {
    const tokens = seg.split(" ").filter(Boolean);
    if (!tokens.length) continue;

    let quantity = 1;
    let unit = "packet";
    let remainingTokens = [...tokens];

    // Check first token for number
    const first = tokens[0];
    if (HINDI_NUMBERS[first] !== undefined) {
      quantity = HINDI_NUMBERS[first];
      remainingTokens.shift();
    } else if (!isNaN(parseFloat(first))) {
      quantity = parseFloat(first);
      remainingTokens.shift();
    }

    // Check next token for unit
    if (remainingTokens.length > 0) {
      const nextTok = remainingTokens[0];
      for (const up of UNIT_PATTERNS) {
        if (up.match.test(nextTok)) {
          unit = up.unit;
          remainingTokens.shift();
          break;
        }
      }
    }

    const itemQuery = remainingTokens.join(" ").trim();
    if (!itemQuery) continue;

    // Match query against catalogProducts
    let matchedProduct = null;
    let bestScore = 0;

    for (const prod of catalogProducts) {
      const prodName = prod.name.toLowerCase();
      // Exact substring match
      if (prodName.includes(itemQuery) || itemQuery.includes(prodName)) {
        matchedProduct = prod;
        break;
      }
      // Check individual keywords
      const prodWords = prodName.split(/[\s/]+/);
      const queryWords = itemQuery.split(/[\s/]+/);
      let matches = 0;
      for (const qw of queryWords) {
        if (qw.length > 2 && prodWords.some((pw) => pw.includes(qw) || qw.includes(pw))) {
          matches++;
        }
      }
      if (matches > bestScore) {
        bestScore = matches;
        matchedProduct = prod;
      }
    }

    if (matchedProduct) {
      const unitPrice = matchedProduct.price;
      const totalPrice = Math.round(quantity * unitPrice);
      parsedItems.push({
        productId: matchedProduct.id,
        name: matchedProduct.name,
        quantity,
        unit: matchedProduct.unit || unit,
        unitPrice,
        totalPrice,
        matched: true,
      });
    } else {
      // Unmatched item, default unit price to 0 so merchant can specify
      parsedItems.push({
        productId: null,
        name: itemQuery.charAt(0).toUpperCase() + itemQuery.slice(1),
        quantity,
        unit,
        unitPrice: 0,
        totalPrice: 0,
        matched: false,
      });
    }
  }

  const total = parsedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  return { items: parsedItems, total };
}

export function createOrder(
  db,
  merchant,
  { customerId = null, customerName = "Counter Customer", items = [], source = "manual", requestKey = randomUUID() },
) {
  if (!items || items.length === 0) {
    throw new DomainError("EMPTY_ORDER_ITEMS", 400);
  }

  return db.transaction(() => {
    const existing = db
      .prepare("SELECT * FROM orders WHERE merchant=? AND request_key=?")
      .get(merchant, requestKey);
    if (existing) {
      const existingItems = db
        .prepare("SELECT * FROM order_items WHERE order_id=?")
        .all(existing.id);
      return { order: existing, items: existingItems };
    }

    let totalAmount = 0;
    for (const it of items) {
      const lineTotal = Math.round(Number(it.quantity) * Number(it.unitPrice));
      totalAmount += lineTotal;
    }

    const orderId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      orderId,
      merchant,
      customerId || null,
      (customerName || "Counter Customer").trim(),
      totalAmount,
      "draft",
      null,
      null,
      null,
      source,
      "pending",
      requestKey,
      now,
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items VALUES(?,?,?,?,?,?,?,?)`,
    );

    const savedItems = [];
    for (const it of items) {
      const itemId = randomUUID();
      const unitPrice = Math.round(Number(it.unitPrice) || 0);
      const quantity = Number(it.quantity) || 1;
      const lineTotal = Math.round(quantity * unitPrice);
      insertItem.run(
        itemId,
        orderId,
        it.productId || null,
        (it.name || "Item").trim(),
        quantity,
        (it.unit || "packet").trim(),
        unitPrice,
        lineTotal,
      );
      savedItems.push({
        id: itemId,
        orderId,
        productId: it.productId || null,
        name: it.name,
        quantity,
        unit: it.unit || "packet",
        unitPrice,
        totalPrice: lineTotal,
      });
    }

    const order = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    return { order, items: savedItems };
  })();
}

export function rejectOrder(db, merchant, orderId, { reason = "Merchant rejected" } = {}) {
  return db.transaction(() => {
    const order = db
      .prepare("SELECT * FROM orders WHERE id=? AND merchant=?")
      .get(orderId, merchant);
    if (!order) throw new DomainError("ORDER_NOT_FOUND", 404);
    if (order.status === "completed") {
      throw new DomainError("CANNOT_REJECT_COMPLETED_ORDER", 400);
    }

    db.prepare(
      "UPDATE orders SET status='rejected', rejection_reason=? WHERE id=? AND merchant=?",
    ).run(reason || "Merchant rejected", orderId, merchant);

    db.prepare(
      "INSERT INTO audit VALUES(?,?,?,?,?)",
    ).run(
      randomUUID(),
      merchant,
      "order_rejected",
      JSON.stringify({ orderId, reason, totalAmount: order.total_amount }),
      new Date().toISOString(),
    );

    return db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
  })();
}

export function acceptOrder(db, merchant, orderId) {
  return db.transaction(() => {
    const order = db
      .prepare("SELECT * FROM orders WHERE id=? AND merchant=?")
      .get(orderId, merchant);
    if (!order) throw new DomainError("ORDER_NOT_FOUND", 404);
    if (order.status === "rejected") {
      throw new DomainError("CANNOT_ACCEPT_REJECTED_ORDER", 400);
    }
    if (order.bill_number) {
      const items = db
        .prepare("SELECT * FROM order_items WHERE order_id=?")
        .all(orderId);
      return { order, items };
    }

    const datePrefix = day().replace(/-/g, "");
    const randomHex = randomBytes(2).toString("hex").toUpperCase();
    const billNumber = `BILL-${datePrefix}-${randomHex}`;

    db.prepare(
      "UPDATE orders SET status='accepted', bill_number=? WHERE id=? AND merchant=?",
    ).run(billNumber, orderId, merchant);

    // Decrement stock for inventory products
    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id=?")
      .all(orderId);

    const updateStock = db.prepare(
      "UPDATE products SET stock = MAX(0, stock - ?) WHERE id=? AND merchant=?",
    );

    for (const it of items) {
      if (it.product_id) {
        updateStock.run(it.quantity, it.product_id, merchant);
      }
    }

    db.prepare(
      "INSERT INTO audit VALUES(?,?,?,?,?)",
    ).run(
      randomUUID(),
      merchant,
      "bill_generated",
      JSON.stringify({ orderId, billNumber, totalAmount: order.total_amount }),
      new Date().toISOString(),
    );

    const updated = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    return { order: updated, items };
  })();
}

export function completeOrderPayment(
  db,
  merchant,
  orderId,
  {
    paymentStatus, // 'paid' or 'unpaid'
    paymentMethod = "cash", // 'cash' or 'upi'
    promiseDate = null,
    customerId = null,
    customerName = null,
    requestKey = randomUUID(),
  },
) {
  return db.transaction(() => {
    const order = db
      .prepare("SELECT * FROM orders WHERE id=? AND merchant=?")
      .get(orderId, merchant);
    if (!order) throw new DomainError("ORDER_NOT_FOUND", 404);
    if (order.status === "completed") {
      return { order, alreadyCompleted: true };
    }
    if (order.status !== "accepted") {
      throw new DomainError("ORDER_MUST_BE_ACCEPTED_FIRST", 400);
    }

    const cName = (customerName || order.customer_name || "Counter Customer").trim();
    const billNum = order.bill_number || `ORDER-${order.id.slice(0, 8)}`;

    let entryId = null;

    if (paymentStatus === "paid") {
      const entryResult = addEntry(
        db,
        merchant,
        {
          kind: "sale",
          amount: order.total_amount,
          name: cName,
          method: paymentMethod === "upi" ? "upi" : "cash",
          note: `Bill #${billNum}`,
          requestKey: `order-pay-${order.id}-${requestKey}`,
        },
        { source: "order" },
      );
      entryId = entryResult.id;

      db.prepare(
        "UPDATE orders SET status='completed', payment_status='paid', entry_id=? WHERE id=? AND merchant=?",
      ).run(entryId, orderId, merchant);

      db.prepare(
        "INSERT INTO audit VALUES(?,?,?,?,?)",
      ).run(
        randomUUID(),
        merchant,
        "order_paid",
        JSON.stringify({ orderId, billNumber: billNum, method: paymentMethod, amount: order.total_amount }),
        new Date().toISOString(),
      );
    } else if (paymentStatus === "unpaid") {
      // Udhaar order: must have customer name
      if (!cName || cName.toLowerCase() === "counter customer") {
        throw new DomainError("CUSTOMER_NAME_REQUIRED_FOR_UDHAAR", 400);
      }

      const entryResult = addEntry(
        db,
        merchant,
        {
          kind: "udhaar",
          amount: order.total_amount,
          name: cName,
          method: "cash",
          note: `Bill #${billNum}`,
          dueDate: promiseDate || null,
          customerId: customerId || null,
          requestKey: `order-udhaar-${order.id}-${requestKey}`,
        },
        { source: "order" },
      );
      entryId = entryResult.id;

      db.prepare(
        "UPDATE orders SET status='completed', payment_status='unpaid', entry_id=?, customer_name=? WHERE id=? AND merchant=?",
      ).run(entryId, cName, orderId, merchant);

      db.prepare(
        "INSERT INTO audit VALUES(?,?,?,?,?)",
      ).run(
        randomUUID(),
        merchant,
        "order_udhaar_recorded",
        JSON.stringify({ orderId, billNumber: billNum, customerName: cName, dueDate: promiseDate, amount: order.total_amount }),
        new Date().toISOString(),
      );
    } else {
      throw new DomainError("INVALID_PAYMENT_STATUS", 400);
    }

    const completedOrder = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    const items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(orderId);
    return { order: completedOrder, items, entryId };
  })();
}

export function listOrders(db, merchant, limit = 50) {
  const rows = db
    .prepare(
      `SELECT o.*,
        (SELECT json_group_array(json_object(
          'id', i.id,
          'productId', i.product_id,
          'name', i.item_name,
          'quantity', i.quantity,
          'unit', i.unit,
          'unitPrice', i.unit_price,
          'totalPrice', i.total_price
        )) FROM order_items i WHERE i.order_id=o.id) AS items_json
      FROM orders o
      WHERE o.merchant=?
      ORDER BY o.created DESC
      LIMIT ?`,
    )
    .all(merchant, limit);

  return rows.map((r) => ({
    ...r,
    items: JSON.parse(r.items_json || "[]"),
  }));
}
