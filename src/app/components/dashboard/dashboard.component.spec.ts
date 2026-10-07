import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AppModule } from '../../app-module';
import { DashboardComponent, TRACE_WIDE } from './dashboard.component';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError, TraceAnalysis, TecWatchStatus } from '../../models/trace-analysis';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let compiled: HTMLElement;
  let statusCalls: number;
  let analysisCalls: number;

  const sampleReport: TraceAnalysis = {
    analysis_id: 'TRACE-RUN-20261002-102359',
    device_id: 'DETHMM AZA34##0001',
    timestamp: '2026-10-02T10:23:59.953Z',
    analysis_type: 'TRACE_COMMUNICATION',
    result_status: 'FAILED',
    summary: '1 of 3 test cases failed.',
    trace_messages: [
      {
        message_id: 'frame-11-1',
        timestamp: '2026-10-02T10:24:03.601Z',
        time_s: 3.648055,
        sender: 'DETHMM ZE 35##0001',
        receiver: 'DETHMM AZA34##0001',
        protocol: 'SCI-TDS BL5 over RaSTA',
        message_type: 'KOMMANDO_BTP_VERSIONSABGLEICH',
        message_code: '0x0024',
        direction: 'ZE→AZ',
        length: 44,
        fields: { btp_version: 1 },
        test_case: null,
        status: 'OK',
        error_reason: null
      },
      {
        message_id: 'frame-56-2',
        timestamp: '2026-10-02T10:24:53.086Z',
        time_s: 53.132877,
        sender: '34W1',
        receiver: 'DETHMM ZE 35##0001',
        protocol: 'SCI-TDS BL5 over RaSTA',
        message_type: 'MELDUNG_GFMA_BELEGUNGSZUSTAND',
        message_code: '0x0007',
        direction: 'AZ→ZE',
        length: 47,
        fields: { belegung: 1, grundstellbar: 0 },
        test_case: 'TC_NPRO.295.02283.01',
        status: 'OK',
        error_reason: null
      },
      {
        message_id: 'frame-1458-1',
        timestamp: '2026-10-02T10:30:21.566Z',
        time_s: 381.612761,
        sender: 'DETHMM ZE 35##0001',
        receiver: '34W1',
        protocol: 'SCI-TDS BL5 over RaSTA',
        message_type: 'KOMMANDO_AZGH',
        message_code: '0x0003',
        direction: 'ZE→AZ',
        length: 43,
        fields: {},
        test_case: 'TC_NPRO.295.02288.01',
        status: 'WARNING',
        error_reason: 'Manual Intervention'
      },
      {
        message_id: 'frame-380-2',
        timestamp: '2026-10-02T10:27:00.241Z',
        time_s: 180.287372,
        sender: '34W1',
        receiver: 'DETHMM ZE 35##0001',
        protocol: 'SCI-TDS BL5 over RaSTA',
        message_type: 'MELDUNG_GFMA_BELEGUNGSZUSTAND',
        message_code: '0x0007',
        direction: 'AZ→ZE',
        length: 47,
        fields: { belegung: 1, grundstellbar: 0, achszaehlfuellstand: 0 },
        test_case: 'TC_NPRO.295.02288.01',
        status: 'FAILED',
        error_reason: 'Message Length Error'
      }
    ],
    failure_findings: [
      {
        message_id: 'frame-380-2',
        expected_length: 48,
        actual_length: 47,
        result: 'Message Length Error',
        test_case: 'TC_NPRO.295.02288.01',
        timestamp: '2026-10-02T10:27:00.241Z',
        time_s: 180.287372,
        category: 'incorrect_length',
        description: 'Test_Description step 2 expects a 48-byte telegram, the device sends 47 bytes',
        confidence: 0.9,
        evidence: ['RealOCWorking_TDS_21026.pcapng frame 380 telegram 2']
      },
      {
        message_id: null,
        expected_length: null,
        actual_length: null,
        result: 'Test Aborted',
        test_case: 'TC_NPRO.295.00522.01',
        timestamp: '2026-10-02T10:32:08.274Z',
        time_s: 488.321,
        category: 'test_aborted',
        description: 'Test execution stopped: test unit stopped by the user',
        confidence: 1.0,
        evidence: []
      }
    ],
    data_comparisons: [
      { field: 'Test verdict', expected: 'PASSED', actual: 'PASSED', result: 'OK', test_case: 'TC_NPRO.295.02283.01' },
      { field: 'Test verdict', expected: 'PASSED', actual: 'FAILED', result: 'Error', test_case: 'TC_NPRO.295.02288.01' },
      { field: 'Test verdict', expected: 'PASSED', actual: 'INCONCLUSIVE', result: 'Warning', test_case: 'TC_NPRO.295.00522.01' },
      { field: 'RaSTA message gap', expected: '<= 750 ms', actual: 'max 306 ms', result: 'OK', test_case: null }
    ]
  };

  const sampleStatus: TecWatchStatus = {
    device_id: 'TW-01',
    status: 'OPERATIONAL',
    battery_level: 95.0,
    uptime_seconds: 50000,
    temperature: 28.0,
    timestamp: new Date().toISOString(),
    active_alerts: []
  };

  const invalidReportError: ApiError = {
    status: 500,
    error: 'Invalid Analysis Report',
    detail: 'Analysis report failed validation (check mandatory fields, data types, message length, or unexpected content).',
    validation_errors: [
      {
        field: 'trace_messages -> 1 -> length',
        type: 'int_type',
        message: "Invalid data type for field 'trace_messages -> 1 -> length': Input should be a valid integer"
      }
    ]
  };

  async function setup(overrides: {
    getStatus?: () => Observable<TecWatchStatus>;
    getAnalysis?: () => Observable<TraceAnalysis>;
  } = {}): Promise<void> {
    statusCalls = 0;
    analysisCalls = 0;
    const mockApiService = {
      baseUrl: 'http://localhost:8000/api',
      getStatus: () => {
        statusCalls++;
        return overrides.getStatus ? overrides.getStatus() : of(sampleStatus);
      },
      getAnalysis: () => {
        analysisCalls++;
        return overrides.getAnalysis ? overrides.getAnalysis() : of(structuredClone(sampleReport));
      }
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: TecWatchApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function render(): void {
    fixture.detectChanges();
  }

  it('should load tecWatch status and the analysis report on initial load', async () => {
    await setup();

    expect(statusCalls).toBe(1);
    expect(analysisCalls).toBe(1);
    expect(component.tecWatchStatus?.device_id).toBe('TW-01');
    expect(component.report?.analysis_id).toBe('TRACE-RUN-20261002-102359');
    expect(compiled.querySelector('.run-title')?.textContent).toContain('TRACE-RUN-20261002-102359');
  });

  it('should not offer any way to post analysis data', async () => {
    await setup();

    for (const id of ['btn-scenario-can', 'btn-scenario-eth', 'btn-scenario-mod', 'btn-reset-history']) {
      expect(compiled.querySelector(`#${id}`)).toBeNull();
    }
    const buttonTexts = Array.from(compiled.querySelectorAll('button')).map(b => b.textContent ?? '');
    for (const label of ['CAN Length Error', 'Ethernet Clean Pass', 'Modbus Overflow Error', 'Reset History']) {
      expect(buttonTexts.some(text => text.includes(label))).toBe(false);
    }
    expect('submitAnalysis' in TecWatchApiService.prototype).toBe(false);
    expect('resetAnalyses' in TecWatchApiService.prototype).toBe(false);
  });

  it('should derive test cases and their verdicts from the report', async () => {
    await setup();

    expect(component.testCases.map(tc => [tc.id, tc.status])).toEqual([
      ['TC_NPRO.295.02283.01', 'PASSED'],
      ['TC_NPRO.295.02288.01', 'FAILED'],
      ['TC_NPRO.295.00522.01', 'INCONCLUSIVE']
    ]);
    expect(compiled.querySelector('#kpi-failed')?.textContent?.trim()).toBe('1');
    expect(compiled.querySelector('#kpi-passed')?.textContent?.trim()).toBe('1');
    expect(compiled.querySelectorAll('.test-case-item').length).toBe(3);
    expect(compiled.querySelector('#tc-trace-wide')).toBeTruthy();
  });

  it('should filter trace, failure and comparison views by the selected test case', async () => {
    await setup();

    component.selectTestCase('TC_NPRO.295.02288.01');
    render();
    expect(component.filteredMessages.map(m => m.message_id)).toEqual(['frame-380-2', 'frame-1458-1']);
    expect(component.filteredFindings.length).toBe(1);
    expect(component.filteredComparisons.length).toBe(1);
    expect(compiled.querySelector('#scope-label')?.textContent).toContain('TC_NPRO.295.02288.01');

    component.selectTestCase(TRACE_WIDE);
    render();
    expect(component.filteredMessages.map(m => m.message_id)).toEqual(['frame-11-1']);
    expect(component.filteredFindings.length).toBe(0);
    expect(component.filteredComparisons.map(c => c.field)).toEqual(['RaSTA message gap']);
  });

  it('should filter by status, search text and sort messages', async () => {
    await setup();

    component.selectedStatus = 'WARNING';
    expect(component.filteredMessages.map(m => m.message_id)).toEqual(['frame-1458-1']);
    expect(component.filteredComparisons.map(c => c.actual)).toEqual(['INCONCLUSIVE']);
    expect(component.filteredFindings.length).toBe(0);

    component.selectedStatus = 'ALL';
    component.searchTerm = 'achszaehlfuellstand';
    expect(component.filteredMessages.map(m => m.message_id)).toEqual(['frame-380-2']);

    component.searchTerm = '';
    component.setSort('status');
    expect(component.filteredMessages.map(m => m.status)).toEqual(['FAILED', 'WARNING', 'OK', 'OK']);
  });

  it('should show failure findings with expected vs actual length when available', async () => {
    await setup();

    component.activeTab = 'failures';
    render();
    const cards = compiled.querySelectorAll('.failure-card');
    expect(cards.length).toBe(2);
    const lengthBoxes = compiled.querySelectorAll('.length-diff-box');
    expect(lengthBoxes.length).toBe(1);
    expect(lengthBoxes[0].textContent).toContain('48 bytes');
    expect(lengthBoxes[0].textContent).toContain('47 bytes');
    expect(cards[0].textContent).toContain('Message frame-380-2');
    expect(cards[0].textContent).toContain('the device sends 47 bytes');
    expect(cards[1].textContent).toContain('Test-level finding');
  });

  it('should highlight warning results in the data comparison view', async () => {
    await setup();

    component.activeTab = 'comparison';
    render();
    const badges = Array.from(compiled.querySelectorAll('.comparison-table .badge'));
    expect(badges.find(b => b.textContent?.trim() === 'Warning')?.classList).toContain('badge-warning');
    expect(badges.find(b => b.textContent?.trim() === 'Error')?.classList).toContain('badge-failed');
    expect(compiled.querySelectorAll('.comparison-table tr.row-warning').length).toBe(1);
  });

  it('should expand a trace message to show decoded fields and related findings', async () => {
    await setup();

    const row = Array.from(compiled.querySelectorAll<HTMLElement>('tr.message-row'))
      .find(r => r.textContent?.includes('frame-380-2'));
    row?.click();
    render();

    const chips = Array.from(compiled.querySelectorAll('.field-chip')).map(c => c.textContent?.replace(/\s+/g, ' ').trim());
    expect(chips).toEqual(['belegung = 1', 'grundstellbar = 0', 'achszaehlfuellstand = 0']);
    expect(compiled.querySelector('.detail-finding')?.textContent).toContain('Message Length Error');
  });

  it('should show backend validation errors when the analysis report is invalid', async () => {
    await setup({ getAnalysis: () => throwError(() => invalidReportError) });

    expect(component.report).toBeNull();
    const errorPanel = compiled.querySelector('#analysis-error');
    expect(errorPanel?.textContent).toContain('Invalid Analysis Report');
    expect(errorPanel?.textContent).toContain('trace_messages -> 1 -> length');
    expect(compiled.querySelector('.metrics-grid')).toBeNull();
  });

  it('should show when the tecWatch status is unavailable', async () => {
    await setup({
      getStatus: () => throwError(() => ({ ...invalidReportError, status: 502, error: 'Bad Gateway', validation_errors: [] }))
    });

    expect(compiled.querySelector('#status-error')?.textContent).toContain('Bad Gateway');
    expect(compiled.querySelector('.run-title')?.textContent).toContain('TRACE-RUN-20261002-102359');
  });
});
