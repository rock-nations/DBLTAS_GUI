import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AppModule } from '../../app-module';
import { StatusHeaderComponent } from './status-header.component';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError, TecWatchStatus } from '../../models/trace-analysis';

describe('StatusHeaderComponent', () => {
  let component: StatusHeaderComponent;
  let fixture: ComponentFixture<StatusHeaderComponent>;
  let compiled: HTMLElement;
  let statusCalls: number;

  const sampleStatus: TecWatchStatus = {
    device_id: 'DETHMM AZA34##0001',
    status: 'DEGRADED',
    timestamp: '2026-10-07T07:30:00Z',
    link: {
      state: 'CONNECTED',
      protocol: 'SCI-TDS Baseline 5 over RaSTA',
      btp_version: '01',
      version_check: 'BTP-Versionswerte gleich',
      local_endpoint: 'DETHMM ZE 35##0001 (1.208.188.16:24001)',
      remote_endpoint: 'DETHMM AZA34##0001 (10.129.15.2:24001)',
      heartbeat_interval_ms: 300,
      last_message_at: '2026-10-07T07:29:59.880Z'
    },
    track_sections: [
      {
        section: '34W1',
        section_type: 'GFM-A',
        occupancy: 'DISTURBED',
        resettable: false,
        axle_count: 0,
        since: '2026-10-02T10:27:06.906Z'
      }
    ],
    test_execution: {
      state: 'STOPPED',
      test_unit: 'TDS-Test',
      configuration: 'ZE_RealOC_Stimulation.cfg',
      current_test_case: 'TC_NPRO.295.00522.01',
      passed: 2,
      failed: 2,
      inconclusive: 1
    },
    active_alerts: ['GFM-A 34W1 gestört (disturbed) and nicht grundstellbar: AZG/AZGH will be discarded']
  };

  async function setup(getStatus: () => Observable<TecWatchStatus> = () => of(sampleStatus)): Promise<void> {
    statusCalls = 0;
    const mockApiService = {
      baseUrl: 'http://localhost:8000/api',
      getStatus: () => {
        statusCalls++;
        return getStatus();
      }
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [{ provide: TecWatchApiService, useValue: mockApiService }]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusHeaderComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  it('should load the tecWatch status once on initial load', async () => {
    await setup();

    expect(statusCalls).toBe(1);
    expect(component.status?.device_id).toBe('DETHMM AZA34##0001');
  });

  it('should show the operator status of the SCI-TDS interface', async () => {
    await setup();
    const text = compiled.querySelector('.status-bar')?.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(compiled.querySelector('.badge-warning')?.textContent).toContain('DEGRADED');
    expect(compiled.querySelector('#link-state')?.textContent).toContain('CONNECTED');
    expect(text).toContain('SCI-TDS Baseline 5 over RaSTA');
    expect(text).toContain('DETHMM AZA34##0001');
    expect(text).toContain('GFM-A 34W1');
    expect(text).toContain('gestört (disturbed)');
    expect(text).toContain('nicht grundstellbar');
    expect(text).toContain('2 passed · 2 failed · 1 inconclusive');
    expect(compiled.querySelector('.track-section')?.classList).toContain('is-disturbed');
    expect(compiled.querySelectorAll('.alert-list li').length).toBe(1);
    expect(text).not.toContain('Battery');
  });

  it('should offer navigation to the trace analysis and the analysis findings', async () => {
    await setup();

    expect(compiled.querySelector('#nav-dashboard')?.getAttribute('href')).toBe('/');
    expect(compiled.querySelector('#nav-findings')?.getAttribute('href')).toBe('/findings');
    expect(compiled.querySelector('#nav-findings')?.textContent).toContain('Analysis Findings');
    expect('submitAnalysis' in TecWatchApiService.prototype).toBe(false);
  });

  it('should show when the tecWatch status is unavailable', async () => {
    const badGateway: ApiError = {
      status: 502,
      error: 'Bad Gateway',
      detail: 'Cannot connect to target server at http://127.0.0.1:8080.',
      validation_errors: []
    };
    await setup(() => throwError(() => badGateway));

    expect(component.status).toBeNull();
    expect(compiled.querySelector('#status-error')?.textContent).toContain('Bad Gateway');
    expect(compiled.querySelector('.status-bar')).toBeNull();
  });
});
