# DBLTAS Web GUI – tecWatch Interactive Trace Analysis

An interactive Web GUI built with **Angular (Module-Based Architecture / `NgModule`)** for viewing, inspecting, and analyzing communication and trace-analysis results from **tecWatch** systems.

---

## 🌟 Key Features

- **Interactive Trace Dashboard**: Real-time overview of monitored capture runs, pass/fail status, and live telemetry from the tecWatch hardware (battery %, temperature °C, uptime).
- **📡 Trace-Data View**: Visualizes timestamp, sender, receiver, communication protocol (CAN, TCP, Modbus), message type, status, and highlighted error reasons.
- **🚨 Failure-Analysis View**: Card-based diagnostic inspection of packet failures, prominently highlighting expected vs. actual packet lengths:
  ```text
  Message 127
  Expected Length: 64
  Actual Length:   60
  Result:          Message Length Error
  ```
- **⚖️ Data-Structure Comparison View**: Field-by-field verification table with visual error highlighting:
  | Field | Expected | Actual | Result |
  | :--- | :--- | :--- | :--- |
  | `MessageID` | 1001 | 1001 | **OK** |
  | `Length` | 64 | 60 | **Error** |
  | `Status` | READY | READY | **OK** |
- **Search & Multi-Filter Engine**: Filter traces by status (`FAILED`, `PASSED`), protocol (`CAN`, `TCP`, `MODBUS`), or free-text search across messages.
- **Sorting**: Toggle sorting by timestamp or status.
- **⚡ Animated API Loading Screen**:
  - Global `LoadingInterceptor` automatically detects every in-flight API call.
  - Renders a glowing neon radar pulse ring with glassmorphic modal, streaming top progress bar, and active endpoint badge (e.g. `POST /api/analysis` or `GET /api/status`).
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
│   │   │   └── trace-analysis.ts     # TypeScript interfaces (TraceMessage, FailureFinding, DataComparison)
│   │   ├── pipes/
│   │   │   └── filter-status.pipe.ts # Status count & filter pipe
│   │   └── services/
│   │       └── tecwatch-api.service.ts # HTTP service calling backend API (/api/status, /api/analysis)
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

## 🧪 Interactive Demo & Test Scenarios

The GUI includes a quick scenario injector bar at the top:
1. **🚨 CAN Length Error (Msg 127)**: Sends and renders a CAN bus frame error with expected length 64 vs actual 60.
2. **✅ Ethernet Clean Pass**: Injects a nominal TCP socket session with zero failure findings.
3. **⚠️ Modbus Overflow Error**: Injects a register boundary overflow scenario.

---

## 📋 Completion Criteria Verification

- [x] Inspect an analysis result from the list.
- [x] Identify failed messages clearly in the **Failure-Analysis View**.
- [x] See the specific reason for failure (e.g. Message Length Error).
- [x] Compare expected vs. actual data in the **Data-Comparison View**.
