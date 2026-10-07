export interface TecWatchStatus {
  device_id: string;
  status: string;
  battery_level: number;
  uptime_seconds: number;
  temperature: number;
  timestamp: string;
  active_alerts: string[];
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
