import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Workflow,
  FileSearch,
  Network,
  ShieldAlert,
  MapPin,
  FileText,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Shield,
  ExternalLink,
} from "lucide-react";
import { useAgents, formatWhen, formatDuration, ORCHESTRATOR_ID } from "../../hooks/useAgents";
import { Breadcrumb, PageHeader, StatusBadge, TableMessage, riskScoreOf } from "./StandardUI";
import { useMode } from "../../context/ModeContext";
import { t } from "../../config/standardPortal";

const AGENT_META = {
  case_orchestrator: {
    icon: Workflow,
    simpleNameEn: "Full Case Auto-Pilot",
    simpleNameHi: "सम्पूर्ण केस ऑटो-पायलट",
    taglineEn: "Runs all 5 investigation agents in sequence with one click",
    taglineHi: "एक क्लिक में सभी 5 जाँच एजेंटों को क्रमबद्ध चलाएं",
    descEn: "Scans suspect accounts, finds links to other cases, scores fraud risk, maps police jurisdiction, and writes a complete summary report.",
    descHi: "संदिग्ध खातों की जांच, क्रॉस-केस लिंक, जोखिम स्कोर, थाना क्षेत्राधिकार और पूर्ण सारांश रिपोर्ट तैयार करता है।",
    badge: "All-in-One",
  },
  digital_evidence: {
    icon: FileSearch,
    simpleNameEn: "Evidence Extractor",
    simpleNameHi: "डिजिटल साक्ष्य निष्कर्षण",
    taglineEn: "Finds and verifies phone numbers, bank accounts, and UPIs",
    taglineHi: "फ़ोन नंबर, बैंक खाते एवं यूपीआई विवरण निकालें",
    descEn: "Pulls every phone number, UPI handle, bank account, and IP address from this case and checks their validity.",
    descHi: "इस प्रकरण से जुड़े सभी मोबाइल नंबर, यूपीआई, बैंक खाते और आईपी एड्रेस को निकालकर सत्यापित करता है।",
    badge: "Evidence",
  },
  correlation: {
    icon: Network,
    simpleNameEn: "Cross-Case Matcher",
    simpleNameHi: "क्रॉस-केस संबंध खोजकर्ता",
    taglineEn: "Discovers links to other criminal cases",
    descEn: "Checks if suspect bank accounts, phones, or devices were also used in other fraud cases across the network.",
    descHi: "जांच करता है कि क्या संदिग्ध बैंक खाते, फोन या डिवाइस राज्य नेटवर्क के अन्य धोखाधड़ी मामलों में भी जुड़े हैं।",
    badge: "Network",
  },
  threat_analysis: {
    icon: ShieldAlert,
    simpleNameEn: "Scam Risk Analyzer",
    simpleNameHi: "जोखिम एवं खतरा विश्लेषक",
    taglineEn: "Calculates risk score and flags danger",
    descEn: "Estimates how dangerous this scam is, calculates the risk score (0-100), and spots organized cyber fraud patterns.",
    descHi: "धोखाधड़ी के खतरे का सटीक आकलन करता है, 0-100 स्कोर निर्धारित करता है और संगठित गिरोहों की पहचान करता है।",
    badge: "Threat",
  },
  jurisdiction: {
    icon: MapPin,
    simpleNameEn: "Jurisdiction & Police Mapper",
    simpleNameHi: "क्षेत्राधिकार एवं थाना लोकेटर",
    taglineEn: "Identifies the responsible police station",
    descEn: "Determines which police station or cyber nodal cell has legal authority to take formal action on this case.",
    descHi: "पहचान करता है कि किस स्थानीय पुलिस थाने अथवा साइबर नोडल सेल को इस प्रकरण पर कार्रवाई का कानूनी अधिकार है।",
    badge: "Jurisdiction",
  },
  investigation_report: {
    icon: FileText,
    simpleNameEn: "Case Report Builder",
    simpleNameHi: "प्रकरण रिपोर्ट निर्माता",
    taglineEn: "Generates your Section 65B ready case summary",
    descEn: "Compiles all findings, suspect details, and next recommended actions into an easy-to-read official summary.",
    descHi: "सभी निष्कर्षों, संदिग्ध विवरणों और अनुशंसित कार्रवाइयों को एक आधिकारिक कानूनी सारांश में संकलित करता है।",
    badge: "Report",
  },
};

const STATUS_CONFIG = {
  completed: { tone: "low", labelEn: "Completed", labelHi: "पूर्ण", Icon: CheckCircle2 },
  attention: { tone: "medium", labelEn: "Needs Review", labelHi: "समीक्षा आवश्यक", Icon: AlertTriangle },
  failed: { tone: "high", labelEn: "Failed", labelHi: "विफल", Icon: XCircle },
  halted: { tone: "high", labelEn: "Stopped", labelHi: "रुक गया", Icon: XCircle },
  running: { tone: "info", labelEn: "Analyzing…", labelHi: "विश्लेषण जारी…", Icon: Loader2 },
  idle: { tone: "neutral", labelEn: "Ready to run", labelHi: "तैयार", Icon: Clock },
};

function StatusChip({ status, lang = "en" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const label = lang === "hi" ? cfg.labelHi : cfg.labelEn;
  return (
    <StatusBadge tone={cfg.tone}>
      {status === "running" ? "⏳ " : ""}
      {label}
    </StatusBadge>
  );
}

/** Clean accordion findings drawer for Standard Mode */
function FindingsDrawer({ run, lang = "en" }) {
  const result = run.result || {};
  const s = t(lang);

  return (
    <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--std-border-soft)" }}>
      {/* Findings */}
      {result.findings?.length > 0 && (
        <div style={{ marginBottom: "0.85rem" }}>
          <strong style={{ fontSize: "0.8125rem", color: "var(--std-navy)", display: "block", marginBottom: "0.4rem" }}>
            {s.agentsKeyFindings} ({result.findings.length})
          </strong>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8125rem", color: "var(--std-text)" }}>
            {result.findings.map((f, i) => (
              <li key={i} style={{ marginBottom: "0.3rem" }}>
                <strong>{f.title}</strong>
                {f.detail ? <span style={{ color: "var(--std-text-muted)" }}> — {f.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations?.length > 0 && (
        <div style={{ marginBottom: "0.85rem" }}>
          <strong style={{ fontSize: "0.8125rem", color: "var(--std-navy)", display: "block", marginBottom: "0.4rem" }}>
            {s.agentsNextSteps}
          </strong>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.8125rem", color: "var(--std-text)" }}>
            {result.recommendations.map((r, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps performed */}
      {result.steps?.length > 0 && (
        <div>
          <strong style={{ fontSize: "0.8125rem", color: "var(--std-navy)", display: "block", marginBottom: "0.4rem" }}>
            {s.agentsStepsTaken}
          </strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {result.steps.map((st, i) => (
              <span
                key={i}
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  backgroundColor: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  color: "#334155",
                }}
              >
                ✓ {st.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StandardAgentsPage() {
  const { language } = useMode();
  const s = t(language);
  const { agents, cases, runs, loading, error, caseId, selectedCase, selectCase, runAgent, runningId, latestByAgent } = useAgents();
  const [expandedId, setExpandedId] = useState(null);

  const orchestrator = agents.find((a) => a.id === ORCHESTRATOR_ID);
  const specialists = agents.filter((a) => a.id !== ORCHESTRATOR_ID);
  const orchRun = latestByAgent[ORCHESTRATOR_ID];
  const pipeline = orchRun?.result?.data?.children || [];
  const busy = !!runningId || !caseId;

  return (
    <>
      <Breadcrumb items={[{ label: s.home, to: "/" }, { label: s.agents }]} />

      <PageHeader
        title={s.agentsTitle}
        subtitle={s.agentsSub}
        actions={
          cases.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label htmlFor="std-agent-case-select" style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--std-navy)" }}>
                {s.agentsCaseLabel}:
              </label>
              <select
                id="std-agent-case-select"
                className="std-select"
                value={caseId || ""}
                onChange={(e) => selectCase(e.target.value)}
                style={{ minWidth: "220px", fontWeight: 500 }}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.victim_name}
                  </option>
                ))}
              </select>
              {caseId && (
                <Link
                  className="std-btn std-btn--secondary std-btn--sm"
                  to={`/cases/${caseId}/graph`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <span>{language === "hi" ? "केस ग्राफ़" : "Open Graph"}</span>
                  <ExternalLink size={13} />
                </Link>
              )}
            </div>
          )
        }
      />

      {error && (
        <div style={{ marginBottom: "1rem" }}>
          <StatusBadge tone="high">{error}</StatusBadge>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--std-text-muted)" }}>
          <p>Loading investigation agents…</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="std-panel" style={{ padding: "2rem", textAlign: "center" }}>
          <h3>No cases found</h3>
          <p style={{ color: "var(--std-text-muted)" }}>
            Please register an investigation case first to run AI analysis.
          </p>
        </div>
      ) : (
        <>
          {/* Active Case Summary Strip */}
          {selectedCase && (
            <div className="std-agent-case-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--std-text-faint)", fontWeight: 700 }}>
                    Active Case File
                  </span>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--std-navy)" }}>
                    {selectedCase.case_number} — {selectedCase.victim_name}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--std-text-faint)", display: "block" }}>Scam Type</span>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    {String(selectedCase.scam_type || "digital_scam").replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--std-text-faint)", display: "block" }}>District</span>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{selectedCase.district || "Pending"}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--std-text-faint)", display: "block" }}>Risk Score</span>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: riskScoreOf(selectedCase) >= 70 ? "#9B1C1C" : "#1B5E2B" }}>
                    {riskScoreOf(selectedCase)} / 100
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Hero Feature Card: Full Case Auto-Pilot */}
          {orchestrator && (
            <section className="std-agent-hero-card" aria-labelledby="hero-autopilot-heading">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ maxWidth: "680px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span style={{ padding: "2px 8px", backgroundColor: "#E6F0FA", color: "#0B3B60", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700 }}>
                      RECOMMENDED FIRST STEP
                    </span>
                    <StatusChip status={runningId === ORCHESTRATOR_ID ? "running" : orchRun?.status || "idle"} lang={language} />
                  </div>
                  <h2 id="hero-autopilot-heading" style={{ margin: "0 0 0.35rem", fontSize: "1.25rem", color: "var(--std-navy)", fontWeight: 700 }}>
                    {language === "hi" ? AGENT_META.case_orchestrator.simpleNameHi : AGENT_META.case_orchestrator.simpleNameEn}
                  </h2>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--std-text-muted)", lineHeight: 1.5 }}>
                    {language === "hi" ? AGENT_META.case_orchestrator.descHi : AGENT_META.case_orchestrator.descEn}
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-run-full-autopilot"
                  className="std-btn"
                  disabled={busy}
                  onClick={() => runAgent(ORCHESTRATOR_ID)}
                  style={{
                    padding: "0.65rem 1.25rem",
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {runningId === ORCHESTRATOR_ID ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{s.agentsRunningAll}</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      <span>{s.agentsRunAllBtn}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step roadmap */}
              <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--std-border-soft)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--std-text-faint)", textTransform: "uppercase" }}>
                  Automated Investigation Pipeline (5 Stages)
                </span>

                <div className="std-agent-pipeline-grid">
                  {[
                    { id: "digital_evidence", name: "1. Extract Evidence", desc: "Extracts phone, UPI & accounts" },
                    { id: "correlation", name: "2. Cross-Case Links", desc: "Finds shared scammer trails" },
                    { id: "threat_analysis", name: "3. Score Scam Risk", desc: "Calculates threat rating 0-100" },
                    { id: "jurisdiction", name: "4. Police Station", desc: "Maps jurisdictional boundary" },
                    { id: "investigation_report", name: "5. Case Summary", desc: "Drafts ready legal report" },
                  ].map((st) => {
                    const child = pipeline.find((p) => p.agent_id === st.id);
                    const stStatus = child ? child.status : orchRun ? "completed" : "idle";
                    return (
                      <div key={st.id} className="std-agent-pipeline-step">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--std-navy)" }}>{st.name}</span>
                          <StatusChip status={stStatus} lang={language} />
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--std-text-muted)" }}>{st.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Results if run exists */}
              {orchRun && (
                <div style={{ marginTop: "1rem", backgroundColor: "#FFFFFF", padding: "1rem", borderRadius: "6px", border: "1px solid var(--std-border-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <strong style={{ fontSize: "0.875rem", color: "var(--std-navy)" }}>Last Auto-Pilot Summary:</strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.875rem", color: "var(--std-text)" }}>{orchRun.summary}</p>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--std-text-faint)" }}>
                      {formatWhen(orchRun.created_at)} ({formatDuration(orchRun.duration_ms)})
                    </span>
                  </div>
                  <FindingsDrawer run={orchRun} lang={language} />
                </div>
              )}
            </section>
          )}

          {/* Section: Individual Specialist Agents */}
          <div style={{ marginBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--std-navy)", margin: "0 0 0.25rem" }}>
              {s.agentsSpecialistsTitle}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--std-text-muted)", margin: 0 }}>
              {s.agentsSpecialistsSub}
            </p>
          </div>

          <div className="std-agent-grid">
            {specialists.map((agent) => {
              const meta = AGENT_META[agent.id] || {
                icon: Shield,
                simpleNameEn: agent.name,
                simpleNameHi: agent.name,
                taglineEn: agent.role,
                taglineHi: agent.role,
                descEn: agent.description,
                descHi: agent.description,
                badge: "Specialist",
              };
              const Icon = meta.icon;
              const run = latestByAgent[agent.id];
              const isRunning = runningId === agent.id;
              const isExpanded = expandedId === agent.id;
              const currentStatus = isRunning ? "running" : run?.status || "idle";

              return (
                <article key={agent.id} className="std-agent-card" aria-label={meta.simpleNameEn}>
                  <div className="std-agent-card-header">
                    <div className="std-agent-card-icon">
                      <Icon size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--std-navy)" }}>
                          {language === "hi" ? meta.simpleNameHi : meta.simpleNameEn}
                        </h3>
                        <StatusChip status={currentStatus} lang={language} />
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--std-text-faint)", display: "block", marginTop: "2px" }}>
                        {language === "hi" ? meta.taglineHi : meta.taglineEn}
                      </span>
                    </div>
                  </div>

                  <div className="std-agent-card-body">
                    <p style={{ margin: "0 0 0.5rem" }}>
                      {language === "hi" ? meta.descHi : meta.descEn}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                      <span style={{ padding: "1px 6px", backgroundColor: "#F1F5F9", borderRadius: "3px", color: "#475569" }}>
                        {agent.access === "read_only" ? "Safe (Read-only)" : "Updates case record"}
                      </span>
                    </div>

                    {run && (
                      <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.65rem", backgroundColor: "#F8FAFC", borderRadius: "4px", border: "1px solid var(--std-border-soft)", fontSize: "0.8125rem" }}>
                        <div style={{ color: "var(--std-text)", fontWeight: 500 }}>{run.summary}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--std-text-faint)", marginTop: "2px" }}>
                          {formatWhen(run.created_at)} · {formatDuration(run.duration_ms)}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="std-agent-card-actions">
                    <button
                      type="button"
                      id={`btn-run-${agent.id}`}
                      className="std-btn std-btn--sm"
                      disabled={busy}
                      onClick={() => runAgent(agent.id)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                    >
                      {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                      <span>{isRunning ? s.agentsRunning : run ? s.agentsRunAgainBtn : s.agentsRunBtn}</span>
                    </button>

                    {run && (
                      <button
                        type="button"
                        id={`btn-toggle-${agent.id}`}
                        onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                        className="std-linkbtn"
                        style={{ fontSize: "0.8125rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <span>{isExpanded ? s.agentsHideFindings : s.agentsViewFindings}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>

                  {run && isExpanded && <FindingsDrawer run={run} lang={language} />}
                </article>
              );
            })}
          </div>

          {/* Activity Log / Audit Trail */}
          <section className="std-panel" aria-labelledby="history-table-title" style={{ marginTop: "2rem" }}>
            <div className="std-panel__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 id="history-table-title" className="std-panel__title">
                  {s.agentsHistoryTitle}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "var(--std-text-muted)" }}>
                  {s.agentsHistorySub}
                </p>
              </div>
              <span style={{ fontSize: "0.8125rem", color: "var(--std-text-faint)", fontWeight: 500 }}>
                {runs.length} {runs.length === 1 ? "run" : "runs"} recorded
              </span>
            </div>

            <div className="std-table-wrap std-table-wrap--scroll">
              <table className="std-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: "60px" }}>#</th>
                    <th scope="col" style={{ width: "160px" }}>Date & Time</th>
                    <th scope="col" style={{ width: "200px" }}>Agent</th>
                    <th scope="col" style={{ width: "130px" }}>Status</th>
                    <th scope="col">What was found</th>
                    <th scope="col" className="num" style={{ width: "100px" }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <TableMessage colSpan={6}>{s.agentsNoRunsYet}</TableMessage>
                  ) : (
                    runs.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td className="nowrap" style={{ fontSize: "0.8125rem" }}>{formatWhen(r.created_at)}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            {r.parent_run_id ? <span style={{ color: "var(--std-text-faint)" }}>↳</span> : null}
                            <strong>{r.agent_name}</strong>
                          </div>
                        </td>
                        <td><StatusChip status={r.status} lang={language} /></td>
                        <td style={{ fontSize: "0.8125rem", lineHeight: 1.45 }}>{r.summary}</td>
                        <td className="num nowrap" style={{ fontSize: "0.8125rem" }}>{formatDuration(r.duration_ms)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
