import React, { useState } from "react";
import {
  Receipt,
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Send,
  X,
  CreditCard,
  Banknote,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { money } from "../lib.js";

export function OrderModal({
  catalog = [],
  customers = [],
  language,
  t,
  onClose,
  onSuccess,
}) {
  // Steps in the user flow:
  // 'input': Step 1-3 (Customer order text/catalog selection -> AI parser)
  // 'review': Step 4-5 (Order details display + Merchant Accept/Reject)
  // 'rejected': Step 5 Rejection Record
  // 'billing': Step 6-7 (Bill generated, customer payment decision: Paid vs Unpaid)
  // 'promise': Step 7 Unpaid Promise Date & Reminder schedule
  // 'completed': Step 8-9 (Ledger updated, Dashboard updated, Bill shareable)

  const [step, setStep] = useState("input");
  const [orderText, setOrderText] = useState("");
  const [customerName, setCustomerName] = useState("Counter Customer");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [items, setItems] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Completed order state
  const [acceptedOrder, setAcceptedOrder] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [paymentChoice, setPaymentChoice] = useState("cash"); // 'cash' or 'upi'
  const [promiseDate, setPromiseDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse text using backend API
  const handleParseText = async (e) => {
    if (e) e.preventDefault();
    if (!orderText.trim()) return;

    setParsing(true);
    setError("");
    try {
      const res = await fetch("/api/orders/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: orderText.trim() }),
      });
      if (!res.ok) throw new Error("Could not parse order items");
      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        setError("Koi item recognize nahi hua. Neeche catalog se select karein.");
      } else {
        setItems(data.items);
        setStep("review");
      }
    } catch (err) {
      setError(err.message || "Failed to parse order");
    } finally {
      setParsing(false);
    }
  };

  // Add item directly from catalog
  const handleAddFromCatalog = (product) => {
    const existingIndex = items.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].totalPrice =
        updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unit: product.unit || "packet",
          unitPrice: product.price,
          totalPrice: product.price,
          matched: true,
        },
      ]);
    }
    if (step === "input") {
      setStep("review");
    }
  };

  const handleQuantityChange = (index, delta) => {
    const updated = [...items];
    const newQty = Math.max(0.25, updated[index].quantity + delta);
    updated[index].quantity = newQty;
    updated[index].totalPrice = Math.round(newQty * updated[index].unitPrice);
    setItems(updated);
  };

  const handlePriceChange = (index, rupees) => {
    const updated = [...items];
    const paise = Math.round(parseFloat(rupees || 0) * 100);
    updated[index].unitPrice = paise;
    updated[index].totalPrice = Math.round(updated[index].quantity * paise);
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    if (items.length <= 1) {
      setStep("input");
    }
  };

  const grandTotal = items.reduce((acc, it) => acc + (it.totalPrice || 0), 0);

  // Step 5: Merchant Accept
  const handleAcceptOrder = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. Create order
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerId: selectedCustomerId,
          items: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
          })),
          source: orderText ? "voice" : "manual",
          requestKey: crypto.randomUUID(),
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create order");
      const createdData = await createRes.json();
      const orderId = createdData.order.id;

      // 2. Accept order -> generates bill
      const acceptRes = await fetch(`/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!acceptRes.ok) throw new Error("Failed to accept order");
      const acceptedData = await acceptRes.json();

      setAcceptedOrder(acceptedData.order);
      setStep("billing");
    } catch (err) {
      setError(err.message || "Failed to process order acceptance");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 5: Merchant Reject
  const handleRejectOrder = async () => {
    setSubmitting(true);
    setError("");
    try {
      // 1. Create order as draft
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerId: selectedCustomerId,
          items: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
          })),
          source: orderText ? "voice" : "manual",
          requestKey: crypto.randomUUID(),
        }),
      });
      if (!createRes.ok) throw new Error("Failed to register order for rejection");
      const createdData = await createRes.json();

      // 2. Reject order
      const rejectRes = await fetch(`/api/orders/${createdData.order.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason || "Merchant rejected" }),
      });
      if (!rejectRes.ok) throw new Error("Failed to reject order");
      setStep("rejected");
    } catch (err) {
      setError(err.message || "Failed to reject order");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 7: Complete Payment (Paid)
  const handlePaidSubmit = async () => {
    if (!acceptedOrder) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${acceptedOrder.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "paid",
          paymentMethod: paymentChoice,
          customerName: customerName.trim(),
          requestKey: crypto.randomUUID(),
        }),
      });
      if (!res.ok) throw new Error("Payment record failed");
      const data = await res.json();
      setCompletedOrder(data.order);
      setStep("completed");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 7: Complete Payment (Udhaar / Unpaid)
  const handleUdhaarSubmit = async () => {
    if (!acceptedOrder) return;
    if (!customerName || customerName.trim() === "Counter Customer") {
      setError("Udhaar ke liye Customer ka naam zaroori hai");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${acceptedOrder.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: "unpaid",
          customerName: customerName.trim(),
          customerId: selectedCustomerId,
          promiseDate: promiseDate || null,
          requestKey: crypto.randomUUID(),
        }),
      });
      if (!res.ok) throw new Error("Udhaar record failed");
      const data = await res.json();
      setCompletedOrder(data.order);
      setStep("completed");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to record udhaar");
    } finally {
      setSubmitting(false);
    }
  };

  // Quick promise date presets
  const setPresetDate = (days) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setPromiseDate(target.toISOString().slice(0, 10));
  };

  // Copy Bill receipt for WhatsApp
  const handleCopyBill = () => {
    if (!acceptedOrder && !completedOrder) return;
    const ord = completedOrder || acceptedOrder;
    const lines = [
      `🧾 *Zuno Bill - ${ord.bill_number}*`,
      `📅 Date: ${new Date().toLocaleDateString("en-IN")}`,
      `👤 Customer: ${customerName}`,
      `---------------------------`,
      ...items.map(
        (it) =>
          `• ${it.name} (${it.quantity} ${it.unit}) = ₹${(
            it.totalPrice / 100
          ).toFixed(2)}`,
      ),
      `---------------------------`,
      `*Total: ₹${(grandTotal / 100).toFixed(2)}*`,
      `Status: ${
        completedOrder?.payment_status === "paid"
          ? `PAID (${paymentChoice.toUpperCase()}) ✅`
          : `UDHAAR (Due: ${promiseDate || "Pending"}) ⏳`
      }`,
      `\nDhanyawad! Phir aaiyega 🙏`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div
        className="order-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("orderTitle")}
      >
        <div className="order-modal-header">
          <div className="title-area">
            <span className="badge-pill emerald">
              <Receipt size={14} />
              {t("orderTitle")}
            </span>
            <h3>{t("orderTitle")}</h3>
            <p className="caption">{t("orderSubtitle")}</p>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="form-error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1 & 2: INPUT ORDER */}
        {step === "input" && (
          <div className="order-step-input">
            <form onSubmit={handleParseText} className="order-text-box">
              <label>
                <span>Order bolein ya likhein (Voice / Hinglish)</span>
                <div className="input-with-button">
                  <input
                    type="text"
                    value={orderText}
                    onChange={(e) => setOrderText(e.target.value)}
                    placeholder={t("typeOrderHint")}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={parsing || !orderText.trim()}
                  >
                    <Sparkles size={16} />
                    <span>{parsing ? "Checking..." : t("parseOrder")}</span>
                  </button>
                </div>
              </label>
            </form>

            <div className="catalog-selection-area">
              <span className="section-label">{t("selectFromCatalog")}</span>
              <div className="catalog-chips-grid">
                {catalog.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="catalog-chip"
                    onClick={() => handleAddFromCatalog(p)}
                  >
                    <strong>{p.name}</strong>
                    <span>
                      {money(p.price)} / {p.unit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 & 5: ORDER DETAILS DISPLAY & MERCHANT CONFIRMATION */}
        {step === "review" && (
          <div className="order-step-review">
            <div className="customer-name-row">
              <label>
                <span>Customer</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Sharma ji, Counter Customer"
                />
              </label>
            </div>

            <div className="order-items-table">
              <div className="table-header">
                <span>Item</span>
                <span>Qty</span>
                <span>Rate</span>
                <span>Total</span>
                <span></span>
              </div>
              <div className="table-body">
                {items.map((it, idx) => (
                  <div key={idx} className="table-row">
                    <div className="item-name-cell">
                      <strong>{it.name}</strong>
                      {!it.matched && (
                        <span className="unmatched-badge">Custom</span>
                      )}
                    </div>
                    <div className="item-qty-cell">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, -1)}
                      >
                        -
                      </button>
                      <span>
                        {it.quantity} {it.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="item-rate-cell">
                      {it.matched ? (
                        <span>{money(it.unitPrice)}</span>
                      ) : (
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={it.unitPrice / 100 || ""}
                          placeholder="Rate"
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                        />
                      )}
                    </div>
                    <div className="item-total-cell">
                      <strong>{money(it.totalPrice)}</strong>
                    </div>
                    <div className="item-action-cell">
                      <button
                        type="button"
                        className="btn-icon danger"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-grand-total-card">
              <span>{t("grandTotal")}</span>
              <strong>{money(grandTotal)}</strong>
            </div>

            {/* Merchant Decision: Accept vs Reject */}
            <div className="merchant-decision-row">
              <div className="reject-container">
                <input
                  type="text"
                  placeholder={t("rejectionReason")}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-reject"
                  onClick={handleRejectOrder}
                  disabled={submitting}
                >
                  <XCircle size={16} />
                  <span>{t("rejectOrder")}</span>
                </button>
              </div>

              <button
                type="button"
                className="btn-accept"
                onClick={handleAcceptOrder}
                disabled={submitting || grandTotal <= 0}
              >
                <CheckCircle2 size={18} />
                <span>{submitting ? "Processing..." : t("acceptOrder")}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REJECTED STATE */}
        {step === "rejected" && (
          <div className="order-step-status rejected">
            <XCircle size={44} className="text-rose" />
            <h4>Order Rejected</h4>
            <p>
              Rejection audit record create ho gaya hai. Ledger par koi financial
              asarr nahi padega.
            </p>
            <button className="btn-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* STEP 6 & 7: BILL GENERATED & CUSTOMER PAYMENT */}
        {step === "billing" && acceptedOrder && (
          <div className="order-step-billing">
            <div className="bill-success-banner">
              <Receipt size={24} />
              <div>
                <strong>{acceptedOrder.bill_number}</strong>
                <p>Bill generated · {money(acceptedOrder.total_amount)}</p>
              </div>
            </div>

            <div className="payment-decision-box">
              <h4>{t("paymentPrompt")}</h4>

              <div className="payment-choices">
                <div className="paid-section">
                  <span className="choice-label">{t("paidOption")}</span>
                  <div className="method-toggles">
                    <button
                      type="button"
                      className={`method-btn ${
                        paymentChoice === "cash" ? "active" : ""
                      }`}
                      onClick={() => setPaymentChoice("cash")}
                    >
                      <Banknote size={16} />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      className={`method-btn ${
                        paymentChoice === "upi" ? "active" : ""
                      }`}
                      onClick={() => setPaymentChoice("upi")}
                    >
                      <CreditCard size={16} />
                      <span>UPI</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-primary full-width"
                    onClick={handlePaidSubmit}
                    disabled={submitting}
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm Paid ({paymentChoice.toUpperCase()})</span>
                  </button>
                </div>

                <div className="divider-or">
                  <span>OR</span>
                </div>

                <div className="udhaar-section">
                  <span className="choice-label">{t("unpaidOption")}</span>
                  <p className="caption">
                    Customer se payment promise date puchiye
                  </p>
                  <button
                    type="button"
                    className="btn-outline full-width"
                    onClick={() => setStep("promise")}
                  >
                    <Clock size={16} />
                    <span>Record as Udhaar (Credit)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 7 (UNPAID): PAYMENT PROMISE & FOLLOW-UP SCHEDULE */}
        {step === "promise" && acceptedOrder && (
          <div className="order-step-promise">
            <div className="promise-header">
              <Clock size={24} className="text-emerald" />
              <div>
                <h4>{t("promiseDatePrompt")}</h4>
                <p className="caption">
                  Promise date schedule hone par Zuno reminder queue mein daal dega
                </p>
              </div>
            </div>

            <div className="customer-verify-box">
              <label>
                <span>Customer Name *</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  required
                />
              </label>
            </div>

            <div className="promise-presets">
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPresetDate(1)}
              >
                {t("tomorrow")}
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPresetDate(3)}
              >
                {t("in3Days")}
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => setPresetDate(7)}
              >
                {t("in1Week")}
              </button>
            </div>

            <label className="date-picker-label">
              <span>Specific Date</span>
              <input
                type="date"
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
              />
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep("billing")}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUdhaarSubmit}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Udhaar & Reminder"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 8 & 9: COMPLETED STATE WITH WHATSAPP RECEIPT SHARE */}
        {step === "completed" && completedOrder && (
          <div className="order-step-completed">
            <div className="success-badge">
              <CheckCircle2 size={40} className="text-emerald" />
              <h4>Order & Bill Complete!</h4>
              <p>
                {completedOrder.payment_status === "paid"
                  ? `Payment received via ${completedOrder.method?.toUpperCase() || "CASH"}. Cash & Sales updated.`
                  : `Udhaar recorded for ${completedOrder.customer_name}. Due reminder scheduled.`}
              </p>
            </div>

            <div className="receipt-preview-card">
              <div className="receipt-header">
                <strong>Zuno Bill Receipt</strong>
                <span>{completedOrder.bill_number}</span>
              </div>
              <div className="receipt-meta">
                <span>Customer: {customerName}</span>
                <span>Amount: {money(completedOrder.total_amount)}</span>
              </div>
              <div className="receipt-items-summary">
                {items.map((it, idx) => (
                  <div key={idx} className="receipt-line">
                    <span>
                      {it.name} x {it.quantity} {it.unit}
                    </span>
                    <span>{money(it.totalPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="receipt-status-tag">
                {completedOrder.payment_status === "paid" ? (
                  <span className="status-badge paid">PAID</span>
                ) : (
                  <span className="status-badge unpaid">
                    UDHAAR · Due: {promiseDate || "Open"}
                  </span>
                )}
              </div>
            </div>

            <div className="completed-actions">
              <button
                type="button"
                className="btn-whatsapp-copy"
                onClick={handleCopyBill}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? t("billCopied") : t("copyBill")}</span>
              </button>

              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
