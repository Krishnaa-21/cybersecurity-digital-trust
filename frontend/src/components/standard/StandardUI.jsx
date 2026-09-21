import React from "react";
import { Link } from "react-router-dom";
import {
  getScamLabel,
  getEntityTypeLabel,
  getCaseStatusLabel,
  getEvidenceCategoryLabel,
  getRiskLabel,
  STRINGS,
} from "../../config/standardPortal";
import { useMode } from "../../context/ModeContext";

/* ==========================================================================
   Shared presentational primitives for Standard Mode (government portal skin).
   Pure UI — no data fetching, no business logic.
   ========================================================================== */

export const SCAM_TYPE_LABELS = STRINGS.en.scams;
export const CASE_STATUS_LABELS = STRINGS.en.statuses;
export const ENTITY_TYPE_LABELS = STRINGS.en.entities;
export const EVIDENCE_CATEGORY_LABELS = STRINGS.en.evidenceCategories;

export const scamLabel = (v, lang = "en") => getScamLabel(v, lang);
export const entityTypeLabel = (v, lang = "en") => getEntityTypeLabel(v, lang);
export const caseStatusLabel = (v, lang = "en") => getCaseStatusLabel(v, lang);
export const evidenceCategoryLabel = (v, lang = "en") => getEvidenceCategoryLabel(v, lang);

/** Numeric score used for ranking — mirrors the Analysis Mode queue ordering. */
export function riskScoreOf(c) {
  if (c.risk_score !== null && c.risk_score !== undefined) return Math.round(c.risk_score);
  const level = (c.risk_level || "").toLowerCase();
  if (level === "critical") return 95;
  if (level === "high") return 80;
  if (level === "medium" || level === "med") return 50;
  if (level === "low") return 20;
  return 0;
}

export function formatDate(value, withTime = false, language = "en") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

/* ── Breadcrumb navigation ─────────────────────────────────────────────── */
export function Breadcrumb({ items = [], label = "Breadcrumb" }) {
  return (
    <nav className="std-breadcrumb" aria-label={label}>
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {last || !item.to ? (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── Page heading with optional actions ────────────────────────────────── */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="std-pagehead">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="std-pagehead__actions">{actions}</div> : null}
    </div>
  );
}

/* ── Titled panel ──────────────────────────────────────────────────────── */
export function Panel({ id, title, meta, children, flush = false, footer }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className="std-panel" id={id} aria-labelledby={headingId}>
      <div className="std-panel__head">
        <h2 className="std-panel__title" id={headingId}>{title}</h2>
        {meta ? <div className="std-panel__meta">{meta}</div> : null}
      </div>
      {flush ? children : <div className="std-panel__body">{children}</div>}
      {footer ? <div className="std-panel__foot">{footer}</div> : null}
    </section>
  );
}

/* ── Headline statistic cards ──────────────────────────────────────────── */
export function StatCards({ items, label }) {
  return (
    <dl className="std-statgrid" aria-label={label}>
      {items.map((it) => (
        <div key={it.label} className={`std-stat${it.alert ? " std-stat--alert" : ""}`}>
          <dt>{it.label}</dt>
          <dd className="std-stat__value">{it.value}</dd>
          {it.note || it.alert ? (
            <dd className="std-stat__note">
              {it.alert && it.alertText ? <strong>▲ {it.alertText} — </strong> : null}
              {it.note}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/* ── Formal notice (alert / information) ───────────────────────────────── */
export function Notice({ tone = "info", title, children, action, inline = false, role }) {
  const resolvedRole = role || (tone === "danger" ? "alert" : "status");
  return (
    <div className={`std-notice std-notice--${tone}${inline ? " std-notice--inline" : ""}`} role={resolvedRole}>
      <div>
        {title ? <p className="std-notice__title">{title}</p> : null}
        {children ? <p>{children}</p> : null}
      </div>
      {action || null}
    </div>
  );
}

/* ── Risk level badge (text + symbol + colour; never colour alone) ─────── */
const RISK_CLASS = { critical: "critical", high: "high", medium: "medium", med: "medium", low: "low" };

export function RiskBadge({ level, language: propLang }) {
  let lang = propLang;
  try {
    if (!lang) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const modeCtx = useMode();
      lang = modeCtx?.language || "en";
    }
  } catch {
    lang = "en";
  }

  const key = (level || "").toLowerCase();
  const label = getRiskLabel(key, lang);
  if (!RISK_CLASS[key]) return <span className="std-badge std-badge--neutral">{label}</span>;
  return <span className={`std-badge std-badge--${RISK_CLASS[key]}`}>{label}</span>;
}

/* ── Generic status badge ──────────────────────────────────────────────── */
export function StatusBadge({ tone = "neutral", children }) {
  return <span className={`std-badge std-badge--${tone}`}>{children}</span>;
}

/* ── Empty / loading row for tables ────────────────────────────────────── */
export function TableMessage({ colSpan, children }) {
  return (
    <tr>
      <td className="empty" colSpan={colSpan}>{children}</td>
    </tr>
  );
}
