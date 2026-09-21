import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../../api/client";
import { useMode } from "../../context/ModeContext";
import { t } from "../../config/standardPortal";
import { Breadcrumb, PageHeader, Panel, Notice, StatusBadge } from "./StandardUI";

export default function StandardReportsPage() {
  const { language } = useMode();
  const s = t(language);
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [allCases, setAllCases] = useState([]);
  const [caseData, setCaseData] = useState(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [isGeneratingTakedown, setIsGeneratingTakedown] = useState(false);
  const [briefHash, setBriefHash] = useState(null);
  const [takedownHash, setTakedownHash] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    (async () => {
      const [cRes, casesRes] = await Promise.allSettled([apiClient.get(`cases/${caseId}`), apiClient.get("cases")]);
      if (cRes.status === "fulfilled" && cRes.value) setCaseData(cRes.value);
      if (casesRes.status === "fulfilled" && Array.isArray(casesRes.value)) setAllCases(casesRes.value);
    })();
  }, [caseId]);

  const cleanCaseNumber = caseData?.case_number?.replace("#", "").trim() || caseId;
  const caseNo = caseData?.case_number || `#${caseId}`;

  const saveBlob = async (res, filename) => {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Direct download: encrypted automatically, asks for password only when opening the PDF
  const handleDownload = async (type) => {
    setDownloadError(null);
    if (type === "brief") {
      setIsGeneratingBrief(true);
      try {
        const res = await apiClient.post(`cases/${caseId}/reports/investigative-brief`);
        const hash = res.headers.get("X-Document-SHA256") || res.headers.get("x-document-sha256");
        if (hash) setBriefHash(hash);
        await saveBlob(res, `investigative_brief_${cleanCaseNumber}.pdf`);
      } catch (err) {
        console.error("Failed to generate brief:", err);
        setDownloadError(s.briefGenFailed);
      } finally {
        setIsGeneratingBrief(false);
      }
    } else {
      setIsGeneratingTakedown(true);
      try {
        const res = await apiClient.post(`cases/${caseId}/reports/takedown-request`);
        const hash = res.headers.get("X-Document-SHA256") || res.headers.get("x-document-sha256");
        if (hash) setTakedownHash(hash);
        await saveBlob(res, `takedown_request_${cleanCaseNumber}.pdf`);
      } catch (err) {
        console.error("Failed to generate takedown request:", err);
        setDownloadError(s.takedownGenFailed);
      } finally {
        setIsGeneratingTakedown(false);
      }
    }
  };

  const reports = [
    {
      key: "brief",
      name: s.briefDossierName,
      basis: s.briefDossierBasis,
      desc: s.briefDossierDesc,
      contents: s.briefContents,
      generating: isGeneratingBrief,
      hash: briefHash,
    },
    {
      key: "takedown",
      name: s.takedownNoticeName,
      basis: s.takedownNoticeBasis,
      desc: s.takedownNoticeDesc,
      contents: s.takedownContents,
      generating: isGeneratingTakedown,
      hash: takedownHash,
    },
  ];

  return (
    <>
      <Breadcrumb
        items={[
          { label: s.home, to: "/" },
          { label: `${s.thCaseNo} ${caseNo}`, to: `/cases/${caseId}/graph` },
          { label: s.reports },
        ]}
        label={s.mainNav}
      />

      <PageHeader
        title={s.reportsPageTitle.replace("{caseNo}", caseNo)}
        subtitle={s.reportsPageSub}
        actions={
          <>
            {allCases.length > 1 && (
              <>
                <label htmlFor="std-report-case-switch" className="std-visually-hidden">{s.switchCaseLabel}</label>
                <select id="std-report-case-switch" className="std-select" value={caseId} onChange={(e) => navigate(`/cases/${e.target.value}/reports`)}>
                  {allCases.map((c) => (
                    <option key={c.id} value={c.id}>{c.case_number} ({c.victim_name})</option>
                  ))}
                </select>
              </>
            )}
            <Link className="std-btn std-btn--secondary" to={`/cases/${caseId}/graph`}>{s.correlation}</Link>
            <Link className="std-btn std-btn--secondary" to="/">{s.backToDashboard}</Link>
          </>
        }
      />

      <Notice tone="info" title={s.pwdProtectedExportsTitle}>
        {s.pwdProtectedExportsBody}
      </Notice>

      {downloadError && <Notice tone="danger" title={s.downloadFailedTitle}>{downloadError}</Notice>}

      <Panel id="available-reports" title={s.availableReportsTitle} flush>
        <div className="std-table-wrap">
          <table className="std-table">
            <caption className="std-visually-hidden">{s.availableReportsTitle}</caption>
            <thead>
              <tr>
                <th scope="col">{s.thSNo}</th>
                <th scope="col">{s.thReport}</th>
                <th scope="col">{s.thLegalBasis}</th>
                <th scope="col" className="wide">{s.thDescription}</th>
                <th scope="col">{s.thAction}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={r.key}>
                  <td>{i + 1}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.basis}</td>
                  <td>{r.desc}</td>
                  <td style={{ minWidth: "14rem" }}>
                    <button type="button" className="std-btn std-btn--sm" disabled={r.generating} onClick={() => handleDownload(r.key)}>
                      {r.generating ? s.generatingEncryptedPdf : s.downloadProtectedPdf}
                    </button>
                    {r.hash && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <StatusBadge tone="low">{s.encryptedAndVerified}</StatusBadge>
                        <div className="std-hash" style={{ minWidth: 0, marginTop: "0.25rem" }}>SHA-256: {r.hash}</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="std-cols std-cols--2">
        {reports.map((r) => (
          <Panel key={r.key} id={`contents-${r.key}`} title={`${s.contentsPrefix} ${r.name}`}>
            <ul className="std-list">
              {r.contents.map((c, idx) => <li key={idx}>{c}</li>)}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
