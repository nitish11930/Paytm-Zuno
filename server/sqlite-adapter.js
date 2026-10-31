import {
  seed,
  updateShop,
  resetDemo,
  snapshot,
  addEntry,
  reverseEntry,
  dues,
  followUpQueue,
  propose,
  execute,
  whatsappDraft,
  exportArchive,
} from "./domain.js";
import { addSchedule, changeSchedule } from "./planning.js";
import {
  previewImport,
  confirmImport,
  classifyPayment,
} from "./payment-import.js";
import {
  currentVoiceLedger,
  voiceLedgerTurn,
} from "./voice-ledger.js";
import { assistantAnswer } from "./advisor.js";
import {
  listProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  parseOrderText,
  createOrder,
  acceptOrder,
  rejectOrder,
  completeOrderPayment,
  listOrders,
} from "./inventory.js";

export function createSqliteRepository(db) {
  return {
    provider: "sqlite",
    db,

    async getMerchantBySession(sessionHash) {
      const res = db
        .prepare("SELECT merchant FROM sessions WHERE hash = ? AND expires > ?")
        .get(sessionHash, Date.now());
      return res?.merchant || null;
    },

    async getMerchantByDevice(deviceHash) {
      const res = db
        .prepare("SELECT merchant FROM demo_devices WHERE hash = ? AND expires > ?")
        .get(deviceHash, Date.now());
      return res?.merchant || null;
    },

    async getMerchantByRecoveryKey(keyHash) {
      const res = db
        .prepare("SELECT merchant FROM workspace_access WHERE hash = ?")
        .get(keyHash);
      return res?.merchant || null;
    },

    async createSession(sessionHash, merchant, expires) {
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        sessionHash,
        merchant,
        expires,
      );
    },

    async createDemoDevice(deviceHash, merchant, expires) {
      db.prepare("INSERT INTO demo_devices VALUES(?,?,?)").run(
        deviceHash,
        merchant,
        expires,
      );
    },

    async deleteSession(sessionHash) {
      db.prepare("DELETE FROM sessions WHERE hash = ?").run(sessionHash);
    },

    async deleteDemoDevice(deviceHash) {
      db.prepare("DELETE FROM demo_devices WHERE hash = ?").run(deviceHash);
    },

    async createRecoveryKey(merchant, keyHash) {
      db.transaction(() => {
        db.prepare("DELETE FROM workspace_access WHERE merchant = ?").run(merchant);
        db.prepare("INSERT INTO workspace_access VALUES(?,?)").run(keyHash, merchant);
      })();
    },

    async seed(merchant) {
      seed(db, merchant);
    },

    async updateShop(merchant, values) {
      updateShop(db, merchant, values);
    },

    async resetDemo(merchant) {
      resetDemo(db, merchant);
    },

    async snapshot(merchant, scenario, complete = false) {
      return snapshot(db, merchant, scenario, complete);
    },

    async addEntry(merchant, value, options = {}) {
      return addEntry(db, merchant, value, options);
    },

    async reverseEntry(merchant, id, reason, requestKey) {
      return reverseEntry(db, merchant, id, reason, requestKey);
    },

    async dues(merchant) {
      return dues(db, merchant);
    },

    async addSchedule(merchant, value) {
      return addSchedule(db, merchant, value);
    },

    async changeSchedule(merchant, id, value) {
      return changeSchedule(db, merchant, id, value);
    },

    async previewImport(merchant, csv, mapping, defaultType, dateFormat) {
      return previewImport(db, merchant, csv, mapping, defaultType, dateFormat);
    },

    async confirmImport(merchant, id) {
      return confirmImport(db, merchant, id);
    },

    async classifyPayment(merchant, id, value) {
      return classifyPayment(db, merchant, id, value);
    },

    async followUpQueue(merchant, today) {
      return followUpQueue(db, merchant, today);
    },

    async propose(merchant, options) {
      return propose(db, merchant, options);
    },

    async execute(merchant, id, approve, customerIds) {
      return execute(db, merchant, id, approve, customerIds);
    },

    async whatsappDraft(merchant, proposalId, customerId, phone) {
      return whatsappDraft(db, merchant, proposalId, customerId, phone);
    },

    async currentVoiceLedger(merchant) {
      return currentVoiceLedger(db, merchant);
    },

    async voiceLedgerTurn(merchant, input) {
      return await voiceLedgerTurn(db, merchant, input);
    },

    async getAudioRequest(merchant, requestKey) {
      return db
        .prepare("SELECT * FROM voice_audio_requests WHERE merchant = ? AND request_key = ?")
        .get(merchant, requestKey);
    },

    async saveAudioRequest(merchant, requestKey, inputHash, result) {
      db.prepare(
        "INSERT OR IGNORE INTO voice_audio_requests VALUES(?,?,?,?)",
      ).run(merchant, requestKey, inputHash, JSON.stringify(result));
    },

    async assistantAnswer(merchant, text, language, previousTopic, scenario) {
      return await assistantAnswer(db, merchant, text, language, previousTopic, scenario);
    },

    async listProducts(merchant) {
      return listProducts(db, merchant);
    },

    async addProduct(merchant, data) {
      return addProduct(db, merchant, data);
    },

    async updateProduct(merchant, id, data) {
      return updateProduct(db, merchant, id, data);
    },

    async deleteProduct(merchant, id) {
      return deleteProduct(db, merchant, id);
    },

    parseOrderText(text, catalog) {
      return parseOrderText(text, catalog);
    },

    async createOrder(merchant, data) {
      return createOrder(db, merchant, data);
    },

    async acceptOrder(merchant, id) {
      return acceptOrder(db, merchant, id);
    },

    async rejectOrder(merchant, id, data) {
      return rejectOrder(db, merchant, id, data);
    },

    async completeOrderPayment(merchant, id, data) {
      return completeOrderPayment(db, merchant, id, data);
    },

    async listOrders(merchant, limit) {
      return listOrders(db, merchant, limit);
    },

    async exportArchive(merchant) {
      return exportArchive(db, merchant);
    },
  };
}
