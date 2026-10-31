import React, { useState } from "react";
import {
  Boxes,
  Plus,
  Search,
  Package,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
} from "lucide-react";
import { money } from "../lib.js";

export function InventoryModal({
  products = [],
  language,
  t,
  onClose,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}) {
  const [query, setQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state for adding/editing
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("packet");
  const [priceRupees, setPriceRupees] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase().trim()),
  );

  const startAdd = () => {
    setName("");
    setUnit("packet");
    setPriceRupees("");
    setStock("50");
    setError("");
    setEditingId(null);
    setIsAdding(true);
  };

  const startEdit = (p) => {
    setName(p.name);
    setUnit(p.unit || "packet");
    setPriceRupees((p.price / 100).toString());
    setStock(p.stock.toString());
    setError("");
    setEditingId(p.id);
    setIsAdding(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("itemName") + " required");
      return;
    }
    const paise = Math.round(parseFloat(priceRupees || 0) * 100);
    if (isNaN(paise) || paise < 0) {
      setError("Valid price required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await onUpdateProduct(editingId, {
          name: name.trim(),
          unit: unit.trim().toLowerCase(),
          price: paise,
          stock: parseFloat(stock || 0),
        });
      } else {
        await onAddProduct({
          name: name.trim(),
          unit: unit.trim().toLowerCase(),
          price: paise,
          stock: parseFloat(stock || 0),
        });
      }
      setIsAdding(false);
      setEditingId(null);
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleStockDelta = async (p, delta) => {
    const newStock = Math.max(0, p.stock + delta);
    try {
      await onUpdateProduct(p.id, { stock: newStock });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="order-modal-backdrop" onClick={onClose}>
      <div
        className="order-modal-content inventory-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("inventory")}
      >
        <div className="order-modal-header">
          <div className="title-area">
            <span className="badge-pill emerald">
              <Boxes size={14} />
              {t("inventory")}
            </span>
            <h3>{t("inventory")}</h3>
            <p className="caption">{t("inventorySubtitle")}</p>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {isAdding ? (
          <form onSubmit={handleSave} className="product-form">
            <h4>{editingId ? "Edit Item" : t("addItem")}</h4>
            {error && (
              <div className="form-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
            <label>
              <span>{t("itemName")}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amul Milk 1L, Bread, Sugar"
                autoFocus
                required
              />
            </label>

            <div className="form-row">
              <label>
                <span>{t("unit")}</span>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="packet">packet / पैकेट</option>
                  <option value="kg">kg / किलो</option>
                  <option value="litre">litre / लीटर</option>
                  <option value="piece">piece / पीस</option>
                  <option value="bottle">bottle / बोतल</option>
                </select>
              </label>

              <label>
                <span>{t("price")}</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>

              <label>
                <span>{t("initialStock")}</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Item" : t("addItem")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="inventory-toolbar">
              <div className="search-bar">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search catalog items..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button onClick={() => setQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <button className="btn-primary-compact" onClick={startAdd}>
                <Plus size={16} />
                <span>{t("addItem")}</span>
              </button>
            </div>

            <div className="products-list">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <Package size={36} />
                  <p>No products found</p>
                  <button className="btn-secondary" onClick={startAdd}>
                    {t("addItem")}
                  </button>
                </div>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stock <= 10 && p.stock > 0;
                  const isOut = p.stock === 0;
                  return (
                    <div key={p.id} className="product-row">
                      <div className="product-info">
                        <strong>{p.name}</strong>
                        <div className="product-meta">
                          <span className="price-tag">{money(p.price)}</span>
                          <span className="unit-tag">/ {p.unit}</span>
                          <span
                            className={`stock-badge ${
                              isOut ? "out" : isLow ? "low" : "ok"
                            }`}
                          >
                            {isOut
                              ? t("outOfStock")
                              : isLow
                                ? `${p.stock} (${t("lowStock")})`
                                : `${p.stock} in stock`}
                          </span>
                        </div>
                      </div>

                      <div className="product-actions">
                        <div className="stock-counter">
                          <button
                            type="button"
                            onClick={() => handleStockDelta(p, -1)}
                            disabled={p.stock <= 0}
                            title="Decrement stock"
                          >
                            -
                          </button>
                          <span>{p.stock}</span>
                          <button
                            type="button"
                            onClick={() => handleStockDelta(p, 1)}
                            title="Increment stock"
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="btn-icon"
                          onClick={() => startEdit(p)}
                          title="Edit Item"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => onDeleteProduct(p.id)}
                          title="Delete Item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
