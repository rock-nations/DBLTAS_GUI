import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppModule } from '../../app-module';
import { DashboardComponent } from './dashboard.component';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { TraceAnalysis, TecWatchStatus } from '../../models/trace-analysis';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const sampleTrace: TraceAnalysis = {
    analysis_id: 'TRACE-RUN-1001',
    device_id: 'TW-NODE-01',
    timestamp: new Date().toISOString(),
    analysis_type: 'TRACE_COMMUNICATION',
    result_status: 'FAILED',
    summary: 'Message length error detected on CAN bus packet ID 127.',
    trace_messages: [
      {
        timestamp: new Date().toISOString(),
        sender: 'ECU_ENGINE',
        receiver: 'TECWATCH_RECORDER',
        protocol: 'CAN',
        message_type: 'TELEMETRY',
        status: 'FAILED',
        error_reason: 'Message Length Error'
      }
    ],
    failure_findings: [
      {
        message_id: '127',
        expected_length: 64,
        actual_length: 60,
        result: 'Message Length Error'
      }
    ],
    data_comparisons: [
      { field: 'MessageID', expected: '1001', actual: '1001', result: 'OK' },
      { field: 'Length', expected: '64', actual: '60', result: 'Error' },
      { field: 'Status', expected: 'READY', actual: 'READY', result: 'OK' }
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

  const mockApiService = {
    getStatus: () => of(sampleStatus),
    getAnalyses: () => of([sampleTrace]),
    submitAnalysis: () => of({ status: 'SUCCESS' })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        { provide: TecWatchApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the dashboard and load tecWatch status', () => {
    expect(component).toBeTruthy();
    expect(component.tecWatchStatus?.device_id).toBe('TW-01');
    expect(component.tecWatchStatus?.status).toBe('OPERATIONAL');
  });

  it('should display analysis results in dashboard list', () => {
    expect(component.analyses.length).toBe(1);
    expect(component.selectedAnalysis?.analysis_id).toBe('TRACE-RUN-1001');
  });

  it('should identify failure findings (Message 127 length 64 vs 60)', () => {
    const findings = component.selectedAnalysis?.failure_findings || [];
    expect(findings.length).toBe(1);
    expect(findings[0].message_id).toBe('127');
    expect(findings[0].expected_length).toBe(64);
    expect(findings[0].actual_length).toBe(60);
    expect(findings[0].result).toBe('Message Length Error');
  });

  it('should compare expected vs actual data structures', () => {
    const comparisons = component.selectedAnalysis?.data_comparisons || [];
    expect(comparisons.length).toBe(3);
    const lengthRow = comparisons.find(c => c.field === 'Length');
    expect(lengthRow?.expected).toBe('64');
    expect(lengthRow?.actual).toBe('60');
    expect(lengthRow?.result).toBe('Error');
  });

  it('should allow switching between trace, failure, and comparison views', () => {
    expect(component.activeTab).toBe('trace');
    component.activeTab = 'failures';
    expect(component.activeTab).toBe('failures');
    component.activeTab = 'comparison';
    expect(component.activeTab).toBe('comparison');
  });
});
