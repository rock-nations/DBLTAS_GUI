import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { AppModule } from './app-module';
import { App } from './app';
import { TecWatchApiService } from './services/tecwatch-api.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: TecWatchApiService,
          useValue: { baseUrl: 'http://localhost:8000/api', getStatus: () => NEVER, getAnalysis: () => NEVER, getAnalysisScenarios: () => NEVER }
        }
      ]
    }).compileComponents();
  });

  it('should create the root app component', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should contain the status header, router-outlet and app-loading', () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-status-header')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.querySelector('app-loading')).toBeTruthy();
  });
});
