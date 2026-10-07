import { AnalysisScenarios, IoGraph, Scenario } from '../app/models/analysis-scenarios';

/** Test data shared by the specs of the analysis views. */
export const TC1 = 'TC_NPRO.295.02283.01';
export const TC3 = 'TC_NPRO.295.02288.01';

export function scenario(overrides: Partial<Scenario>): Scenario {
  return {
    id: 'S00',
    title: 'Finding',
    category: 'Test script logic',
    test_cases: [TC3],
    test_case_scope: '02288.01',
    applies_to_all_test_cases: false,
    data_sources: [{ type: 'pcap', label: 'pcap' }],
    severity: 'Medium',
    confidence: 'High',
    symptom: 'Report symptom',
    evidence: ['306.791 (frame 1222): AZGH while not grundstellbar'],
    root_cause: 'Root cause',
    potential_reasons: [],
    recommendation: 'Recommendation',
    method: 'Method',
    ...overrides
  };
}

/** Workbook-style analysis: 2 test cases (1 pass, 1 fail), 4 findings, BLF panel action on the timeline. */
export const SAMPLE_ANALYSIS: AnalysisScenarios = {
  source_file: 'SCI_TDS_Analysis_Scenarios_2026-10-02.xlsx',
  title: 'SCI-TDS Real-OC Test Run 2026-10-02 – Failure Analysis Scenarios',
  test_run: {
    name: 'Real_SCI-TDS_2026-10-02_12-24-11',
    overall_verdict: 'FAIL – 1 Pass, 1 Fail',
    sut: "Real object controller Az-System (GFM-A '34W1')",
    test_system: 'CANoe as ESTW-ZE',
    data_sources: 'PDF test report, pcapng, BLF',
    time_correlation: 'CANoe time = pcap frame.time_relative + 3.462272 s'
  },
  test_cases: [
    {
      number: 1, test_case_id: TC1, variant: 'O', title: 'AZGH discarded', verdict: 'Pass',
      window_start_s: 12.4, window_end_s: 91.55, failure_point: null, root_cause: 'Valid pass.', scenario_ids: ['S09']
    },
    {
      number: 3, test_case_id: TC3, variant: 'O', title: "AZGH makes GFM-A 'belegt & grundstellbar'", verdict: 'Fail',
      window_start_s: 139.51, window_end_s: 313.49, failure_point: 'Preparation', root_cause: 'Invalid axle count.',
      scenario_ids: ['S01', 'S06']
    }
  ],
  scenarios: [
    scenario({
      id: 'S01',
      title: "GFM-A became 'gestört' 102 ms after manual occupation",
      category: 'SUT state / physical stimulation',
      data_sources: [{ type: 'pdf', label: 'PDF' }, { type: 'pcap', label: 'pcap' }, { type: 'blf', label: 'BLF' }],
      severity: 'High',
      evidence: ['186.852 (frame 423): belegt, axle count 0x0000 (INVALID)', '186.954 (frame 425): gestört'],
      potential_reasons: ['Metal object placed on only one sensor system'],
      recommendation: 'Use a defined stimulation procedure or a wheel-sensor simulator.'
    }),
    scenario({ id: 'S06', title: 'Cleanup routine cannot succeed', data_sources: [{ type: 'pdf', label: 'PDF' }, { type: 'pcap', label: 'pcap' }] }),
    scenario({
      id: 'S09',
      title: 'Discarded commands are completely silent',
      category: 'Protocol / specification ambiguity',
      test_cases: [TC1],
      test_case_scope: '02283.01',
      data_sources: [{ type: 'pcap', label: 'pcap' }, { type: 'telegram_xlsx', label: 'telegram xlsx' }]
    }),
    scenario({
      id: 'S13',
      title: 'Communication layer ruled out',
      category: 'Network / protocol (negative finding)',
      test_cases: [],
      test_case_scope: 'All',
      applies_to_all_test_cases: true,
      severity: 'Info'
    })
  ],
  timeline: [
    {
      canoe_time_s: 3.463, wall_clock: '12:24:03.416', pcap_frame: 8, source: 'pcap', direction: 'ZE -> OC',
      event: 'RaSTA Connection Request', phase: 'Pre-test (manual panel connect)', test_case_id: null, comment: null, scenario_ids: []
    },
    {
      canoe_time_s: 77.548, wall_clock: '12:25:17.502', pcap_frame: 219, source: 'pcap', direction: 'ZE -> OC',
      event: 'Kommando AZGH(0x0003)', phase: 'TC1 02283.01', test_case_id: TC1, comment: 'discarded, no 0x0006 – S09', scenario_ids: ['S09']
    },
    {
      canoe_time_s: 186.851, wall_clock: '12:27:06.804', pcap_frame: 423, source: 'pcap', direction: 'OC -> ZE',
      event: 'Meldung GFM-A Belegungszustand(0x0007) [belegt, nicht grundst.]', phase: 'TC3 02288.01', test_case_id: TC3,
      comment: 'axle count 0x0000 (invalid) – S01', scenario_ids: ['S01']
    },
    {
      canoe_time_s: 300.288, wall_clock: '12:29:00.241', pcap_frame: null, source: 'pdf', direction: null,
      event: 'TC3 preparation FAIL (120 s timeout)', phase: 'TC3 02288.01', test_case_id: TC3, comment: 'S01', scenario_ids: ['S01']
    },
    {
      canoe_time_s: 306.788, wall_clock: '12:29:06.741', pcap_frame: null, source: 'pdf', direction: null,
      event: 'TC3 cleanup: AZGH sent', phase: 'TC3 02288.01', test_case_id: TC3, comment: 'S06', scenario_ids: ['S06']
    },
    {
      canoe_time_s: 306.79, wall_clock: '12:29:06.743', pcap_frame: 1222, source: 'pcap', direction: 'ZE -> OC',
      event: 'Kommando AZGH(0x0003)', phase: 'TC3 02288.01', test_case_id: TC3, comment: 'cleanup AZGH – S06', scenario_ids: ['S06']
    },
    {
      canoe_time_s: 310.5, wall_clock: '12:29:10.453', pcap_frame: null, source: 'blf', direction: null,
      event: 'Panel kdSelection=3 (AZGH) – manual panel command', phase: 'TC3 02288.01', test_case_id: TC3, comment: null, scenario_ids: []
    }
  ],
  gfma_state_history: {
    section: '34W1',
    coding_note: 'Coding per SCI-TDS Baseline 5 (real OC)',
    states: [
      {
        canoe_time_s: 180.288, pcap_frame: 380, occupancy_code: 1, occupancy: 'frei', resettable_code: 0, resettable: 'nicht grundst.',
        axle_count: '0x0000', duration_note: null, phase: 'TC3 02288.01', test_case_id: TC3, remark: 'Aufrüst status',
        until_s: 186.852, duration_s: 6.564
      },
      {
        canoe_time_s: 186.852, pcap_frame: 423, occupancy_code: 2, occupancy: 'belegt', resettable_code: 0, resettable: 'nicht grundst.',
        axle_count: '0x0000', duration_note: null, phase: 'TC3 02288.01', test_case_id: TC3, remark: 'occupation WITHOUT valid axle count',
        until_s: 186.954, duration_s: 0.102
      },
      {
        canoe_time_s: 186.954, pcap_frame: 425, occupancy_code: 3, occupancy: 'gestört', resettable_code: 0, resettable: 'nicht grundst.',
        axle_count: '0x0000', duration_note: 'until end (313.5)', phase: 'TC3 02288.01', test_case_id: TC3, remark: 'disturbed after 102 ms',
        until_s: 313.5, duration_s: 126.546
      }
    ]
  },
  method: {
    steps: [
      { step: 1, activity: 'Understand the expectation', details: 'Read the test-spec extracts.' },
      { step: 2, activity: 'Decode the pcapng', details: 'tshark -X lua_script:loader.lua -r RealOCWorking_TDS_21026.pcapng' }
    ],
    open_questions: [
      { id: 'Q1', question: "Is 'Meldung Kommando abgewiesen' (0x0006) expected? (S09)", scenario_ids: ['S09'] }
    ]
  }
};

/** 10 s of SCI-TDS traffic between ESTW-ZE and OC, starting 2026-10-02 12:24:00 (+02:00) = CANoe time 3.5 s. */
export const SAMPLE_IO_GRAPH: IoGraph = {
  capture_file: 'RealOCWorking_TDS_21026.pcapng',
  start_epoch_s: 1790936640,
  interval_s: 1,
  utc_offset_min: 120,
  canoe_zero_epoch_s: 1790936636.5,
  total_packets: 74,
  all_packets: [4, 6, 7, 6, 6, 7, 6, 20, 6, 6],
  other_hosts: 0,
  hosts: [
    {
      address: '1.208.188.16',
      role: 'ESTW-ZE (CANoe)',
      packets_sent: 38,
      packets_received: 36,
      sent: [2, 3, 4, 3, 3, 4, 3, 10, 3, 3],
      received: [2, 3, 3, 3, 3, 3, 3, 10, 3, 3]
    },
    {
      address: '10.129.15.2',
      role: 'Object controller',
      packets_sent: 36,
      packets_received: 38,
      sent: [2, 3, 3, 3, 3, 3, 3, 10, 3, 3],
      received: [2, 3, 4, 3, 3, 4, 3, 10, 3, 3]
    }
  ]
};
