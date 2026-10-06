export interface TecWatchStatus {
  device_id: string;
  status: string;
  battery_level: number;
  uptime_seconds: number;
  temperature: number;
  timestamp: string;
  active_alerts: string[];
}

export interface TraceMessage {
  timestamp: string;
  sender: string;
  receiver: string;
  protocol: string;
  message_type: string;
  status: string;
  error_reason?: string | null;
}

export interface FailureFinding {
  message_id: string;
  expected_length: number;
  actual_length: number;
  result: string;
}

export interface DataComparison {
  field: string;
  expected: string;
  actual: string;
  result: string;
}

export interface TraceAnalysis {
  analysis_id: string;
  device_id: string;
  timestamp: string;
  analysis_type: string;
  result_status: string;
  summary: string;
  trace_messages: TraceMessage[];
  failure_findings: FailureFinding[];
  data_comparisons: DataComparison[];
}
