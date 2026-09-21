import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useMode } from "../../context/ModeContext";
import { t } from "../../config/standardPortal";
import { Notice } from "./StandardUI";

/**
 * Standard Mode password prompt for encrypted PDF export.
 * Same props and behaviour as ReportPasswordModal — presentation only.
 */
export default function StandardReportPasswordModal({
  isOpen,
  onClose,
  reportType = "brief",
  caseNumber = "",
  onConfirm,
  isGenerating = false,
  error = null,
}) {
  const { language } = useMode();
  const s = t(language);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);
  const inputRef = useRef(null);

  // Reset and focus the field each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return undefined;
    setPassword("");
    setLocalError(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Keyboard: Escape closes (unless the document is being generated).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !isGenerating) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isGenerating, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setLocalError(s.pwdModalRequiredError);
      return;
    }
    setLocalError(null);
    onConfirm(password);
  };

  const reportTitle =
    reportType === "takedown" ? s.takedownNoticeName : s.briefDossierName;

  return (
    <div className="std-overlay">
      <div className="std-modal std-modal--sm" role="dialog" aria-modal="true" aria-labelledby="std-pwd-title">
        <div className="std-modal__head">
          <div>
            <h2 id="std-pwd-title">{s.pwdModalTitle}</h2>
            <p>{s.pwdModalSub}</p>
          </div>
          <button type="button" className="std-modal__close" onClick={onClose} disabled={isGenerating}>
            <X aria-hidden="true" size={14} />
            {s.pwdModalClose}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="std-modal__body">
            <table className="std-kv" style={{ marginBottom: "0.9rem" }}>
              <tbody>
                <tr>
                  <th scope="row" style={{ width: "32%" }}>{s.pwdModalReportRow}</th>
                  <td style={{ width: "68%" }}>{reportTitle}</td>
                </tr>
                <tr>
                  <th scope="row">{s.pwdModalCaseRefRow}</th>
                  <td className="std-mono">{caseNumber}</td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginTop: 0, fontSize: "0.875rem" }}>
              {s.pwdModalNoticeBody}
            </p>

            {(localError || error) && (
              <Notice tone="danger" inline title={s.pwdModalErrorTitle}>
                {localError || error}
              </Notice>
            )}

            <div className="std-field">
              <label className="std-label" htmlFor="report-officer-password">
                {s.pwdModalPasswordLabel}
              </label>
              <input
                ref={inputRef}
                id="report-officer-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="std-input std-mono"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (localError) setLocalError(null);
                }}
                disabled={isGenerating}
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.8125rem" }}>
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                {s.pwdModalShowPassword}
              </label>
              <p className="std-hint">{s.pwdModalRecipientHint}</p>
            </div>
          </div>

          <div className="std-modal__foot">
            <button type="button" className="std-btn std-btn--secondary" onClick={onClose} disabled={isGenerating}>
              {s.pwdModalCancel}
            </button>
            <button type="submit" className="std-btn" disabled={isGenerating || !password.trim()}>
              {isGenerating ? s.pwdModalEncrypting : s.pwdModalSubmit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
