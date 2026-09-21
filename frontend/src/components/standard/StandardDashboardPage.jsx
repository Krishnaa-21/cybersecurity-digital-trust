import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient, { getOfficer, setOfficer } from "../../api/client";
import { useMode } from "../../context/ModeContext";
import { t } from "../../config/standardPortal";
import {
  Breadcrumb,
  PageHeader,
  Panel,
  Notice,
  StatCards,
  RiskBadge,
  StatusBadge,
  TableMessage,
  riskScoreOf,
  scamLabel,
  evidenceCategoryLabel,
  formatDate,
} from "./StandardUI";

/* ── 1. Headline statistics ───────────────────────────────────────────── */
function StatsCards({ stats, s }) {
  const high = stats.high_risk_cases ?? 0;
  const active = stats.active_cases ?? 0;
  const awaiting = stats.awaiting_correlation ?? 0;
  const closed = stats.closed_this_month ?? 0;

  return (
    <StatCards
      label={s.caseSummaryStats}
      items={[
        { label: s.highRiskCases, value: high, alert: high > 0, alertText: s.requiresAttention, note: s.highRiskCasesNote },
        { label: s.activeCaseLoad, value: active, note: s.activeCaseLoadNote },
        { label: s.awaitingCorrelation, value: awaiting, alert: awaiting > 0, alertText: s.requiresAttention, note: s.awaitingCorrelationNote },
        { label: s.closedThisMonth, value: closed, note: s.closedThisMonthNote },
      ]}
    />
  );
}

/* ── 2. Priority case register ────────────────────────────────────────── */
function CaseRegister({ cases, isLoading, selectedDistrict, onClearDistrict, s, language }) {
  const [showAll, setShowAll] = useState(false);

  const filtered = selectedDistrict
    ? cases.filter((c) => (c.district || "").toLowerCase() === selectedDistrict.toLowerCase())
    : cases;
  const ranked = [...filtered].sort((a, b) => riskScoreOf(b) - riskScoreOf(a));
  const displayed = showAll ? ranked : ranked.slice(0, 5);

  const emptyText = !cases.length
    ? s.noCasesRegisteredYet
    : s.noCasesForDistrict;

  return (
    <Panel
      id="case-register"
      title={selectedDistrict ? `${s.priorityCaseRegisterDistrict} ${selectedDistrict}` : s.priorityCaseRegister}
      meta={
        isLoading
          ? s.loadingGeneral
          : s.showingCasesCount.replace("{count}", displayed.length).replace("{total}", filtered.length)
      }
      flush
    >
      {(selectedDistrict || ranked.length > 5) && (
        <div className="std-toolbar">
          {selectedDistrict && (
            <>
              <span>
                {s.filterApplied} <strong>{selectedDistrict}</strong>
              </span>
              <button type="button" className="std-btn std-btn--secondary std-btn--sm" onClick={onClearDistrict}>
                {s.clearFilter}
              </button>
            </>
          )}
          <span className="std-toolbar__spacer" />
          {ranked.length > 5 && (
            <button type="button" className="std-btn std-btn--secondary std-btn--sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? s.showTop5Only : s.viewAllCases.replace("{count}", ranked.length)}
            </button>
          )}
        </div>
      )}

      <div className="std-table-wrap">
        <table className="std-table">
          <caption className="std-visually-hidden">{s.priorityCaseRegister}</caption>
          <thead>
            <tr>
              <th scope="col">{s.thSNo}</th>
              <th scope="col">{s.thCaseNo}</th>
              <th scope="col">{s.thComplainant}</th>
              <th scope="col">{s.thCategory}</th>
              <th scope="col">{s.thDistrict}</th>
              <th scope="col">{s.thRiskLevel}</th>
              <th scope="col" className="num">{s.thRiskScore}</th>
              <th scope="col" className="wide">{s.thGrounds}</th>
              <th scope="col"><span className="std-visually-hidden">{s.thAction}</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableMessage colSpan={9}>{s.loadingRegister}</TableMessage>
            ) : displayed.length === 0 ? (
              <TableMessage colSpan={9}>{emptyText}</TableMessage>
            ) : (
              displayed.map((c, idx) => (
                <tr key={c.id}>
                  <td>{idx + 1}</td>
                  <td className="nowrap">
                    <Link className="std-link std-id" to={`/cases/${c.id}/graph`}>{c.case_number}</Link>
                  </td>
                  <td>{c.victim_name}</td>
                  <td>{scamLabel(c.scam_type, language)}</td>
                  <td>{c.district || s.pendingValue}</td>
                  <td><RiskBadge level={c.risk_level} language={language} /></td>
                  <td className="num">
                    {c.risk_score !== null && c.risk_score !== undefined ? `${riskScoreOf(c)} / 100` : "—"}
                  </td>
                  <td>{c.why_flagged || "—"}</td>
                  <td className="nowrap">
                    <Link className="std-btn std-btn--secondary std-btn--sm" to={`/cases/${c.id}/graph`}>
                      {s.viewCase}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ── 3. Evidence processing register ──────────────────────────────────── */
function EvidenceRegister({ files, isLoading, s, language }) {
  return (
    <Panel
      id="evidence-register"
      title={s.evidenceRegisterTitle}
      meta={isLoading ? s.loadingGeneral : s.evidenceFilesQueue.replace("{count}", files.length)}
      flush
      footer={s.evidenceFooterNotice}
    >
      <div className="std-table-wrap std-table-wrap--scroll">
        <table className="std-table">
          <caption className="std-visually-hidden">{s.evidenceRegisterTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{s.thSNo}</th>
              <th scope="col">{s.thFileName}</th>
              <th scope="col">{s.thCaseNo}</th>
              <th scope="col">{s.thCategory}</th>
              <th scope="col" className="num">{s.thRows}</th>
              <th scope="col">{s.thSha256}</th>
              <th scope="col">{s.thStatus}</th>
              <th scope="col">{s.thUploaded}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableMessage colSpan={8}>{s.loadingEvidenceRegister}</TableMessage>
            ) : files.length === 0 ? (
              <TableMessage colSpan={8}>{s.noEvidenceAwaiting}</TableMessage>
            ) : (
              files.map((f, idx) => {
                const statusKey = String(f.upload_status || f.status || "pending").toLowerCase();
                const statusLabel = s.evidenceStatuses[statusKey] || s.evidenceStatuses.pending;
                const statusTone = statusKey === "error" || statusKey === "failed" ? "high" : statusKey === "processing" ? "info" : statusKey === "completed" || statusKey === "indexed" ? "low" : "medium";
                const category = f.evidence_category || f.file_type;
                return (
                  <tr key={f.id || idx}>
                    <td>{idx + 1}</td>
                    <td className="std-mono" style={{ wordBreak: "break-all" }}>
                      {f.original_filename || f.filename || f.name || `evidence-${idx + 1}`}
                    </td>
                    <td className="nowrap std-id">{f.case_number || "—"}</td>
                    <td>{evidenceCategoryLabel(category, language)}</td>
                    <td className="num">{f.row_count ?? "—"}</td>
                    <td className="std-hash">{f.sha256_hash || f.sha256 || f.hash || s.hashPending}</td>
                    <td><StatusBadge tone={statusTone}>{statusLabel}</StatusBadge></td>
                    <td className="nowrap">{formatDate(f.uploaded_at, false, language)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ── 4. District-wise case distribution ───────────────────────────────── */
function DistrictDistribution({ heatmap, isLoading, selectedDistrict, onSelectDistrict, s, language }) {
  const [filterLevel, setFilterLevel] = useState("all");

  const rows = (heatmap || [])
    .filter((item) => filterLevel === "all" || (item.level || "").toLowerCase() === filterLevel)
    .sort((a, b) => b.case_count - a.case_count);
  const top = [...(heatmap || [])].sort((a, b) => b.case_count - a.case_count)[0];

  return (
    <Panel
      id="district-distribution"
      title={s.districtDistTitle}
      meta={s.districtDistMeta}
      flush
      footer={s.districtDistFooter}
    >
      <div className="std-toolbar">
        <span>
          {isLoading ? (
            s.loadingDistrictTelemetry
          ) : top ? (
            language === "hi" ? (
              <>
                {heatmap.length} क्षेत्राधिकारों में से प्रमुख सांद्रता <strong>{top.district}</strong> ({top.case_count} प्रकरण) में है।
              </>
            ) : (
              <>
                Primary concentration in <strong>{top.district}</strong> ({top.case_count} case{top.case_count === 1 ? "" : "s"}) across{" "}
                {heatmap.length} jurisdiction{heatmap.length === 1 ? "" : "s"}.
              </>
            )
          ) : (
            s.districtDefaultTelemetry
          )}
        </span>
        <span className="std-toolbar__spacer" />
        <label htmlFor="std-density-filter">{s.densityLevelLabel}</label>
        <select id="std-density-filter" className="std-select" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
          <option value="all">{s.allLevels}</option>
          <option value="high">{s.levelHigh}</option>
          <option value="medium">{s.levelMedium}</option>
          <option value="low">{s.levelLow}</option>
        </select>
      </div>

      <div className="std-table-wrap">
        <table className="std-table">
          <caption className="std-visually-hidden">{s.districtDistTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{s.thSNo}</th>
              <th scope="col">{s.thDistrict}</th>
              <th scope="col" className="num">{s.thCases}</th>
              <th scope="col">{s.thDensityLevel}</th>
              <th scope="col" style={{ width: "22%" }}>{s.thRelativeShare}</th>
              <th scope="col">{s.thFilter}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableMessage colSpan={6}>{s.loadingDistrictDistribution}</TableMessage>
            ) : rows.length === 0 ? (
              <TableMessage colSpan={6}>{s.noDistrictForDensity}</TableMessage>
            ) : (
              rows.map((item, idx) => {
                const isSelected = selectedDistrict?.toLowerCase() === item.district.toLowerCase();
                const percent = Math.min(100, Math.round((item.case_count / Math.max(1, top?.case_count || 1)) * 100));
                return (
                  <tr key={item.district} className={isSelected ? "is-selected" : undefined}>
                    <td>{idx + 1}</td>
                    <td><strong>{item.district}</strong></td>
                    <td className="num">{item.case_count}</td>
                    <td><RiskBadge level={item.level || "low"} language={language} /></td>
                    <td>
                      <span className="std-bar" role="img" aria-label={`${percent}%`}>
                        <span style={{ width: `${percent}%` }} />
                      </span>
                    </td>
                    <td className="nowrap">
                      <button
                        type="button"
                        className="std-linkbtn"
                        aria-pressed={isSelected}
                        onClick={() => onSelectDistrict(isSelected ? null : item.district)}
                      >
                        {isSelected ? s.clearFilter : s.filterCasesBtn}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function StandardDashboardPage() {
  const { language } = useMode();
  const s = t(language);

  const [officer, setOfficerState] = useState(() => getOfficer() || {});
  const [stats, setStats] = useState({ high_risk_cases: 0, active_cases: 0, awaiting_correlation: 0, closed_this_month: 0 });
  const [cases, setCases] = useState([]);
  const [unprocessedEvidence, setUnprocessedEvidence] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Same endpoints and handling as the Analysis Mode dashboard.
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [meRes, statsRes, casesRes, evidenceRes, heatmapRes] = await Promise.allSettled([
        apiClient.get("auth/me"),
        apiClient.get("cases/summary-stats"),
        apiClient.get("cases"),
        apiClient.get("evidence/unprocessed"),
        apiClient.get("geo/heatmap"),
      ]);

      if (meRes.status === "fulfilled" && meRes.value) {
        setOfficerState(meRes.value);
        setOfficer(meRes.value);
      }
      if (statsRes.status === "fulfilled" && statsRes.value) setStats(statsRes.value);
      if (casesRes.status === "fulfilled" && Array.isArray(casesRes.value)) setCases(casesRes.value);
      if (evidenceRes.status === "fulfilled" && Array.isArray(evidenceRes.value)) setUnprocessedEvidence(evidenceRes.value);
      if (heatmapRes.status === "fulfilled" && Array.isArray(heatmapRes.value)) setHeatmap(heatmapRes.value);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const handleCaseCreated = () => fetchDashboardData();
    window.addEventListener("tracex_case_created", handleCaseCreated);
    return () => window.removeEventListener("tracex_case_created", handleCaseCreated);
  }, []);

  const todayStr = new Date().toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const urgentCase = cases.find((c) => (c.risk_level || "").toLowerCase() === "critical" && c.freeze_recommended);

  return (
    <>
      <Breadcrumb items={[{ label: s.home, to: "/" }, { label: s.dashboard }]} label={s.mainNav} />

      <PageHeader
        title={s.dashTitle}
        subtitle={
          <>
            {officer.station_name ? <>{officer.station_name} · </> : null}
            {s.loggedInAs} <strong>{officer.name || s.investigatingOfficer}</strong>
            {officer.badge_id ? (
              <>
                {" "}({s.badgeIdLabel}: <span className="std-mono">{officer.badge_id}</span>)
              </>
            ) : null}{" "}
            · {todayStr}
          </>
        }
        actions={
          <>
            <button type="button" className="std-btn std-btn--secondary" onClick={fetchDashboardData} disabled={isLoading}>
              {isLoading ? s.refreshingData : s.refreshData}
            </button>
          </>
        }
      />

      {urgentCase && (
        <Notice
          tone="danger"
          title={`${s.urgentActionRequired} — ${s.thCaseNo} ${urgentCase.case_number} (${urgentCase.victim_name})`}
          action={
            <Link className="std-btn std-btn--sm" to={`/cases/${urgentCase.id}/graph`}>
              {s.takeAction}
            </Link>
          }
        >
          {s.freezeActionRecommended}{urgentCase.why_flagged ? ` ${urgentCase.why_flagged}` : ""}
        </Notice>
      )}

      <StatsCards stats={stats} s={s} />

      <CaseRegister
        cases={cases}
        isLoading={isLoading}
        selectedDistrict={selectedDistrict}
        onClearDistrict={() => setSelectedDistrict(null)}
        s={s}
        language={language}
      />

      <EvidenceRegister files={unprocessedEvidence} isLoading={isLoading} s={s} language={language} />

      <DistrictDistribution
        heatmap={heatmap}
        isLoading={isLoading}
        selectedDistrict={selectedDistrict}
        onSelectDistrict={setSelectedDistrict}
        s={s}
        language={language}
      />
    </>
  );
}
