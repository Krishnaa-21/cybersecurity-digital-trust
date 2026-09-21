import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useMode } from "../../context/ModeContext";
import { t } from "../../config/standardPortal";
import { Notice, StatusBadge, evidenceCategoryLabel } from "./StandardUI";

/**
 * Standard Mode "Register New Case" dialog.
 * Same API calls, sequence and navigation as the Analysis Mode modal
 * (create case → upload evidence → correlate → open graph) — presentation only.
 */
export default function StandardNewInvestigationModal({ isOpen, onClose, onCaseCreated }) {
  const navigate = useNavigate();
  const { language } = useMode();
  const s = t(language);

  const [victimName, setVictimName] = useState("");
  const [regDate, setRegDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [scamType, setScamType] = useState("digital_scam");

  const [caseData, setCaseData] = useState(null);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [isCorrelating, setIsCorrelating] = useState(false);
  const [progressStep, setProgressStep] = useState(0); // 1: extract, 2: correlate, 3: render
  const [progressPercent, setProgressPercent] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [error, setError] = useState(null);

  const fileRefs = { telecom: useRef(null), bank_upi: useRef(null), other: useRef(null) };
  const nameRef = useRef(null);

  const scamOptions = [
    { id: "digital_scam", ...s.regModalScamOptions.digital_scam },
    { id: "phishing_vishing", ...s.regModalScamOptions.phishing_vishing },
    { id: "malicious_apk", ...s.regModalScamOptions.malicious_apk },
  ];

  const uploadZones = [
    { category: "telecom", ...s.regModalUploadZones.telecom, accept: ".csv,.xlsx,.xls,.txt,.log" },
    { category: "bank_upi", ...s.regModalUploadZones.bank_upi, accept: ".csv,.xlsx,.xls,.txt,.log" },
    { category: "other", ...s.regModalUploadZones.other, accept: ".csv,.xlsx,.xls,.txt,.log,.json" },
  ];

  // Focus the first field when the dialog opens.
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Keyboard: Escape closes (unless the correlation pipeline is running).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !isCorrelating) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isCorrelating, onClose]);

  if (!isOpen) return null;

  const ensureCaseCreated = async () => {
    if (caseData) return caseData;
    if (!victimName.trim()) {
      setError(s.regModalNameRequired);
      return null;
    }
    setIsCreatingCase(true);
    setError(null);
    try {
      const created = await apiClient.post("cases", { victim_name: victimName.trim(), scam_type: scamType });
      setCaseData(created);
      if (onCaseCreated) onCaseCreated(created);
      return created;
    } catch (err) {
      setError(err.message || s.regModalInitFailed);
      return null;
    } finally {
      setIsCreatingCase(false);
    }
  };

  const handleFileUpload = async (e, category) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const activeCase = await ensureCaseCreated();
    if (!activeCase) {
      e.target.value = "";
      return;
    }

    setUploadingCategory(category);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("evidence_category", category);

    try {
      const res = await apiClient.post(`cases/${activeCase.id}/evidence`, formData);
      setUploadedFiles((prev) => [
        ...prev,
        {
          id: res.id,
          filename: res.original_filename,
          category: res.evidence_category,
          rowCount: res.row_count,
          sha256: res.sha256_hash,
          status: res.upload_status || "queued",
        },
      ]);
    } catch (err) {
      setError(err.message || s.regModalUploadFailed.replace("{filename}", file.name));
    } finally {
      setUploadingCategory(null);
      e.target.value = "";
    }
  };

  const handleCorrelateAndOpen = async () => {
    if (!caseData) {
      setError(s.regModalUploadFirst);
      return;
    }

    setIsCorrelating(true);
    setProgressStep(1);
    setProgressPercent(20);
    setError(null);

    try {
      await new Promise((r) => setTimeout(r, 180));
      setProgressStep(2);
      setProgressPercent(60);

      const res = await apiClient.post(`cases/${caseData.id}/correlate`);

      setProgressStep(3);
      setProgressPercent(100);
      await new Promise((r) => setTimeout(r, 220));

      onClose();
      navigate(`/cases/${caseData.id}/graph`, {
        state: { preloadedGraph: res?.graph, recordsByCategory: res?.records_by_category },
      });
    } catch (err) {
      setError(err.message || s.regModalCorrelateFailed);
      setIsCorrelating(false);
      setProgressStep(0);
      setProgressPercent(0);
    }
  };

  const truncateHash = (hash) => {
    if (!hash || hash.length < 16) return hash;
    return `${hash.substring(0, 8)}…${hash.substring(hash.length - 6)}`;
  };

  const stepState = (n) => (progressStep > n ? "done" : progressStep === n ? "active" : "pending");

  return (
    <div className="std-overlay">
      <div className="std-modal" role="dialog" aria-modal="true" aria-labelledby="std-newcase-title">
        <div className="std-modal__head">
          <div>
            <h2 id="std-newcase-title">{s.regModalTitle}</h2>
            <p>{s.regModalSub}</p>
          </div>
          <button type="button" className="std-modal__close" onClick={onClose} disabled={isCorrelating}>
            <X aria-hidden="true" size={14} />
            {s.regModalClose}
          </button>
        </div>

        <div className="std-modal__body">
          {error && (
            <Notice tone="danger" inline title={s.regModalUnableToProceed}>
              {error}
            </Notice>
          )}

          {caseData && (
            <Notice tone="success" inline title={s.regModalCaseCreated}>
              {s.thCaseNo} <strong className="std-mono">{caseData.case_number}</strong> — {caseData.victim_name}. {s.regModalReadyForIngestion}
            </Notice>
          )}

          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="std-field">
              <label className="std-label" htmlFor="std-victim-name">
                {s.regModalVictimNameLabel} <span aria-hidden="true">*</span>
              </label>
              <input
                id="std-victim-name"
                ref={nameRef}
                type="text"
                required
                aria-required="true"
                className="std-input"
                disabled={!!caseData}
                value={victimName}
                onChange={(e) => setVictimName(e.target.value)}
                placeholder={s.regModalVictimPlaceholder}
              />
            </div>
            <div className="std-field">
              <label className="std-label" htmlFor="std-reg-date">{s.regModalRegDateLabel}</label>
              <input
                id="std-reg-date"
                type="date"
                className="std-input std-mono"
                disabled={!!caseData}
                value={regDate}
                onChange={(e) => setRegDate(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="std-fieldset" disabled={!!caseData}>
            <legend>{s.regModalScamTypeLegend}</legend>
            {scamOptions.map((opt) => (
              <label key={opt.id} className="std-radio">
                <input
                  type="radio"
                  name="std-scam-type"
                  value={opt.id}
                  checked={scamType === opt.id}
                  onChange={() => setScamType(opt.id)}
                />
                <div>
                  <strong>{opt.title}</strong>
                  <span>{opt.desc}</span>
                </div>
              </label>
            ))}
          </fieldset>

          <fieldset className="std-fieldset">
            <legend>{s.regModalIngestLegend}</legend>
            <p className="std-hint" style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              {s.regModalIngestHint}
            </p>
            <div className="std-upload">
              {uploadZones.map((zone) => {
                const busy = uploadingCategory === zone.category;
                return (
                  <div key={zone.category} className="std-upload__item">
                    <strong>{zone.label}</strong>
                    <span>{zone.sub}</span>
                    <input
                      type="file"
                      ref={fileRefs[zone.category]}
                      className="std-visually-hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                      accept={zone.accept}
                      onChange={(e) => handleFileUpload(e, zone.category)}
                    />
                    <button
                      type="button"
                      className="std-btn std-btn--secondary std-btn--sm"
                      disabled={busy || isCreatingCase || isCorrelating}
                      onClick={() => fileRefs[zone.category].current?.click()}
                    >
                      {busy ? s.regModalIngesting : s.regModalChooseFile}
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {uploadedFiles.length > 0 && (
            <div className="std-field">
              <p className="std-label">{s.regModalIngestedArtifactsCount.replace("{count}", uploadedFiles.length)}</p>
              <div className="std-table-wrap">
                <table className="std-table">
                  <caption className="std-visually-hidden">{s.regModalIngestLegend}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{s.thFileName}</th>
                      <th scope="col">{s.thCategory}</th>
                      <th scope="col" className="num">{s.thRows}</th>
                      <th scope="col">{s.thSha256}</th>
                      <th scope="col">{s.thStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles.map((f, i) => (
                      <tr key={f.id ?? i}>
                        <td className="std-mono" style={{ wordBreak: "break-all" }}>{f.filename}</td>
                        <td>{evidenceCategoryLabel(f.category, language)}</td>
                        <td className="num">{f.rowCount ?? "—"}</td>
                        <td className="std-mono" title={f.sha256}>{truncateHash(f.sha256)}</td>
                        <td><StatusBadge tone="low">{s.evidenceStatuses.indexed}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isCorrelating && (
            <div role="status" aria-live="polite">
              <p className="std-label">
                {s.regModalPipelineProgress.replace("{percent}", progressPercent)}
              </p>
              <div className="std-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <ol className="std-steps">
                <li data-state={stepState(1)}>{s.regModalStep1}</li>
                <li data-state={stepState(2)}>{s.regModalStep2}</li>
                <li data-state={stepState(3)}>{s.regModalStep3}</li>
              </ol>
            </div>
          )}
        </div>

        <div className="std-modal__foot">
          <button type="button" className="std-btn std-btn--secondary" onClick={onClose} disabled={isCorrelating}>
            {s.regModalCancel}
          </button>
          <button type="button" className="std-btn" disabled={!caseData || isCorrelating} onClick={handleCorrelateAndOpen}>
            {isCorrelating ? s.regModalCorrelating : s.regModalSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
