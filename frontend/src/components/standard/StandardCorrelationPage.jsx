import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import apiClient from "../../api/client";
import NetworkGraph from "../NetworkGraph";
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
  scamLabel,
  entityTypeLabel,
  caseStatusLabel,
  formatDate,
  riskScoreOf,
} from "./StandardUI";

const RISK_RANK = { high: 0, critical: 0, medium: 1, med: 1, low: 2 };

function CaseDetailsPanel({ caseData, caseId, s, language }) {
  const v = (x) => (x === null || x === undefined || x === "" ? "—" : x);
  return (
    <Panel id="case-details" title={s.caseDetailsTitle} flush>
      <table className="std-kv">
        <caption className="std-visually-hidden">{s.caseDetailsTitle}</caption>
        <tbody>
          <tr>
            <th scope="row">{s.cdCaseNumber}</th>
            <td className="std-id">{v(caseData?.case_number || `#${caseId}`)}</td>
            <th scope="row">{s.cdStatus}</th>
            <td>{caseData ? caseStatusLabel(caseData.status, language) : "—"}</td>
          </tr>
          <tr>
            <th scope="row">{s.cdComplainant}</th>
            <td>{v(caseData?.victim_name)}</td>
            <th scope="row">{s.cdRiskLevel}</th>
            <td>{caseData?.risk_level ? <RiskBadge level={caseData.risk_level} language={language} /> : "—"}</td>
          </tr>
          <tr>
            <th scope="row">{s.cdCategory}</th>
            <td>{caseData ? scamLabel(caseData.scam_type, language) : "—"}</td>
            <th scope="row">{s.cdRiskScore}</th>
            <td>{caseData && caseData.risk_score !== null && caseData.risk_score !== undefined ? `${riskScoreOf(caseData)} / 100` : "—"}</td>
          </tr>
          <tr>
            <th scope="row">{s.cdDistrict}</th>
            <td>{v(caseData?.district)}</td>
            <th scope="row">{s.cdRegisteredOn}</th>
            <td>{formatDate(caseData?.registered_at, false, language)}</td>
          </tr>
          <tr>
            <th scope="row">{s.cdRegisteredBy}</th>
            <td>{v(caseData?.registered_by_name)}</td>
            <th scope="row">{s.cdPoliceStation}</th>
            <td>{v(caseData?.station_name)}</td>
          </tr>
          <tr>
            <th scope="row">{s.cdGrounds}</th>
            <td colSpan={3}>{v(caseData?.why_flagged)}</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

function SummaryCards({ nodes, edges, s }) {
  const high = nodes.filter((n) => (n.risk_level || "").toLowerCase() === "high").length;
  return (
    <StatCards
      label={s.correlationSummary}
      items={[
        { label: s.totalEntities, value: nodes.length },
        { label: s.totalConnections, value: edges.length },
        { label: s.highRiskEntities, value: high, alert: high > 0, alertText: s.requiresAttention },
        { label: s.crossCaseLinks, value: edges.filter((e) => e.extra?.cross_case).length },
      ]}
    />
  );
}

function EntityRegister({ nodes, edges, isLoading, s, language }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const rows = useMemo(() => {
    const counts = {};
    edges.forEach((e) => {
      counts[e.source] = (counts[e.source] || 0) + 1;
      counts[e.target] = (counts[e.target] || 0) + 1;
    });
    return nodes
      .map((n) => ({ ...n, connections: counts[n.id] || n.degree || 0 }))
      .sort((a, b) => {
        const ra = RISK_RANK[(a.risk_level || "low").toLowerCase()] ?? 3;
        const rb = RISK_RANK[(b.risk_level || "low").toLowerCase()] ?? 3;
        return ra - rb || b.connections - a.connections;
      });
  }, [nodes, edges]);

  const types = [...new Set(nodes.map((n) => n.entity_type))];
  const shown = rows.filter(
    (n) =>
      (typeFilter === "all" || n.entity_type === typeFilter) &&
      (riskFilter === "all" || (n.risk_level || "").toLowerCase() === riskFilter)
  );

  return (
    <Panel
      id="entity-register"
      title={s.entityRegisterTitle}
      meta={isLoading ? s.loadingGeneral : s.showingEntitiesCount.replace("{shown}", shown.length).replace("{total}", rows.length)}
      flush
    >
      <div className="std-toolbar">
        <label htmlFor="std-ent-type">{s.entityTypeFilterLabel}</label>
        <select id="std-ent-type" className="std-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{s.allTypes}</option>
          {types.map((tVal) => <option key={tVal} value={tVal}>{entityTypeLabel(tVal, language)}</option>)}
        </select>
        <label htmlFor="std-ent-risk">{s.thRiskLevel}:</label>
        <select id="std-ent-risk" className="std-select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          <option value="all">{s.allLevels}</option>
          <option value="high">{s.levelHigh}</option>
          <option value="medium">{s.levelMedium}</option>
          <option value="low">{s.levelLow}</option>
        </select>
      </div>
      <div className="std-table-wrap std-table-wrap--scroll">
        <table className="std-table">
          <caption className="std-visually-hidden">{s.entityRegisterTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{s.thSNo}</th>
              <th scope="col">{s.thEntityType}</th>
              <th scope="col">{s.thIdentifier}</th>
              <th scope="col">{s.thRiskLevel}</th>
              <th scope="col" className="num">{s.thConnections}</th>
              <th scope="col">{s.thSource}</th>
              <th scope="col" className="wide">{s.thRemarks}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableMessage colSpan={7}>{s.loadingEntityRegister}</TableMessage>
            ) : shown.length === 0 ? (
              <TableMessage colSpan={7}>{s.noEntitiesMatch}</TableMessage>
            ) : (
              shown.map((n, i) => (
                <tr key={n.id}>
                  <td>{i + 1}</td>
                  <td className="nowrap">{entityTypeLabel(n.entity_type, language)}</td>
                  <td className="std-mono" style={{ wordBreak: "break-all" }}>{n.label}</td>
                  <td><RiskBadge level={n.risk_level} language={language} /></td>
                  <td className="num">{n.connections}</td>
                  <td className="nowrap">{n.is_cross_case ? <StatusBadge tone="medium">{s.sourceOtherCase}</StatusBadge> : s.sourceThisCase}</td>
                  <td>{n.anomaly_reason || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ConnectionRegister({ nodes, edges, isLoading, s, language }) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const rows = useMemo(() => [...edges].sort((a, b) => (b.confidence || 0) - (a.confidence || 0)), [edges]);
  const label = (id) => {
    const n = byId[id];
    return n ? (
      <>
        <span className="std-faint" style={{ fontSize: "0.75rem" }}>{entityTypeLabel(n.entity_type, language)}</span>
        <br />
        <span className="std-mono" style={{ wordBreak: "break-all" }}>{n.label}</span>
      </>
    ) : `${language === "hi" ? "संस्था" : "Entity"} ${id}`;
  };

  return (
    <Panel
      id="connection-register"
      title={s.connectionRegisterTitle}
      meta={isLoading ? s.loadingGeneral : s.connectionRegisterMeta.replace("{count}", rows.length)}
      flush
    >
      <div className="std-table-wrap std-table-wrap--scroll">
        <table className="std-table">
          <caption className="std-visually-hidden">{s.connectionRegisterTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{s.thSNo}</th>
              <th scope="col">{s.thEntityA}</th>
              <th scope="col">{s.thEntityB}</th>
              <th scope="col" className="wide">{s.thBasisOfLink}</th>
              <th scope="col" className="num">{s.thConfidence}</th>
              <th scope="col">{s.thCrossCase}</th>
              <th scope="col">{s.thEvidenceRef}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableMessage colSpan={7}>{s.loadingConnectionRegister}</TableMessage>
            ) : rows.length === 0 ? (
              <TableMessage colSpan={7}>{s.noConnectionsForCase}</TableMessage>
            ) : (
              rows.map((e, i) => (
                <tr key={e.id ?? i}>
                  <td>{i + 1}</td>
                  <td>{label(e.source)}</td>
                  <td>{label(e.target)}</td>
                  <td>{e.basis || "—"}</td>
                  <td className="num">{e.confidence !== undefined ? `${Math.round(e.confidence * 100)}%` : "—"}</td>
                  <td>{e.extra?.cross_case ? s.yesLabel : s.noLabel}</td>
                  <td className="std-mono">{e.source_evidence_ids?.length ? e.source_evidence_ids.join(", ") : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function StandardCorrelationPage() {
  const { language } = useMode();
  const s = t(language);
  const { caseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [allCases, setAllCases] = useState([]);
  const [caseData, setCaseData] = useState(null);
  const [graphData, setGraphData] = useState(() => location.state?.preloadedGraph || { nodes: [], edges: [] });
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(() => !(location.state?.preloadedGraph?.nodes?.length > 0));
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDiagram, setShowDiagram] = useState(true);
  const [error, setError] = useState(null);
  const [narrativeError, setNarrativeError] = useState(null);

  // Same endpoints and handling as the Analysis Mode page.
  const load = async () => {
    if (!graphData.nodes || graphData.nodes.length === 0) setIsLoading(true);
    setError(null);
    try {
      const caseRes = await apiClient.get(`cases/${caseId}`);
      setCaseData(caseRes);
      setIsLoading(false);
      const [graphRes, summaryRes, allCasesRes] = await Promise.allSettled([
        apiClient.get(`cases/${caseId}/graph`),
        apiClient.get(`cases/${caseId}/summary`),
        apiClient.get("cases"),
      ]);
      if (graphRes.status === "fulfilled" && graphRes.value) {
        setGraphData({ nodes: graphRes.value.nodes || [], edges: graphRes.value.edges || [] });
      }
      if (summaryRes.status === "fulfilled" && summaryRes.value) setSummaryData(summaryRes.value);
      if (allCasesRes.status === "fulfilled" && Array.isArray(allCasesRes.value)) setAllCases(allCasesRes.value);
    } catch (err) {
      setError(err.message || s.failedToLoadGraph);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [caseId]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setNarrativeError(null);
    try {
      setSummaryData(await apiClient.post(`cases/${caseId}/summary/regenerate`));
    } catch (err) {
      console.error("Failed to regenerate AI summary:", err);
      setNarrativeError(s.narrativeFailedMsg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const caseNo = caseData?.case_number || `#${caseId}`;
  const { nodes, edges } = graphData;

  return (
    <>
      <Breadcrumb
        items={[
          { label: s.home, to: "/" },
          { label: `${s.thCaseNo} ${caseNo}` },
          { label: s.correlation },
        ]}
        label={s.mainNav}
      />

      <PageHeader
        title={s.caseCorrelationTitle.replace("{caseNo}", caseNo)}
        subtitle={s.caseCorrelationSub}
        actions={
          <>
            {allCases.length > 1 && (
              <>
                <label htmlFor="std-case-switch" className="std-visually-hidden">{s.switchCaseLabel}</label>
                <select id="std-case-switch" className="std-select" value={caseId} onChange={(e) => navigate(`/cases/${e.target.value}/graph`)}>
                  {allCases.map((c) => (
                    <option key={c.id} value={c.id}>{c.case_number} ({c.victim_name})</option>
                  ))}
                </select>
              </>
            )}
            <Link className="std-btn std-btn--secondary" to="/">{s.backToDashboard}</Link>
            <Link className="std-btn" to={`/cases/${caseId}/reports`}>{s.generateReports}</Link>
          </>
        }
      />

      {error && <Notice tone="danger" title={s.unableToLoadCase}>{error}</Notice>}

      <CaseDetailsPanel caseData={caseData} caseId={caseId} s={s} language={language} />
      <SummaryCards nodes={nodes} edges={edges} s={s} />

      <Panel
        id="case-narrative"
        title={s.narrativeTitle}
        meta={
          <button type="button" className="std-btn std-btn--secondary std-btn--sm" onClick={handleRegenerate} disabled={isRegenerating}>
            {isRegenerating ? s.regeneratingNarrative : s.regenerateNarrative}
          </button>
        }
        footer={s.narrativeFooter}
      >
        {narrativeError && <Notice tone="danger" inline title={s.narrativeUnavailable}>{narrativeError}</Notice>}
        {summaryData ? (
          <>
            <p className="std-prose" style={{ marginTop: 0 }}>{summaryData.narrative_text}</p>
            {summaryData.key_takeaways?.length > 0 && (
              <>
                <p className="std-label" style={{ marginTop: "0.9rem" }}>{s.keyDirectivesTitle}</p>
                <ul className="std-list">
                  {summaryData.key_takeaways.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </>
            )}
            <p className="std-hint" style={{ marginTop: "0.9rem" }}>
              {s.generatedVia} {summaryData.model_version || "Deterministic Narrative"}
              {summaryData.generated_at ? ` (${new Date(summaryData.generated_at).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })})` : ""}.
            </p>
          </>
        ) : (
          <p style={{ margin: 0 }} className="std-muted">
            {s.noNarrativeYet}
          </p>
        )}
      </Panel>

      <EntityRegister nodes={nodes} edges={edges} isLoading={isLoading} s={s} language={language} />
      <ConnectionRegister nodes={nodes} edges={edges} isLoading={isLoading} s={s} language={language} />

      <Panel
        id="network-diagram"
        title={s.figureNetworkDiagram}
        meta={
          <button type="button" className="std-btn std-btn--secondary std-btn--sm" aria-expanded={showDiagram} aria-controls="std-diagram-body" onClick={() => setShowDiagram(!showDiagram)}>
            {showDiagram ? s.hideDiagram : s.showDiagram}
          </button>
        }
        flush
      >
        <div id="std-diagram-body" hidden={!showDiagram}>
          {isLoading ? (
            <p className="std-muted" style={{ padding: "0.9rem", margin: 0 }}>{s.loadingDiagram}</p>
          ) : nodes.length === 0 ? (
            <p className="std-muted" style={{ padding: "0.9rem", margin: 0 }}>{s.noDiagramEntities}</p>
          ) : (
            <div className="std-graph-skin">
              <NetworkGraph nodes={nodes} edges={edges} caseNumber={caseNo} victimName={caseData?.victim_name} isLoading={isLoading} />
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
