import React, { useEffect, useRef } from "react";
import { BookOpen, Leaf, ChevronRight, ChevronLeft, X } from "lucide-react";
export function Brand({ light = false }) {
  return (
    <div className={"brand " + (light ? "light" : "")}>
      <span className="brand-mark">
        <BookOpen size={24} />
        <span />
      </span>
      <span>
        zuno<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Section({ title, action, onAction }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Empty({ t }) {
  return (
    <div className="empty">
      <BookOpen size={32} />
      <h3>{t("empty")}</h3>
      <p>{t("emptyHint")}</p>
    </div>
  );
}
export function PageTitle({ title, subtitle, amount, back }) {
  return (
    <div className="page-title">
      {back && (
        <button className="icon-button" aria-label="Back" onClick={back}>
          <ChevronLeft size={23} />
        </button>
      )}
      <div>
        <small>{subtitle}</small>
        <h1>{title}</h1>
        {amount && <strong>{amount}</strong>}
      </div>
    </div>
  );
}
export function CashChart({ points, label }) {
  const values = points.map((p) => p.balance),
    min = Math.min(...values, 0),
    max = Math.max(...values, 1),
    scale = (v) => 110 - ((v - min) / (max - min)) * 90;
  const coords = values
    .map((v, i) => `${8 + (i * 284) / 13},${scale(v)}`)
    .join(" ");
  return (
    <svg
      className="cash-chart"
      viewBox="0 0 300 130"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#17b880" stopOpacity=".25" />
          <stop offset="100%" stopColor="#17b880" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 8,120 L ${coords.replaceAll(" ", " L ")} L 292,120 Z`}
        fill="url(#chartFill)"
      />
      <line
        x1="8"
        x2="292"
        y1={scale(0)}
        y2={scale(0)}
        stroke="#b9cbc5"
        strokeDasharray="3 5"
      />
      <polyline
        points={coords}
        fill="none"
        stroke="#00856a"
        strokeWidth="3"
        strokeDasharray="5 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={8 + (i * 284) / 13}
          cy={scale(v)}
          r="3"
          fill={v < 0 ? "#b86618" : "#00856a"}
        />
      ))}
    </svg>
  );
}
export function Modal({ title, onClose, closeLabel, busy, children }) {
  const ref = useRef(),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current.focus();
    const key = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-handle" />
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            disabled={busy}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
