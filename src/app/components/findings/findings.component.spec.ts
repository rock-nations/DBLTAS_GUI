import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AppModule } from '../../app-module';
import { FindingsComponent } from './findings.component';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError } from '../../models/trace-analysis';
import { AnalysisScenarios, Scenario } from '../../models/analysis-scenarios';

describe('FindingsComponent', () => {
  let component: FindingsComponent;
  let fixture: ComponentFixture<FindingsComponent>;
  let compiled: HTMLElement;
  let scenarioCalls: number;

  const TC1 = 'TC_NPRO.295.02283.01';
  const TC3 = 'TC_NPRO.295.02288.01';

  function scenario(overrides: Partial<Scenario>): Scenario {
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

  const sample: AnalysisScenarios = {
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

  async function setup(getAnalysisScenarios: () => Observable<AnalysisScenarios> = () => of(structuredClone(sample))): Promise<void> {
    scenarioCalls = 0;
    const mockApiService = {
      baseUrl: 'http://localhost:8000/api',
      getAnalysisScenarios: () => {
        scenarioCalls++;
        return getAnalysisScenarios();
      }
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [{ provide: TecWatchApiService, useValue: mockApiService }]
    }).compileComponents();

    fixture = TestBed.createComponent(FindingsComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function click(selector: string, text?: string): void {
    const element = Array.from(compiled.querySelectorAll<HTMLElement>(selector))
      .find(el => text === undefined || el.textContent?.includes(text));
    if (!element) {
      throw new Error(`No element ${selector} ${text ?? ''}`);
    }
    element.click();
    fixture.detectChanges();
  }

  it('should load the analysis scenarios and show the test run overview', async () => {
    await setup();

    expect(scenarioCalls).toBe(1);
    expect(compiled.querySelector('#findings-title')?.textContent).toContain('Failure Analysis Scenarios');
    const overview = compiled.querySelector('.run-overview')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(overview).toContain('Overall FAIL');
    expect(overview).toContain('1 pass · 1 fail · 0 inconclusive');
    expect(overview).toContain('CANoe time = pcap frame.time_relative');
  });

  it('should count findings per severity and open the first high-severity finding', async () => {
    await setup();

    expect(compiled.querySelector('#severity-high .metric-val')?.textContent?.trim()).toBe('1');
    expect(compiled.querySelector('#severity-medium .metric-hint')?.textContent?.trim()).toBe('S06 S09');
    expect(component.selectedScenario?.id).toBe('S01');
    const detail = compiled.querySelector('.scenario-detail')?.textContent ?? '';
    expect(compiled.querySelector('#scenario-title')?.textContent).toContain("102 ms after manual occupation");
    expect(detail).toContain('186.852 (frame 423): belegt, axle count 0x0000 (INVALID)');
    expect(detail).toContain('Use a defined stimulation procedure');
    expect(detail).toContain('Metal object placed on only one sensor system');
    expect(compiled.querySelectorAll('.scenario-detail .mini-timeline li').length).toBe(2);
  });

  it('should filter findings by severity, search text, test case and data source', async () => {
    await setup();

    click('#severity-medium');
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S06', 'S09']);
    expect(component.selectedScenario?.id).toBe('S06');

    component.clearFilters();
    component.searchTerm = 'silent';
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S09']);

    component.clearFilters();
    component.testCaseFilter = TC1;
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S09', 'S13']);

    component.clearFilters();
    component.sourceFilter = 'telegram_xlsx';
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S09']);
  });

  it('should step through findings with previous and next', async () => {
    await setup();

    expect(component.canStep(-1)).toBe(false);
    click('.step-btn', 'Next');
    expect(component.selectedScenario?.id).toBe('S06');
    click('.step-btn', 'Previous');
    expect(component.selectedScenario?.id).toBe('S01');
  });

  it('should open a finding from the test case verdicts', async () => {
    await setup();

    click('#tab-testcases');
    expect(compiled.querySelectorAll('.testcase-card').length).toBe(2);
    click('.testcase-card .chip-link', 'S06');
    expect(component.activeTab).toBe('scenarios');
    expect(component.selectedScenario?.id).toBe('S06');
  });

  it('should show a finding on the correlated timeline with its events highlighted', async () => {
    await setup();

    click('.link-btn', 'Show on correlated timeline');
    expect(component.activeTab).toBe('timeline');
    expect(component.timelineTestCase).toBe(TC3);
    expect(compiled.querySelectorAll('.timeline-table tbody tr').length).toBe(5);
    expect(compiled.querySelectorAll('.timeline-table tr.row-highlight').length).toBe(2);

    component.timelineLinkedOnly = true;
    component.timelineTestCase = 'ALL';
    expect(component.filteredTimeline.length).toBe(5);
  });

  it('should chart the GFM-A states including the 102 ms occupation', async () => {
    await setup();

    click('#tab-states');
    expect(component.chart?.occupancy.length).toBe(3);
    expect(compiled.querySelectorAll('.chart-track .segment.short').length).toBe(1);
    expect(compiled.querySelectorAll('.marker.cmd-wire').length).toBe(2);
    expect(compiled.querySelectorAll('.marker.cmd-panel').length).toBe(1);
    expect(compiled.querySelectorAll('tbody tr.row-error').length).toBe(1);
  });

  it('should show which data sources each finding correlates', async () => {
    await setup();

    click('#tab-sources');
    expect(component.sourceTypes).toEqual(['pdf', 'pcap', 'blf', 'telegram_xlsx']);
    expect(component.sourceCount('pcap')).toBe(4);
    expect(compiled.querySelectorAll('.matrix-table tbody tr').length).toBe(4);
  });

  it('should list the analysis method and keep the open questions hidden', async () => {
    await setup();

    component.selectScenario('S09');
    fixture.detectChanges();
    expect(compiled.querySelector('.scenario-detail')?.textContent).not.toContain('Open questions');

    click('#tab-method');
    expect(compiled.querySelector('#tab-method')?.textContent).toContain('Analysis Method (2)');
    expect(compiled.querySelectorAll('.method-steps li').length).toBe(2);
    expect(compiled.querySelector('.question-list')).toBeNull();
  });

  it('should show backend validation errors when the scenarios are invalid', async () => {
    const invalid: ApiError = {
      status: 500,
      error: 'Invalid Analysis Scenarios',
      detail: 'Analysis scenarios failed validation (check mandatory fields, data types, message length, or unexpected content).',
      validation_errors: [{ field: 'scenarios -> 0 -> severity', type: 'literal_error', message: "Input should be 'High', 'Medium', 'Low' or 'Info'" }]
    };
    await setup(() => throwError(() => invalid));

    expect(component.data).toBeNull();
    const errorPanel = compiled.querySelector('#findings-error')?.textContent ?? '';
    expect(errorPanel).toContain('Invalid Analysis Scenarios');
    expect(errorPanel).toContain('scenarios -> 0 -> severity');
    expect(compiled.querySelector('.severity-grid')).toBeNull();
  });
});
