export type Severity = 'High' | 'Medium' | 'Low' | 'Info';
export type Verdict = 'Pass' | 'Fail' | 'Inconclusive' | 'Error' | 'None';
export type Confidence = 'High' | 'Medium' | 'Low';
export type SourceType = 'pdf' | 'pcap' | 'blf' | 'write_log' | 'test_spec' | 'telegram_xlsx' | 'lua_dissector';

export interface TestRunInfo {
  name: string;
  overall_verdict: string;
  sut: string;
  test_system: string;
  data_sources: string;
  time_correlation: string;
}

export interface ScenarioTestCase {
  number: number;
  test_case_id: string;
  variant: string | null;
  title: string | null;
  verdict: Verdict;
  window_start_s: number;
  window_end_s: number;
  failure_point: string | null;
  root_cause: string;
  scenario_ids: string[];
}

export interface ScenarioDataSource {
  type: SourceType;
  label: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: string;
  test_cases: string[];
  test_case_scope: string | null;
  applies_to_all_test_cases: boolean;
  data_sources: ScenarioDataSource[];
  severity: Severity;
  confidence: Confidence;
  symptom: string;
  evidence: string[];
  root_cause: string;
  potential_reasons: string[];
  recommendation: string;
  method: string;
}

export interface TimelineEvent {
  canoe_time_s: number;
  wall_clock: string | null;
  pcap_frame: number | null;
  source: SourceType;
  direction: string | null;
  event: string;
  phase: string;
  test_case_id: string | null;
  comment: string | null;
  scenario_ids: string[];
}

export interface SectionState {
  canoe_time_s: number;
  pcap_frame: number | null;
  occupancy_code: number;
  occupancy: string;
  resettable_code: number;
  resettable: string;
  axle_count: string;
  duration_note: string | null;
  phase: string;
  test_case_id: string | null;
  remark: string | null;
  until_s: number;
  duration_s: number;
}

export interface MethodStep {
  step: number;
  activity: string;
  details: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  scenario_ids: string[];
}

/** IP address of the capture with the number of packets it sent (ip.src) and received (ip.dst). */
export interface IoGraphHost {
  address: string;
  role: string | null;
  packets_sent: number;
  packets_received: number;
}

/** Time and IP addresses of every packet of an uploaded capture, for the Wireshark-like I/O graph. */
export interface IoGraph {
  capture_file: string;
  /** Time of the first packet (Unix time, UTC). */
  start_epoch_s: number;
  duration_s: number;
  /** UTC offset of the test bench from the test report; null if unknown. */
  utc_offset_min: number | null;
  /** Unix time of CANoe measurement time 0; null if the capture cannot be aligned. */
  canoe_zero_epoch_s: number | null;
  total_packets: number;
  /** Time of every packet after the first one [µs], in time order. */
  packet_time_us: number[];
  /** Index in hosts of each packet's source / destination address (-1: not IP or not listed). */
  packet_src: number[];
  packet_dst: number[];
  /** Addresses with fewer packets that are not listed in hosts. */
  other_hosts: number;
  hosts: IoGraphHost[];
}

/**
 * Failure-analysis scenarios: returned by GET /api/analysis/scenarios (extracted from the analysis workbook)
 * and by POST /api/analysis/upload (analysis of an uploaded capture and/or CANoe test report).
 */
export interface AnalysisScenarios {
  source_file: string;
  title: string;
  test_run: TestRunInfo;
  test_cases: ScenarioTestCase[];
  scenarios: Scenario[];
  timeline: TimelineEvent[];
  gfma_state_history: {
    section: string;
    coding_note: string | null;
    states: SectionState[];
  };
  method: {
    steps: MethodStep[];
    open_questions: OpenQuestion[];
  };
  /** Only in upload results that include a capture. */
  io_graph?: IoGraph | null;
}
