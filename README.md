# DBLTAS Web GUI – tecWatch Interactive Trace Analysis

An interactive Web GUI built with **Angular (Module-Based Architecture / `NgModule`)** for viewing, inspecting, and analyzing communication and trace-analysis results from **tecWatch** systems.

---

## 🌟 Key Features

- **Read-Only Analysis Dashboard**: On initial load the GUI calls `GET /api/status` (live tecWatch telemetry: battery %, temperature °C, status) and `GET /api/analysis` (the validated analysis report). The GUI never posts analysis data.
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
  - Renders a glowing neon radar pulse ring with glassmorphic modal, streaming top progress bar, and active endpoint badge (e.g. `GET /api/analysis` or `GET /api/status`).
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
│   │   │   └── dashboard/            # Interactive Trace Analysis Dashboard
│   │   │       ├── dashboard.component.ts
│   │   │       ├── dashboard.component.html
│   │   │       └── dashboard.component.css
│   │   ├── models/
│   │   │   └── trace-analysis.ts     # TypeScript interfaces of the analysis report (TraceMessage, FailureFinding, DataComparison)
│   │   ├── pipes/
│   │   │   └── filter-status.pipe.ts # Status count & filter pipe (test cases, messages)
│   │   └── services/
│   │       └── tecwatch-api.service.ts # HTTP service calling backend API (GET /api/status, GET /api/analysis)
│   ├── styles.css                    # Dark-mode design system with glassmorphism tokens
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
3. **tecWatch offline**: Stop the tecWatch (mock) server and reload — the status widget shows the gateway error while the analysis stays available.

Unit tests: `npx ng test --watch=false`

---


