import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import {
  ApiError,
  DataComparison,
  FailureFinding,
  FieldValue,
  TecWatchStatus,
  TraceAnalysis,
  TraceMessage
} from '../../models/trace-analysis';

/** Sidebar scopes besides a single test case. */
export const ALL_TEST_CASES = 'ALL';
export const TRACE_WIDE = 'TRACE_WIDE';

export interface TestCaseSummary {
  id: string;
  status: string;
  messageCount: number;
  findingCount: number;
  comparisonCount: number;
}

const STATUS_SEVERITY: Record<string, number> = { FAILED: 0, WARNING: 1, OK: 2 };

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  readonly ALL_TEST_CASES = ALL_TEST_CASES;
  readonly TRACE_WIDE = TRACE_WIDE;

  tecWatchStatus: TecWatchStatus | null = null;
  statusError: ApiError | null = null;
  report: TraceAnalysis | null = null;
  analysisError: ApiError | null = null;
  testCases: TestCaseSummary[] = [];
  activeTab: 'trace' | 'failures' | 'comparison' = 'trace';

  // Filters
  selectedTestCase: string = ALL_TEST_CASES;
  searchTerm: string = '';
  selectedStatus: 'ALL' | 'OK' | 'FAILED' | 'WARNING' = 'ALL';
  sortField: 'time' | 'status' = 'time';
  sortAsc: boolean = true;
  expandedMessageId: string | null = null;

  constructor(
    private apiService: TecWatchApiService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initial load: tecWatch status (proxied by the backend) and the validated analysis report
    this.loadStatus();
    this.loadAnalysis();
  }

  get apiBaseUrl(): string {
    return this.apiService.baseUrl;
  }

  // The app is zoneless, so HTTP callbacks mark the view for check themselves
  loadStatus(): void {
    this.apiService.getStatus().subscribe({
      next: status => {
        this.tecWatchStatus = status;
        this.statusError = null;
        this.changeDetector.markForCheck();
      },
      error: (err: ApiError) => {
        this.tecWatchStatus = null;
        this.statusError = err;
        this.changeDetector.markForCheck();
      }
    });
  }

  loadAnalysis(): void {
    this.apiService.getAnalysis().subscribe({
      next: report => {
        this.report = report;
        this.testCases = this.summarizeTestCases(report);
        this.analysisError = null;
        this.changeDetector.markForCheck();
      },
      error: (err: ApiError) => {
        this.report = null;
        this.testCases = [];
        this.analysisError = err;
        this.changeDetector.markForCheck();
      }
    });
  }

  selectTestCase(testCase: string): void {
    this.selectedTestCase = testCase;
    this.expandedMessageId = null;
  }

  setSort(field: 'time' | 'status'): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
  }

  toggleMessage(messageId: string): void {
    this.expandedMessageId = this.expandedMessageId === messageId ? null : messageId;
  }

  get hasTraceWideItems(): boolean {
    return !!this.report && (
      this.report.trace_messages.some(m => m.test_case === null) ||
      this.report.data_comparisons.some(c => c.test_case === null)
    );
  }

  get scopeLabel(): string {
    if (this.selectedTestCase === ALL_TEST_CASES) return 'All test cases';
    if (this.selectedTestCase === TRACE_WIDE) return 'Trace-wide (no test case)';
    return this.selectedTestCase;
  }

  get filteredMessages(): TraceMessage[] {
    const messages = (this.report?.trace_messages ?? []).filter(m =>
      this.inScope(m.test_case) &&
      this.matchesStatus(m.status) &&
      this.matchesSearch(
        m.message_id, m.sender, m.receiver, m.protocol, m.message_type, m.message_code,
        m.direction, m.test_case, m.status, m.error_reason,
        ...Object.entries(m.fields).map(([key, value]) => `${key}=${value}`)
      )
    );
    return messages.sort((a, b) => {
      const res = this.sortField === 'status'
        ? STATUS_SEVERITY[a.status] - STATUS_SEVERITY[b.status] || a.time_s - b.time_s
        : a.time_s - b.time_s;
      return this.sortAsc ? res : -res;
    });
  }

  get filteredFindings(): FailureFinding[] {
    return (this.report?.failure_findings ?? []).filter(f =>
      this.inScope(f.test_case) &&
      this.matchesStatus('FAILED') &&
      this.matchesSearch(f.message_id, f.result, f.test_case, f.category, f.description, ...f.evidence)
    );
  }

  get filteredComparisons(): DataComparison[] {
    return (this.report?.data_comparisons ?? []).filter(c =>
      this.inScope(c.test_case) &&
      this.matchesStatus(c.result) &&
      this.matchesSearch(c.field, c.expected, c.actual, c.result, c.test_case)
    );
  }

  findingsForMessage(messageId: string): FailureFinding[] {
    return (this.report?.failure_findings ?? []).filter(f => f.message_id === messageId);
  }

  fieldEntries(fields: Record<string, FieldValue>): [string, FieldValue][] {
    return Object.entries(fields);
  }

  /** Badge class for message statuses (OK/FAILED/WARNING), comparison results (OK/Error/Warning) and verdicts. */
  statusBadge(status: string): string {
    switch (this.normalizeStatus(status)) {
      case 'OK':
      case 'PASSED':
      case 'OPERATIONAL':
        return 'badge-passed';
      case 'FAILED':
        return 'badge-failed';
      case 'WARNING':
      case 'INCONCLUSIVE':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }

  isFailed(status: string): boolean {
    return this.normalizeStatus(status) === 'FAILED';
  }

  isWarning(status: string): boolean {
    return this.normalizeStatus(status) === 'WARNING';
  }

  private summarizeTestCases(report: TraceAnalysis): TestCaseSummary[] {
    const ids: string[] = [];
    for (const item of [...report.trace_messages, ...report.failure_findings, ...report.data_comparisons]) {
      if (item.test_case && !ids.includes(item.test_case)) {
        ids.push(item.test_case);
      }
    }
    return ids.map(id => ({
      id,
      status: this.testCaseVerdict(report, id),
      messageCount: report.trace_messages.filter(m => m.test_case === id).length,
      findingCount: report.failure_findings.filter(f => f.test_case === id).length,
      comparisonCount: report.data_comparisons.filter(c => c.test_case === id).length
    }));
  }

  private testCaseVerdict(report: TraceAnalysis, testCase: string): string {
    // The analysis component reports each test case's verdict as a "Test verdict" data comparison
    const verdict = report.data_comparisons.find(c => c.test_case === testCase && c.field === 'Test verdict');
    if (verdict) {
      return verdict.actual.toUpperCase();
    }
    const failed =
      report.failure_findings.some(f => f.test_case === testCase) ||
      report.trace_messages.some(m => m.test_case === testCase && m.status === 'FAILED');
    return failed ? 'FAILED' : 'UNKNOWN';
  }

  private inScope(testCase: string | null): boolean {
    if (this.selectedTestCase === ALL_TEST_CASES) return true;
    if (this.selectedTestCase === TRACE_WIDE) return testCase === null;
    return testCase === this.selectedTestCase;
  }

  private matchesStatus(status: string): boolean {
    return this.selectedStatus === 'ALL' || this.normalizeStatus(status) === this.selectedStatus;
  }

  private matchesSearch(...values: (string | null)[]): boolean {
    const term = this.searchTerm.trim().toLowerCase();
    return !term || values.some(value => value !== null && value.toLowerCase().includes(term));
  }

  private normalizeStatus(status: string): string {
    const upper = status.toUpperCase();
    return upper === 'ERROR' ? 'FAILED' : upper;
  }
}
