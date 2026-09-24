import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
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
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useAgents, formatWhen, formatDuration, ORCHESTRATOR_ID } from "../hooks/useAgents";

const AGENT_INFO = {
  case_orchestrator: {
    icon: Workflow,
    color: "#00D4FF",
    bgSoft: "rgba(0, 212, 255, 0.12)",
    borderSoft: "rgba(0, 212, 255, 0.35)",
    simpleName: "Full Case Auto-Pilot",
    tagline: "Runs all 5 investigation agents in sequence with 1 click",
    description: "Extracts evidence, tracks criminal links across cases, calculates risk, maps the responsible police station, and writes your case report in one step.",
    actionText: "Run Full Auto-Pilot",
  },
  digital_evidence: {
    icon: FileSearch,
    color: "#00E5C8",
    bgSoft: "rgba(0, 229, 200, 0.12)",
    borderSoft: "rgba(0, 229, 200, 0.3)",
    simpleName: "Evidence Extractor",
    tagline: "Finds and verifies phone numbers, bank accounts, and UPIs",
    description: "Pulls every suspect phone number, UPI handle, bank account, and IP address from this case and checks their validity.",
    actionText: "Scan Evidence",
  },
  correlation: {
    icon: Network,
    color: "#A78BFA",
    bgSoft: "rgba(167, 139, 250, 0.12)",
    borderSoft: "rgba(167, 139, 250, 0.3)",
    simpleName: "Cross-Case Matcher",
    tagline: "Discovers links to other criminal cases",
    description: "Checks if suspect bank accounts, phones, or devices were also used in other fraud cases across the network.",
    actionText: "Find Connections",
  },
  threat_analysis: {
    icon: ShieldAlert,
    color: "#F59E0B",
    bgSoft: "rgba(245, 158, 11, 0.12)",
    borderSoft: "rgba(245, 158, 11, 0.3)",
    simpleName: "Scam Risk Analyzer",
    tagline: "Calculates risk score and flags danger",
    description: "Estimates how dangerous this scam is, calculates the risk score (0-100), and spots organized scam patterns.",
    actionText: "Assess Risk",
  },
  jurisdiction: {
    icon: MapPin,
    color: "#10B981",
    bgSoft: "rgba(16, 185, 129, 0.12)",
    borderSoft: "rgba(16, 185, 129, 0.3)",
    simpleName: "Jurisdiction & Police Mapper",
    tagline: "Identifies the responsible police station",
    description: "Determines which police station or cyber nodal cell has legal authority to take formal action on this case.",
    actionText: "Check Jurisdiction",
  },
  investigation_report: {
    icon: FileText,
    color: "#38BDF8",
    bgSoft: "rgba(56, 189, 248, 0.12)",
    borderSoft: "rgba(56, 189, 248, 0.3)",
    simpleName: "Case Report Builder",
    tagline: "Generates your Section 65B ready case summary",
    description: "Compiles all findings, suspect details, and next recommended actions into an easy-to-read official summary.",
    actionText: "Generate Report",
  },
};

const STATUS_MAP = {
  completed: {
    label: "Completed",
    badgeCls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  attention: {
    label: "Needs Review",
    badgeCls: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    Icon: AlertTriangle,
  },
  failed: {
    label: "Failed",
    badgeCls: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    Icon: XCircle,
  },
  halted: {
    label: "Stopped",
    badgeCls: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    Icon: XCircle,
  },
  running: {
    label: "Analyzing…",
    badgeCls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    Icon: Loader2,
  },
  idle: {
    label: "Ready to run",
    badgeCls: "text-slate-400 bg-slate-800/40 border-slate-700/50",
    Icon: Clock,
  },
};

function StatusPill({ status }) {
  const conf = STATUS_MAP[status] || STATUS_MAP.idle;
  const Icon = conf.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium tracking-wide ${conf.badgeCls}`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      <span>{conf.label}</span>
    </span>
  );
}

/** Clean accordion findings drawer for Analysis Mode */
function FindingsDrawer({ run }) {
  const result = run.result || {};
  const findings = result.findings || [];
  const recommendations = result.recommendations || [];
  const steps = result.steps || [];

  return (
    <div
      className="mt-3.5 pt-3.5 space-y-3.5 text-[12px] border-t"
      style={{ borderColor: "rgba(0, 212, 255, 0.12)" }}
    >
      {/* Key Findings */}
      {findings.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-cyan-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Key Findings ({findings.length})</span>
          </div>
          <div className="space-y-1.5">
            {findings.map((f, i) => {
              const isHigh = f.severity === "critical" || f.severity === "high";
              const isMed = f.severity === "medium";
              return (
                <div
                  key={i}
                  className="p-2.5 rounded-lg flex items-start gap-2.5 transition-all"
                  style={{
                    background: isHigh
                      ? "rgba(244, 63, 94, 0.08)"
                      : isMed
                      ? "rgba(245, 158, 11, 0.08)"
                      : "rgba(15, 23, 42, 0.6)",
                    border: `1px solid ${
                      isHigh
                        ? "rgba(244, 63, 94, 0.25)"
                        : isMed
                        ? "rgba(245, 158, 11, 0.25)"
                        : "rgba(0, 212, 255, 0.10)"
                    }`,
                  }}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5 ${
                      isHigh
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : isMed
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    }`}
                  >
                    {f.severity || "info"}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-200">{f.title}</p>
                    {f.detail && <p className="text-slate-400 text-[11.5px] mt-0.5">{f.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Next Steps */}
      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Recommended Next Actions</span>
          </div>
          <ul className="space-y-1.5">
            {recommendations.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-slate-300 p-2 rounded-md"
                style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)" }}
              >
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps executed */}
      {steps.length > 0 && (
        <div className="pt-2">
          <p className="text-[10.5px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
            Execution Steps Completed
          </p>
          <div className="flex flex-wrap gap-1.5">
            {steps.map((st, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1"
                style={{
                  background: "rgba(0, 212, 255, 0.06)",
                  border: "1px solid rgba(0, 212, 255, 0.15)",
                  color: "#94A3B8",
                }}
              >
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                <span>{st.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Agents() {
  const {
    agents,
    cases,
    runs,
    loading,
    error,
    caseId,
    selectedCase,
    selectCase,
    runAgent,
    runningId,
    latestByAgent,
  } = useAgents();

  const [expandedId, setExpandedId] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");

  const orchestrator = agents.find((a) => a.id === ORCHESTRATOR_ID);
  const specialists = agents.filter((a) => a.id !== ORCHESTRATOR_ID);
  const orchRun = latestByAgent[ORCHESTRATOR_ID];
  const pipeline = orchRun?.result?.data?.children || [];
  const busy = !!runningId || !caseId;

  // Filter history
  const filteredRuns = useMemo(() => {
    if (historyFilter === "completed") return runs.filter((r) => r.status === "completed");
    if (historyFilter === "attention") return runs.filter((r) => r.status === "attention" || r.status === "failed");
    return runs;
  }, [runs, historyFilter]);

  const riskScore = selectedCase?.risk_score !== null && selectedCase?.risk_score !== undefined
    ? Math.round(selectedCase.risk_score)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in-up">
      {/* ── Page Header & Interactive Case Selector ─────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 mb-1.5">
            <Zap className="w-3 h-3" />
            <span>AI Operations Room</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-[#00D4FF]" />
            AI Investigation Agents
          </h1>
          <p className="text-[13px] text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Specialized AI assistants that analyze case evidence, uncover hidden fraud links, and guide your next best steps.
          </p>
        </div>

        {/* Case Selector Dropdown */}
        <div
          className="flex items-center gap-3 p-2 rounded-xl"
          style={{
            background: "rgba(10, 18, 36, 0.7)",
            border: "1px solid rgba(0, 212, 255, 0.2)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
          }}
        >
          <label htmlFor="agent-case-select" className="text-[11.5px] font-mono text-cyan-400 whitespace-nowrap pl-1">
            Active Case:
          </label>
          <select
            id="agent-case-select"
            value={caseId || ""}
            onChange={(e) => selectCase(e.target.value)}
            className="bg-black/60 border border-cyan-500/30 rounded-lg px-3 py-1.5 text-[12.5px] font-mono text-white outline-none cursor-pointer focus:border-cyan-400"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_number} ({c.victim_name})
              </option>
            ))}
          </select>
          {caseId && (
            <Link
              to={`/cases/${caseId}/graph`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-cyan-400 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>Case Graph</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </section>

      {/* ── Active Case Info Bar ─────────────────────────────────────────── */}
      {selectedCase && (
        <section
          className="p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-4"
          style={{
            background: "rgba(8, 14, 28, 0.8)",
            border: "1px solid rgba(0, 212, 255, 0.18)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-cyan-400"
              style={{ background: "rgba(0, 212, 255, 0.1)", border: "1px solid rgba(0, 212, 255, 0.25)" }}
            >
              #{selectedCase.case_number?.replace(/[^0-9]/g, "").slice(-4) || "CASE"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-[14px]">{selectedCase.victim_name}</span>
                <span className="text-[11px] font-mono text-cyan-400">({selectedCase.case_number})</span>
              </div>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                {selectedCase.district || "District pending"} · IO:{" "}
                <span className="text-slate-300 font-medium">Bhopal Cyber Cell</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3 py-1 rounded-lg bg-black/40 border border-slate-700/60 text-center">
              <span className="block text-[10px] font-mono uppercase text-slate-400">Scam Type</span>
              <span className="text-[12px] font-semibold text-slate-200">
                {String(selectedCase.scam_type || "digital_scam").replace(/_/g, " ").toUpperCase()}
              </span>
            </div>

            <div className="px-3 py-1 rounded-lg bg-black/40 border border-slate-700/60 text-center">
              <span className="block text-[10px] font-mono uppercase text-slate-400">Threat Rating</span>
              <span
                className={`text-[12px] font-bold ${
                  riskScore >= 70 ? "text-rose-400" : riskScore >= 40 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {riskScore} / 100
              </span>
            </div>

            <div className="px-3 py-1 rounded-lg bg-black/40 border border-slate-700/60 text-center">
              <span className="block text-[10px] font-mono uppercase text-slate-400">Status</span>
              <span className="text-[12px] font-semibold text-cyan-400 uppercase tracking-wide">
                {selectedCase.status || "Open"}
              </span>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[13px]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-mono text-[13px]">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
          Loading investigation agents…
        </div>
      ) : cases.length === 0 ? (
        <div className="p-8 rounded-xl bg-black/40 border border-slate-800 text-center text-slate-400">
          <p className="text-base text-slate-300">No cases found.</p>
          <p className="text-[13px] mt-1">Please register a case first before running AI agents.</p>
        </div>
      ) : (
        <>
          {/* ── Hero Orchestrator Card (Full Auto-Pilot) ─────────────────── */}
          {orchestrator && (
            <section
              className="p-5 sm:p-6 rounded-2xl relative overflow-hidden transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(8, 20, 42, 0.85) 0%, rgba(12, 10, 32, 0.85) 100%)",
                border: "1px solid rgba(0, 212, 255, 0.35)",
                boxShadow: "0 0 35px rgba(0, 212, 255, 0.12), inset 0 1px 0 rgba(0, 212, 255, 0.2)",
              }}
            >
              {/* Corner accent decorations */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                <div className="flex items-start gap-4">
                  <div
                    className="p-3 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #0099CC 0%, #005FA0 100%)",
                      boxShadow: "0 0 16px rgba(0, 212, 255, 0.4)",
                      color: "#FFFFFF",
                    }}
                  >
                    <Workflow className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        RECOMMENDED ACTION
                      </span>
                      <h2 className="text-lg font-bold text-white tracking-tight">
                        {AGENT_INFO.case_orchestrator.simpleName}
                      </h2>
                      <StatusPill status={runningId === ORCHESTRATOR_ID ? "running" : orchRun?.status || "idle"} />
                    </div>
                    <p className="text-[13px] text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                      {AGENT_INFO.case_orchestrator.description}
                    </p>
                  </div>
                </div>

                {/* Primary Run Button */}
                <button
                  type="button"
                  id="btn-run-full-autopilot"
                  disabled={busy}
                  onClick={() => runAgent(ORCHESTRATOR_ID)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-[13px] text-white flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #00B4D8 0%, #0077B6 100%)",
                    border: "1px solid rgba(0, 212, 255, 0.6)",
                    boxShadow: busy ? "none" : "0 0 20px rgba(0, 212, 255, 0.35)",
                  }}
                  onMouseEnter={(e) => {
                    if (!busy) e.currentTarget.style.boxShadow = "0 0 30px rgba(0, 212, 255, 0.6)";
                  }}
                  onMouseLeave={(e) => {
                    if (!busy) e.currentTarget.style.boxShadow = "0 0 20px rgba(0, 212, 255, 0.35)";
                  }}
                >
                  {runningId === ORCHESTRATOR_ID ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Running Auto-Pilot Pipeline…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>{orchRun ? "Re-run Auto-Pilot" : "Run Full Auto-Pilot"}</span>
                    </>
                  )}
                </button>
              </div>

              {/* 5-Step Pipeline Roadmap */}
              <div className="mt-5 pt-4 border-t border-cyan-500/15">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span>5-Stage Automated Investigation Sequence</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500 font-sans normal-case">Runs each specialist agent automatically</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  {[
                    { id: "digital_evidence", step: 1, name: "Extract Evidence", detail: "Phones, accounts, UPIs" },
                    { id: "correlation", step: 2, name: "Cross-Case Links", detail: "Shared scam networks" },
                    { id: "threat_analysis", step: 3, name: "Score Threat", detail: "0-100 risk rating" },
                    { id: "jurisdiction", step: 4, name: "Police Station", detail: "Legal jurisdiction" },
                    { id: "investigation_report", step: 5, name: "Draft Report", detail: "Section 65B summary" },
                  ].map((s) => {
                    const child = pipeline.find((p) => p.agent_id === s.id);
                    const stStatus = child ? child.status : orchRun ? "completed" : "idle";
                    return (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl flex flex-col justify-between"
                        style={{
                          background: "rgba(5, 10, 24, 0.6)",
                          border: "1px solid rgba(0, 212, 255, 0.12)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-cyan-400 font-semibold">STAGE {s.step}</span>
                          <StatusPill status={stStatus} />
                        </div>
                        <div className="text-[12px] font-semibold text-slate-200 mt-1">{s.name}</div>
                        <div className="text-[10.5px] text-slate-400 mt-0.5">{s.detail}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Run Highlights */}
              {orchRun && (
                <div
                  className="mt-4 p-3.5 rounded-xl"
                  style={{
                    background: "rgba(5, 12, 26, 0.7)",
                    border: "1px solid rgba(0, 212, 255, 0.2)",
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                        Latest Outcome:
                      </span>
                      <span className="text-[12.5px] text-slate-200">{orchRun.summary}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatWhen(orchRun.created_at)} · {formatDuration(orchRun.duration_ms)}
                    </span>
                  </div>

                  <FindingsDrawer run={orchRun} />
                </div>
              )}
            </section>
          )}

          {/* ── Section: Specialist Agents Grid ──────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-lg font-bold text-white">Individual Specialist Agents</h2>
                <p className="text-[12.5px] text-slate-400 mt-0.5">
                  Need to investigate a specific aspect? Run any specialist individually below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {specialists.map((agent) => {
                const info = AGENT_INFO[agent.id] || {
                  icon: Bot,
                  color: "#00D4FF",
                  bgSoft: "rgba(0, 212, 255, 0.1)",
                  borderSoft: "rgba(0, 212, 255, 0.2)",
                  simpleName: agent.name,
                  tagline: agent.role,
                  description: agent.description,
                  actionText: "Run Agent",
                };

                const Icon = info.icon;
                const run = latestByAgent[agent.id];
                const isRunning = runningId === agent.id;
                const isExpanded = expandedId === agent.id;
                const currentStatus = isRunning ? "running" : run?.status || "idle";

                return (
                  <article
                    key={agent.id}
                    className="p-4 rounded-xl flex flex-col justify-between transition-all"
                    style={{
                      background: "rgba(8, 14, 28, 0.75)",
                      border: "1px solid rgba(0, 212, 255, 0.15)",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
                    }}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start gap-3 mb-2.5">
                        <div
                          className="p-2.5 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: info.bgSoft,
                            border: `1px solid ${info.borderSoft}`,
                            color: info.color,
                          }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <h3 className="text-[14px] font-bold text-white tracking-tight truncate">
                              {info.simpleName}
                            </h3>
                            <StatusPill status={currentStatus} />
                          </div>
                          <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: info.color }}>
                            {info.tagline}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[12px] text-slate-300 leading-relaxed mb-3">
                        {info.description}
                      </p>

                      {/* Permissions Tag */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40 border border-slate-700/60 text-slate-400">
                          {agent.access === "read_only" ? "Safe Scan (Read-only)" : "Saves updates to case"}
                        </span>
                      </div>

                      {/* Latest run summary box */}
                      {run && (
                        <div
                          className="p-2.5 rounded-lg text-[11.5px]"
                          style={{
                            background: "rgba(0, 0, 0, 0.4)",
                            border: "1px solid rgba(0, 212, 255, 0.10)",
                          }}
                        >
                          <p className="text-slate-200 line-clamp-2">{run.summary}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-1">
                            {formatWhen(run.created_at)} · {formatDuration(run.duration_ms)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Strip */}
                    <div
                      className="mt-4 pt-3 flex items-center justify-between gap-2 border-t"
                      style={{ borderColor: "rgba(0, 212, 255, 0.10)" }}
                    >
                      <button
                        type="button"
                        id={`btn-run-${agent.id}`}
                        disabled={busy}
                        onClick={() => runAgent(agent.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: isRunning ? "rgba(0, 212, 255, 0.3)" : "rgba(0, 212, 255, 0.15)",
                          border: "1px solid rgba(0, 212, 255, 0.4)",
                          boxShadow: isRunning ? "none" : "0 0 10px rgba(0, 212, 255, 0.15)",
                        }}
                      >
                        {isRunning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        ) : (
                          <Play className="w-3 h-3 fill-current text-cyan-400" />
                        )}
                        <span>{isRunning ? "Analyzing…" : run ? "Run Again" : info.actionText}</span>
                      </button>

                      {run && (
                        <button
                          type="button"
                          id={`btn-toggle-${agent.id}`}
                          onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                          className="inline-flex items-center gap-1 text-[11.5px] text-cyan-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? "Hide Details" : "View Findings"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>

                    {run && isExpanded && <FindingsDrawer run={run} />}
                  </article>
                );
              })}
            </div>
          </div>

          {/* ── Section: Activity Log & Audit Trail ──────────────────────── */}
          <section
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(8, 14, 28, 0.8)",
              border: "1px solid rgba(0, 212, 255, 0.18)",
              boxShadow: "0 6px 24px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b"
              style={{ borderColor: "rgba(0, 212, 255, 0.12)" }}
            >
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Investigation History &amp; Audit Log</span>
                  <span className="text-[11px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25">
                    {runs.length} {runs.length === 1 ? "run" : "runs"}
                  </span>
                </h2>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  Complete history of every agent run on case {selectedCase?.case_number}.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setHistoryFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                    historyFilter === "all"
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "bg-black/40 text-slate-400 hover:text-white"
                  }`}
                >
                  All Runs
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter("completed")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                    historyFilter === "completed"
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "bg-black/40 text-slate-400 hover:text-white"
                  }`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter("attention")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                    historyFilter === "attention"
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "bg-black/40 text-slate-400 hover:text-white"
                  }`}
                >
                  Needs Attention
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px] text-left">
                <thead>
                  <tr
                    className="text-slate-400 text-[10.5px] font-mono uppercase tracking-wider"
                    style={{ background: "rgba(0, 0, 0, 0.3)" }}
                  >
                    <th className="px-4 py-2.5">Date &amp; Time</th>
                    <th className="px-4 py-2.5">Agent</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">What was found</th>
                    <th className="px-4 py-2.5 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "rgba(0, 212, 255, 0.08)" }}>
                  {filteredRuns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No agent run history found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRuns.slice(0, 20).map((r) => (
                      <tr
                        key={r.id}
                        className="transition-colors hover:bg-cyan-500/5"
                      >
                        <td className="px-4 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                          {formatWhen(r.created_at)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-white font-medium">
                            {r.parent_run_id ? <span className="text-cyan-400">↳</span> : null}
                            <span>{r.agent_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 leading-relaxed max-w-md">
                          {r.summary}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">
                          {formatDuration(r.duration_ms)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
