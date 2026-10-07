/** SCI-TDS interface between ESTW-ZE and the object controller, observed by tecWatch. */
export interface LinkStatus {
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  protocol: string;
  btp_version: string;
  version_check: string;
  local_endpoint: string;
  remote_endpoint: string;
  heartbeat_interval_ms: number;
  last_message_at: string;
}

/** GFM-A track section (Belegungszustand, Grundstellbarkeit). */
export interface TrackSectionStatus {
  section: string;
  section_type: string;
  occupancy: 'FREE' | 'OCCUPIED' | 'DISTURBED';
  resettable: boolean;
  axle_count: number;
  since: string;
}

export interface TestExecutionStatus {
  state: 'IDLE' | 'RUNNING' | 'STOPPED' | 'COMPLETED';
  test_unit: string;
  configuration: string;
  current_test_case: string | null;
  passed: number;
  failed: number;
  inconclusive: number;
}

/** Status returned by GET /api/status (proxied from tecWatch). */
export interface TecWatchStatus {
  device_id: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'DISCONNECTED' | 'FAULT';
  timestamp: string;
  link: LinkStatus;
  track_sections: TrackSectionStatus[];
  test_execution: TestExecutionStatus;
  active_alerts: string[];
  /** 'simulated' when the tecWatch server was not reachable and the backend returned its built-in status. */
  source?: 'tecwatch' | 'simulated';
}

export type FieldValue = string | number | boolean | null;

export interface TraceMessage {
  message_id: string;
  timestamp: string;
  time_s: number;
  sender: string;
  receiver: string;
  protocol: string;
  message_type: string;
  message_code: string;
  direction: string;
  length: number;
  fields: Record<string, FieldValue>;
  test_case: string | null;
  status: 'OK' | 'FAILED' | 'WARNING';
  error_reason: string | null;
}

export interface FailureFinding {
  message_id: string | null;
  expected_length: number | null;
  actual_length: number | null;
  result: string;
  test_case: string | null;
  timestamp: string;
  time_s: number;
  category: string;
  description: string;
  confidence: number;
  evidence: string[];
}

export interface DataComparison {
  field: string;
  expected: string;
  actual: string;
  result: 'OK' | 'Error' | 'Warning';
  test_case: string | null;
}

/** Analysis report returned by GET /api/analysis (format of data-analysis-report.json). */
export interface TraceAnalysis {
  analysis_id: string;
  device_id: string;
  timestamp: string;
  analysis_type: string;
  result_status: 'PASSED' | 'FAILED' | 'WARNING' | 'INCONCLUSIVE';
  summary: string;
  trace_messages: TraceMessage[];
  failure_findings: FailureFinding[];
  data_comparisons: DataComparison[];
}

export interface ApiValidationError {
  field: string;
  type: string;
  message: string;
}

/** Error envelope of the backend ({ error, detail, validation_errors }) or a connection problem. */
export interface ApiError {
  status: number;
  error: string;
  detail: string;
  validation_errors: ApiValidationError[];
}
