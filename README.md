<div align="center">

# 🕸️ TraceX
### Cyber Fraud Operations Room

**Evidence → Entities → Connections → Verdict.**
*A single console that turns scattered fraud evidence into a court-ready case, end to end.*

[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](./LICENSE)
[![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20SQLAlchemy-009688.svg)](./backend)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-646CFF.svg)](./frontend)
[![Runs Offline](https://img.shields.io/badge/AI%20assistant-offline--first-8A2BE2.svg)](#-ai-case-assistant)

</div>

---

## 🗂️ Table of Contents

- [What TraceX Actually Does](#-what-tracex-actually-does)
- [Why It's Built This Way](#-why-its-built-this-way)
- [Two Faces, One Engine: Standard Mode vs. Analysis Mode](#-two-faces-one-engine-standard-mode-vs-analysis-mode)
- [The Investigation Pipeline](#-the-investigation-pipeline)
- [Feature Tour](#-feature-tour)
- [Autonomous Agents](#-autonomous-agents)
- [Risk Scoring Engine](#-risk-scoring-engine)
- [Reports & Legal Output](#-reports--legal-output)
- [AI Case Assistant](#-ai-case-assistant)
- [Architecture](#-architecture)
- [Project Layout](#-project-layout)
- [Getting Started](#-getting-started)
- [Running the Live Demo](#-running-the-live-demo)
- [Tests](#-tests)
- [Security Notes](#-security-notes)
- [License](#-license)

---

## 🔍 What TraceX Actually Does

A cybercrime investigating officer receives a complaint. Somewhere in a pile of telecom call records, bank/UPI settlement sheets, phishing emails, and a suspect's Android forensic dump lies the answer to three questions: *who else is involved, how much risk does this case carry, and what can I legally do about it right now?*

TraceX answers all three from one screen:

1. **Ingest** heterogeneous evidence (CDR/IPDR CSVs, bank/UPI XLSX, `.eml` emails, APK forensic JSON dumps) and normalize it into a common entity model.
2. **Correlate** entities — phone numbers, IMEI/IMSI, UPI handles, bank accounts, IPs, emails, URLs — both *within* a case and *across every other case in the system*, surfacing mule chains, SIM swaps, and shared fraud infrastructure.
3. **Score** the case against a scam-type-aware risk model and flag exactly *why* it's dangerous.
4. **Report** — generate a cryptographically hash-stamped Investigative Brief and a Section 69A takedown package, cross-checked against bundled threat-intelligence feeds, ready to hand to a magistrate or a platform's abuse desk.

Everything above runs **without an internet connection or paid API**, on hardware a district cyber cell would actually have.

---

## 🎯 Why It's Built This Way

| Design decision | Reasoning |
|---|---|
| **Rule-based correlation & scoring, not black-box ML** | Every risk score and every entity link resolves to a human-readable rationale (`shared_upi_handle`, `multi_hop_speed`, `known_c2_server` …). That's what survives cross-examination in court — a model that can't explain itself doesn't. |
| **Row-level co-occurrence, not file-level** | Two entities are only linked because they *actually appeared together on the same CDR row or the same bank transaction* — not merely because they showed up somewhere in the same spreadsheet. This is the difference between real correlation and coincidence. |
| **Configurable weight profiles per scam type** | A phishing/vishing case cares about spoofed caller patterns and call velocity; a malicious-APK case cares about C2 servers and invasive permissions. Swapping `backend/app/services/risk/profiles/*.json` retunes the whole scoring engine — no code changes, no redeploy. |
| **Offline-first AI** | The chat assistant and case narratives are answered directly from the case database by default. An LLM key is *optional* — if configured it phrases richer prose from the same grounded facts; if it's slow, rate-limited, or absent, TraceX falls back to the data-driven answer automatically. Investigators in low-connectivity stations are never blocked. |
| **Full chain-of-custody trail** | Every file gets a SHA-256 hash at upload, verified again by the Digital Evidence Agent before any analysis runs. Every autonomous agent execution is persisted as an auditable `AgentRun` record — who triggered it, what it found, how long it took. |

---

## 🪞 Two Faces, One Engine: Standard Mode vs. Analysis Mode

TraceX ships with **two complete UI skins** over the same backend, toggled instantly at runtime — no rebuild required:

- 🏛️ **Standard Mode** — the default. An accessible, official-government-portal presentation: high-contrast option, adjustable font scale (small/normal/large), and a language switcher (English ⇄ Hindi). Built for officers who need a formal, unambiguous, plain-language interface.
- 🌓 **Analysis Mode** — a dark SOC (security-operations-center) theme for deep investigative work: the interactive network graph, dense data tables, and terminal-adjacent aesthetics analysts expect.

Both modes route to the same pages — Dashboard, Correlation Graph, Reports, Agents — they're simply rendered by different component trees (`Standard*` vs. the analysis-mode pages), sharing one API client and one set of CSS design tokens (`tokens.css`) so visual identity never drifts between them.

---

## 🔄 The Investigation Pipeline

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌───────────────┐
│  1. Ingest    │────▶│ 2. Normalize  │────▶│ 3. Correlate      │────▶│ 4. Score Risk    │────▶│ 5. Report      │
│  CSV/XLSX/    │     │  → Entity     │     │  Same-case +      │     │  Scam-aware      │     │  Investigative │
│  .eml/.json   │     │  rows w/ row  │     │  cross-case links │     │  weighted model  │     │  Brief +        │
│  evidence     │     │  provenance   │     │  + subnet /       │     │  → risk_score,   │     │  Takedown       │
│               │     │  (SHA-256'd)  │     │  device pivots    │     │  risk_level      │     │  Package        │
└──────────────┘     └───────────────┘     └──────────────────┘     └─────────────────┘     └───────────────┘
```

Each stage is exposed both as a **directly callable service** and as an **autonomous agent** in the Agent pipeline, so an officer can either work step-by-step through the console or hand the whole case to the **Case Orchestrator Agent** and let it run start to finish.

---

## ✨ Feature Tour

### 📥 Multi-format Evidence Ingestion
- **Telecom parser** — CDR/IPDR CSV/XLSX; auto-detects caller/called number, IMEI, IMSI, and IP columns by fuzzy header matching (handles `msisdn`, `a_party`, `dialled_number`, etc.).
- **Bank/UPI parser** — settlement sheets; extracts account numbers, IFSC codes, UPI/VPA handles, and transaction amounts.
- **Email parser** (`.eml`) — pulls sender/recipient addresses, subject, and — critically — sender IPs recovered from `Received:` header chains, plus embedded URLs.
- **APK forensic dump parser** (`.json`) — reads Android app-dump exports: IMEI, C2 server address, contacted IPs, and flags **high-risk permission combinations** (SMS + Accessibility + Call Log) as a standalone anomaly signal.
- Every ingested row keeps its **row index**, so downstream correlation only links entities that genuinely co-occurred on the same record — never a false pairing from two unrelated rows in the same file.

### 🕸️ Entity Correlation Engine
- Same-value matching across evidence files *and* across every other case in the database (cross-case syndicate detection).
- Relational pivots: shared **IMEI↔phone/IMSI** on the same call row, shared **account↔UPI handle** on the same transaction, and **/24 IP-subnet** clustering for shared network infrastructure.
- Confidence-scored, human-readable link bases (`shared_upi_handle` @ 0.95, `shared_ip_subnet` @ 0.4, etc.) — nothing is a mystery weight.
- Performance-engineered: co-occurrence is computed via an inverted row index (bounded by row count) and IP subnet matches via prefix bucketing — not brute-force O(n²) pairwise scans — so correlation stays fast as a case's entity count grows.
- A hand-built, dependency-free interactive network graph renders the resulting web of entities, with per-entity-type filters and inspectable edge rationales.

### 🚦 Scam-Type-Aware Risk Scoring
- Three pluggable weight profiles ship out of the box — **Digital Scam**, **Phishing/Vishing**, **Malicious APK** — each in its own JSON file, hot-swappable without a code change.
- Produces a 0–100 score, a Low/Medium/High tier, and a plain-English `why_flagged` explanation naming the strongest contributing signal.
- **Cross-case escalation bonus**: if a case's entities reappear in another open investigation, the score is automatically boosted and the rationale names the matched case.
- Individual entities are risk-tagged too, based on their strongest link confidence or anomaly flag — so an officer can see at a glance *which specific account or phone* is driving the case's danger rating.

### 🗺️ Jurisdiction & Fraud-Density Mapping
- Fully offline **IFSC-prefix** and **PIN-code-prefix → district** lookup tables (bundled CSVs, no external geocoding API) resolve which district a case belongs to straight from the evidence itself.
- A district-wise fraud-density heatmap shows where the caseload is concentrated, so the right station can be looped in early.

### 📄 Legal-Grade Reporting
- **Investigative Brief** — a one-page, print-ready PDF: case summary, entity breakdown, correlation matrix, evidence timeline, and immediate **Section 91 CrPC** freeze directives.
- **Takedown Request Package** — a **Section 69A IT Act** notice, auto-cross-matched against bundled known-bad-URL and known-malicious-APK-hash threat-intelligence feeds.
- Both are stamped with **SHA-256 verification hashes** for evidentiary integrity, can be password-protected, and are rendered via ReportLab (with a WeasyPrint HTML path available) — no cloud rendering service involved.

### 💬 AI Case Assistant
- A floating chat widget answers officer questions — case summaries, risk rationale, suspect/entity lookups, cross-case overlaps, evidence status, recommended next actions — grounded directly in the case's own database rows.
- Intent-matched via pattern recognition (risk questions, correlation questions, action questions, entity-type questions, etc.) so answers are precise, not generic chatbot filler.
- If an LLM key is configured, the same grounded facts are handed to the model to be phrased more naturally; if the LLM call fails or is slow, TraceX transparently falls back to the rules-based answer with a short note — the officer is never left without a response.

### 🤖 Multi-Agent Investigation Pipeline
- Six specialist agents (see [below](#-autonomous-agents)) that can be run individually or orchestrated as one pipeline, each producing structured findings, recommendations, and metrics.
- Every run is persisted as an auditable, timestamped `AgentRun` record — full transparency into what an "AI" decided and why, with parent/child run linkage for the orchestrator's sub-runs.

### 🌐 Accessibility & Localization
- Standard Mode ships high-contrast mode, three font-size scales, and English/Hindi language switching — baked into the design from day one, not bolted on.

---

## 🤖 Autonomous Agents

The **Case Orchestrator Agent** plans and runs the full pipeline below, halting immediately if evidence integrity is compromised:

| # | Agent | Role |
|---|---|---|
| 1 | **Digital Evidence Agent** | Re-computes SHA-256 hashes against upload-time values, checks processing status, evidence-category coverage, and duplicate files. Read-only — flags anything weakening chain of custody. |
| 2 | **Correlation Agent** | Runs the entity-correlation engine, rebuilds the relationship graph, and reports hub entities (likely mule accounts / shared devices) plus links into other open cases. |
| 3 | **Threat Analysis Agent** | Re-scores the case with its scam-type risk profile, profiles high-risk entities, and matches URLs/APK hashes against bundled threat-intel feeds. |
| 4 | **Jurisdiction Agent** | Resolves the case's district from IFSC/PIN evidence via offline lookups and situates it in the district-wise fraud-density picture. |
| 5 | **Investigation Report Agent** | Checks report readiness (evidence uploaded → processed → entities extracted → correlated → risk scored), prepares the case narrative, and recommends which reports to issue. |

The orchestrator **stops the pipeline cold** if the Digital Evidence Agent flags a critical integrity problem — downstream agents never analyze evidence that can't be trusted, by design.

---

## ⚖️ Risk Scoring Engine

```
score = Σ (signal_weight × signal_score) / Σ (signal_weights)     [0–100]

risk_level =  HIGH    if score ≥ 70
              MEDIUM  if 40 ≤ score < 70
              LOW     if score < 40

+ 15-point escalation bonus if any entity cross-matches another open case
```

Signals include `multi_hop_speed` (rapid mule-chain fund movement), `shared_upi_handle`, `shared_account`, `shared_ip`, `shared_imei`, `high_risk_permissions`, `known_c2_server`, `spoofed_caller_pattern`, and `high_call_velocity` — each independently computed and independently explainable.

---

## 📑 Reports & Legal Output

| Report | Legal basis | Contents |
|---|---|---|
| **Investigative Brief** | Section 91, CrPC | Case summary, entity breakdown, correlation matrix (top-linked entities), evidence timeline, freeze recommendations |
| **Takedown Request Package** | Section 69A, IT Act | Threat-intel-matched malicious URLs/APKs, formal takedown directive text, supporting evidence references |

Both support optional password protection and are stamped with SHA-256 integrity hashes at generation time.

---

## 🏗️ Architecture

```
┌────────────────────────────── Frontend (React + Vite) ──────────────────────────────┐
│  Standard Mode UI  ⇄  Analysis Mode UI   (shared ModeContext + design tokens)        │
│  Dashboard · Correlation Graph · Reports · Agents · Chat Widget                     │
└───────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │ REST (JWT auth)
┌────────────────────────────────────────▼───────────────────────────────────────────────┐
│                              Backend (FastAPI + SQLAlchemy)                            │
│  ┌───────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ │
│  │ Ingestion │▶│ Correlation  │▶│    Risk     │ │   Geo    │ │ Reports │ │  Agents  │ │
│  │ (parsers) │ │ (entity_     │ │  (scoring + │ │ (IFSC/   │ │ (PDF    │ │ (6-agent │ │
│  │           │ │ correlation) │ │  profiles)  │ │ PIN geo) │ │ gen)    │ │ pipeline)│ │
│  └───────────┘ └──────────────┘ └─────────────┘ └──────────┘ └─────────┘ └──────────┘ │
│                              AI: chat_engine (rules-first) + optional LLM              │
│                        SQLite/SQLAlchemy models: Officer · Case · EvidenceFile ·       │
│                        Entity · EntityLink · CaseSummary · AgentRun                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Backend stack:** FastAPI · SQLAlchemy · pandas/openpyxl (parsing) · networkx (graph building) · ReportLab/WeasyPrint (PDF) · python-jose + passlib/bcrypt (auth)

**Frontend stack:** React 18 · React Router · Vite · Tailwind CSS · lucide-react icons — deliberately no heavyweight graph-visualization dependency; the network graph is hand-built.

---

## 📁 Project Layout

```
backend/
  app/
    api/routes/       # auth, cases, evidence, correlation, geo, reports, chat, agents
    core/              # config, JWT/password security
    db/                # SQLAlchemy models, seed data, seed demo cases
    services/
      ingestion/       # telecom, bank/UPI, email, APK parsers + router
      correlation/     # entity correlation engine + graph builder
      risk/            # scoring engine + per-scam-type weight profiles
      geo/              # IFSC/PIN district resolution + heatmap
      reports/         # PDF generation (Investigative Brief, Takedown Package)
      agents/          # 6-agent pipeline + orchestrator + audit registry
      ai/               # rules-based chat engine + optional LLM bridge + case narratives
  tests/               # pytest suite covering agents, correlation, risk, geo, reports, chat, auth
frontend/
  src/
    pages/             # Analysis Mode pages (Home, ConnectionsGraph, Reports, Agents)
    components/standard/  # Standard Mode page variants + shell
    components/        # Shared widgets: NetworkGraph, ChatWidget, HeatmapGrid, EvidenceTray …
    context/           # ModeContext (Standard/Analysis, accessibility, language)
    config/            # standardPortal.js — Standard Mode copy + i18n strings
    routes/            # AppRouter — mode-aware routing
ppt/                   # EPINOIA pitch deck source + generator scripts
```

---

## 🚀 Getting Started

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Backend starts at `http://localhost:8000`. On first launch it auto-seeds a default officer and four pre-correlated demo cases spanning every risk tier and scam type.

#### Optional: LLM-phrased AI assistant

The assistant works fully offline out of the box. To let a configured LLM phrase richer answers from the same grounded case data, set in `backend/.env`:

```env
AI_SUMMARY_API_KEY=<your key>          # leave as the placeholder to keep the LLM off
AI_SUMMARY_API_URL=https://api.groq.com/openai/v1/chat/completions
AI_SUMMARY_MODEL=openai/gpt-oss-20b
AI_CHAT_TIMEOUT_SECONDS=60
```

If the LLM is slow, rate-limited, or unreachable, the assistant automatically falls back to the data-driven answer with a short note — it never fails silently.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Dashboard opens at `http://localhost:5173`.

---

## 🎬 Running the Live Demo

1. **Start both servers** (backend on `:8000`, frontend on `:5173`) as above.
2. **Log in** with the seeded credentials:
   - Officer / Badge ID: `MP-IO-4471`
   - Password: `demo1234`
3. From the **Home** priority queue, click **"+ New investigation"**, enter a victim name, choose a scam type, and upload the sample evidence bundled at `backend/data/sample/` (`mock_cdr.csv`, `mock_bank_upi.xlsx`, `mock_apk_dump.json`, `mock_email.eml`).
4. Click **"Find connections & view graph"** — watch correlation and risk scoring run live, then explore the network graph, filter by entity type, and inspect edge confidence rationales.
5. Head to **Reports** to generate a password-protected Investigative Brief and Takedown Package, both stamped with SHA-256 verification hashes.
6. Try the **Agents** tab to run the full 6-agent pipeline on the case, or the chat widget for grounded Q&A.

---

## 🧪 Tests

```bash
cd backend
pytest
```

Coverage spans authentication, ingestion, entity correlation, risk scoring, geo/jurisdiction resolution, report generation, the agent pipeline, and both the rules-based and LLM-backed chat paths.

---

## 🔐 Security Notes

- Passwords are hashed with bcrypt; sessions use JWT bearer tokens.
- Evidence integrity is enforced end-to-end: SHA-256 at upload, re-verified by the Digital Evidence Agent before any downstream analysis proceeds.
- No evidence data or case content ever leaves the machine unless an LLM key is explicitly configured — and even then, only the minimal grounded context needed to phrase an answer is sent.

---

## 📜 License

Released under the [MIT License](./LICENSE).

<div align="center">

*Built for investigators who need answers, not another dashboard to babysit.*

</div>