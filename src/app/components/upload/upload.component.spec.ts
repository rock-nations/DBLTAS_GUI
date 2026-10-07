import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AppModule } from '../../app-module';
import { MAX_UPLOAD_BYTES, UploadComponent } from './upload.component';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { UploadStateService } from '../../services/upload-state.service';
import { ApiError } from '../../models/trace-analysis';
import { AnalysisScenarios } from '../../models/analysis-scenarios';
import { SAMPLE_ANALYSIS } from '../../../testing/analysis-scenarios.fixture';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  let compiled: HTMLElement;
  let uploads: { capture: File | null; report: File | null }[];

  const capture = new File([new Uint8Array([0x0a, 0x0d, 0x0d, 0x0a])], 'RealOCWorking_TDS_21026.pcapng');
  const report = new File(['%PDF-1.7'], 'Real_SCI-TDS_2026-10-02_12-24-11.pdf', { type: 'application/pdf' });

  async function setup(
    upload: () => Observable<AnalysisScenarios> = () => of(structuredClone(SAMPLE_ANALYSIS))
  ): Promise<void> {
    uploads = [];
    const mockApiService = {
      baseUrl: 'http://localhost:8000/api',
      uploadForAnalysis: (captureFile: File | null, reportFile: File | null) => {
        uploads.push({ capture: captureFile, report: reportFile });
        return upload();
      }
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [{ provide: TecWatchApiService, useValue: mockApiService }]
    }).compileComponents();

    TestBed.inject(UploadStateService).clear();
    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  /** Selects a file through the file input, like the browser does. */
  function choose(kind: 'capture' | 'report', file: File): void {
    const input = compiled.querySelector<HTMLInputElement>(`#upload-${kind}`)!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function analyzeButton(): HTMLButtonElement {
    return compiled.querySelector<HTMLButtonElement>('#upload-analyze')!;
  }

  it('should offer a capture and a test report upload', async () => {
    await setup();

    expect(compiled.querySelector('#upload-title')?.textContent).toContain('Upload & Analyze');
    expect(compiled.querySelector('#upload-capture')?.getAttribute('accept')).toBe('.pcapng,.pcap,.cap');
    expect(compiled.querySelector('#upload-report')?.getAttribute('accept')).toBe('.pdf');
    expect(analyzeButton().disabled).toBe(true);
    expect(compiled.querySelector('.empty-inspector')?.textContent).toContain('No Analysis Yet');
  });

  it('should upload the selected files and show the analysis', async () => {
    await setup();

    choose('capture', capture);
    choose('report', report);
    expect(compiled.querySelectorAll('.dz-file').length).toBe(2);
    expect(analyzeButton().disabled).toBe(false);

    analyzeButton().click();
    fixture.detectChanges();

    expect(uploads).toEqual([{ capture, report }]);
    expect(compiled.querySelector('app-analysis-view .origin')?.textContent).toContain('Uploaded files');
    expect(compiled.querySelector('#verdict-headline')?.textContent).toContain('1 of 2 test cases failed');
    expect(TestBed.inject(UploadStateService).fileNames).toEqual([capture.name, report.name]);
  });

  it('should analyse a single file', async () => {
    await setup();

    choose('capture', capture);
    analyzeButton().click();
    fixture.detectChanges();

    expect(uploads).toEqual([{ capture, report: null }]);
  });

  it('should reject files of the wrong type or size before uploading', async () => {
    await setup();

    choose('capture', report);
    expect(compiled.querySelector('.dz-error')?.textContent).toContain("is not a capture file (.pcapng or .pcap)");
    expect(component.files.capture).toBeNull();

    choose('report', new File(['x'], 'notes.txt'));
    expect(component.fileErrors.report).toBe("'notes.txt' is not a PDF test report.");

    const huge = new File(['%PDF'], 'huge.pdf');
    Object.defineProperty(huge, 'size', { value: MAX_UPLOAD_BYTES + 1 });
    component.setFile('report', huge);
    expect(component.fileErrors.report).toContain('the limit is 50 MB');
    expect(analyzeButton().disabled).toBe(true);
  });

  it('should disable the form while the files are analysed', async () => {
    const response = new Subject<AnalysisScenarios>();
    await setup(() => response);

    choose('report', report);
    analyzeButton().click();
    fixture.detectChanges();
    expect(analyzeButton().textContent).toContain('Analysing');
    expect(analyzeButton().disabled).toBe(true);
    expect(compiled.querySelector<HTMLInputElement>('#upload-capture')?.disabled).toBe(true);

    response.next(structuredClone(SAMPLE_ANALYSIS));
    response.complete();
    fixture.detectChanges();
    expect(analyzeButton().disabled).toBe(false);
    expect(compiled.querySelector('app-analysis-view')).not.toBeNull();
  });

  it('should show why the backend rejected the files', async () => {
    const rejected: ApiError = {
      status: 422,
      error: 'Unreadable Test Report',
      detail: "'report.pdf' could not be read: No test cases found - is this a CANoe test report?",
      validation_errors: []
    };
    await setup(() => throwError(() => rejected));

    choose('report', report);
    analyzeButton().click();
    fixture.detectChanges();

    const error = compiled.querySelector('#upload-error')?.textContent ?? '';
    expect(error).toContain('Unreadable Test Report');
    expect(error).toContain('No test cases found');
    expect(compiled.querySelector('app-analysis-view')).toBeNull();
  });

  it('should keep the last result and start over on request', async () => {
    await setup();
    choose('capture', capture);
    analyzeButton().click();
    fixture.detectChanges();

    // a new page instance (e.g. after visiting another view) still shows the last result
    const again = TestBed.createComponent(UploadComponent);
    again.detectChanges();
    expect((again.nativeElement as HTMLElement).querySelector('app-analysis-view')).not.toBeNull();

    (compiled.querySelector('#upload-reset') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.result).toBeNull();
    expect(component.files.capture).toBeNull();
    expect(compiled.querySelector('app-analysis-view')).toBeNull();
  });
});
