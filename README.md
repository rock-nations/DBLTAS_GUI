# DBLTAS Dashboard – tecWatch Interactive Trace Analysis

An interactive Web GUI built with **Angular (Module-Based Architecture / `NgModule`)** for viewing, inspecting, and analyzing communication and trace-analysis results from **tecWatch** systems.

---

## 🌟 Key Features

- **Read-Only Analysis Dashboard**: On initial load the GUI calls `GET /api/status` (tecWatch status) and `GET /api/analysis` (the validated analysis report). The GUI never posts analysis data; it only uploads raw test-bench files for analysis (see *Upload & Analyze*).
- **🚦 Operator Status Bar**: Shown on every page, built for the DB trial operator: overall tecWatch state, SCI-TDS/RaSTA link (baseline, BTP version check), object controller and heartbeat, GFM-A section state (Belegungszustand, Grundstellbarkeit, since when), test unit state with verdict counts, and active alerts.
- **🔎 Analysis Findings Page** (`/findings`, header button): the data-analysis workbook via `GET /api/analysis/scenarios`, shown summary-first so a client sees at a glance what went wrong:
  - **Summary** (default): verdict banner with the main cause, *Why the tests failed* (one plain-language explanation per failed or inconclusive test case, with where it failed and the related findings), *Main problems & what to do* (high-severity findings with their recommendation) and *Working as expected* (ruled-out causes and passed test cases). Test run details are collapsed.
  - **Findings**: search and filter by severity and test case; each finding shows *What happened*, *Why* and *What to do*. Evidence, possible reasons, linked timeline events and the method are collapsed under *Technical details*.
  - **Timeline**: capture telegrams and report steps on one time base, with a test-case filter and highlighting of a finding's events.
  - **GFM-A states**: chart of test-case windows, Belegungszustand, Grundstellbarkeit and AZG/AZGH commands; the state table is collapsed.
  - Data-source matrices, the analysis method and the workbook's open questions are not shown (the API still delivers them).
- **⬆ Upload & Analyze Page** (`/upload`, header button): upload a capture (`.pcapng`/`.pcap`, e.g. `RealOCWorking_TDS_21026.pcapng`) and/or a CANoe test report (`.pdf`, e.g. `Real_SCI-TDS_2026-10-02_12-24-11.pdf`) by drag & drop or file picker. The files are sent to `POST /api/analysis/upload`; the backend decodes the RaSTA/SCI-TDS telegrams and the report and returns findings that the page shows with the same Summary / Findings / Timeline / GFM-A views. With only a capture the summary covers the trace; add the report to get the *Why the tests failed* explanations. File type and size (max. 50 MB) are checked before the upload, backend errors are shown on the page, and the last result is kept while switching views (*Start over* clears it).
- **🧪 Test-Case Navigator**: Lists every test case of the report with its verdict (`PASSED`, `FAILED`, `INCONCLUSIVE`) and message/finding/check counts, plus a trace-wide group for start-up telegrams and global checks. Selecting one scopes all three views.
- **📡 Trace-Data View**: Visualizes timestamp, message ID, sender → receiver, message type, code, protocol, length, status (`OK`, `FAILED`, `WARNING`) and highlighted error reasons. Click a message for the detailed view with decoded telegram fields and related findings.
- **🚨 Failure-Analysis View**: Card-based root-cause findings with category, confidence, diagnostic description and evidence sources. Length findings show the expected vs. actual comparison:
  ```text
  Message frame-380-2
  Expected Length: 48 bytes
  Actual Length:   47 bytes
  Result:          Message Length Error
  ```
- **⚖️ Data-Structure Comparison View**: Field-by-field verification table with error and warning highlighting:
  | Field | Expected | Actual | Result |
  | :--- | :--- | :--- | :--- |
  | `Test verdict` | PASSED | FAILED | **Error** |
  | `Length MELDUNG_GFMA_BELEGUNGSZUSTAND` | 48 | 47 | **Error** |
  | `RaSTA message gap` | <= 750 ms | max 306 ms | **OK** |
- **Search & Filter**: Free-text search across messages, decoded fields, findings and comparisons; filter by status (`FAILED`/`Error`, `WARNING`, `OK`).
- **Sorting**: Toggle sorting of trace messages by time or status severity.
- **Backend Error Reporting**: If the backend rejects the analysis report (e.g. missing fields, wrong data types, unexpected content), the GUI shows the error and each validation error instead of stale or fake data. An unreachable tecWatch server is shown in the status widget.
- **⚡ Animated API Loading Screen**:
  - Global `LoadingInterceptor` automatically detects every in-flight API call.
  - Renders a pulse spinner in a light modal, a top progress bar, and the active endpoint badge (e.g. `GET /api/analysis` or `GET /api/status`).
- **🎨 Light Operator Theme**: White cards on a warm-grey page; status colours with a reserved meaning (good / warning / serious / critical) always paired with a label or dot; text colours meet WCAG AA contrast; data sources use a colour-blind-safe categorical palette in a fixed order.
- **Direct Backend Integration**: Connects to the tecWatch API Gateway running at `http://localhost:8000/api`.

---

## 🏗️ Project Architecture (Module-Based)

```text
DBLTAS_GUI/
├── src/
│   ├── app/
│   │   ├── app-module.ts             # Root NgModule registering declarations and providers
│   │   ├── app-routing-module.ts     # Route mapping (Default -> DashboardComponent)
│   │   ├── app.ts                    # Root component definition
│   │   ├── app.html                  # Root template (<router-outlet>)
│   │   ├── components/
│   │   │   ├── status-header/        # Brand, navigation and tecWatch operator status bar (GET /api/status)
│   │   │   ├── dashboard/            # Interactive Trace Analysis Dashboard (GET /api/analysis)
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── dashboard.component.html
│   │   │   │   └── dashboard.component.css
│   │   │   ├── analysis-view/        # Summary-first analysis view (summary, findings, timeline, GFM-A states), used by findings and upload
│   │   │   ├── findings/             # Analysis Findings page (GET /api/analysis/scenarios)
│   │   │   ├── upload/               # Upload & Analyze page (POST /api/analysis/upload)
│   │   │   └── loading/              # Global API loading overlay
│   │   ├── models/
│   │   │   ├── trace-analysis.ts     # Analysis report and tecWatch status interfaces
│   │   │   └── analysis-scenarios.ts # Analysis scenarios (findings) interfaces
│   │   ├── pipes/
│   │   │   └── filter-status.pipe.ts # Status count & filter pipe (test cases, messages)
│   │   └── services/
│   │       ├── tecwatch-api.service.ts # HTTP service calling backend API (GET /api/status, /api/analysis, /api/analysis/scenarios, POST /api/analysis/upload)
│   │       └── upload-state.service.ts # Keeps the last upload result while switching views
│   ├── testing/                      # Shared test data for the specs (excluded from the app build)
│   ├── styles.css                    # Light design system: colour tokens (surfaces, ink, status, categorical) and shared components
│   └── index.html                    # HTML shell loading Google Fonts (Outfit & JetBrains Mono)
├── angular.json
├── package.json
└── tsconfig.json
```

---

## 🚀 Running the Web GUI

### 1. Prerequisites
Ensure the backend API is running:
```bash
# In the backend directory
cd /Users/fuad/tecwatch_api/backend
source .venv/bin/activate
TECWATCH_SERVER_HOST=127.0.0.1 python -m src.main
```
*(Backend Gateway will be active on `http://localhost:8000`)*

### 2. Start the Angular Dev Server

```bash
cd /Users/fuad/tecwatch_api/DBLTAS_GUI
export PATH="/Users/fuad/.nvm/versions/node/v22.23.2/bin:$PATH"
npm start
```

Open your browser and navigate to:
👉 **[http://localhost:4200](http://localhost:4200)**

---

## 🧪 Test Scenarios

The data shown comes from the analysis report file configured in the backend (`analysis.report_path`, default `backend/data/data-analysis-report.json`). The backend reads it on every request, so:
1. **New report**: Replace the report file and reload the page — the GUI shows the new analysis.
2. **Invalid report**: Break the report (e.g. set a `length` to `"47"` or add an unknown field) and reload — the GUI lists the backend's validation errors.
3. **tecWatch offline**: Stop the tecWatch (mock) server and reload — the status bar shows the gateway error while the analysis stays available.
4. **Analysis findings**: Click **🔎 Analysis Findings** in the header. The summary explains why TC3, TC4 and TC5 did not pass; click a finding chip (e.g. *S01*) to open it, use *Show on timeline*, and inspect the GFM-A state chart. The findings come from `backend/data/analysis-scenarios.json`, generated from the analysis workbook with `backend/scripts/extract_analysis_scenarios.py`.
5. **Upload & analyze**: Click **⬆ Upload & Analyze**, drop `RealOCWorking_TDS_21026.pcapng` and `Real_SCI-TDS_2026-10-02_12-24-11.pdf` (from `TDS_Task/TDS_Task/`) and select *Analyze files* (about 3 s, mostly reading the PDF). Try the capture alone, or a PDF in the capture field, to see the trace-only summary and the file checks.

Unit tests: `npx ng test --watch=false`

---


