import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError } from '../../models/trace-analysis';
import { AnalysisScenarios } from '../../models/analysis-scenarios';

/** Analysis findings of the data-analysis workbook (GET /api/analysis/scenarios). */
@Component({
  selector: 'app-findings',
  standalone: false,
  templateUrl: './findings.component.html',
  styleUrls: ['./findings.component.css']
})
export class FindingsComponent implements OnInit {
  data: AnalysisScenarios | null = null;
  error: ApiError | null = null;

  constructor(
    private apiService: TecWatchApiService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadScenarios();
  }

  // The app is zoneless, so HTTP callbacks mark the view for check themselves
  loadScenarios(): void {
    this.apiService.getAnalysisScenarios().subscribe({
      next: data => {
        this.data = data;
        this.error = null;
        this.changeDetector.markForCheck();
      },
      error: (err: ApiError) => {
        this.data = null;
        this.error = err;
        this.changeDetector.markForCheck();
      }
    });
  }
}
