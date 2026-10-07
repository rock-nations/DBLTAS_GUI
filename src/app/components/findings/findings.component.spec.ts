import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AppModule } from '../../app-module';
import { FindingsComponent } from './findings.component';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError } from '../../models/trace-analysis';
import { AnalysisScenarios } from '../../models/analysis-scenarios';
import { SAMPLE_ANALYSIS } from '../../../testing/analysis-scenarios.fixture';

describe('FindingsComponent', () => {
  let component: FindingsComponent;
  let fixture: ComponentFixture<FindingsComponent>;
  let compiled: HTMLElement;
  let scenarioCalls: number;

  async function setup(
    getAnalysisScenarios: () => Observable<AnalysisScenarios> = () => of(structuredClone(SAMPLE_ANALYSIS))
  ): Promise<void> {
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

  it('should load the workbook findings and show them summary-first', async () => {
    await setup();

    expect(scenarioCalls).toBe(1);
    expect(compiled.querySelector('#analysis-title')?.textContent).toContain('Failure Analysis Scenarios');
    expect(compiled.querySelector('.origin')?.textContent).toContain('Data analysis');
    expect(compiled.querySelector('#verdict-headline')?.textContent).toContain('1 of 2 test cases failed');
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
    expect(compiled.querySelector('app-analysis-view')).toBeNull();
  });
});
