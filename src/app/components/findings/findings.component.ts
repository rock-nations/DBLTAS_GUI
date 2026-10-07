import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TecWatchApiService } from '../../services/tecwatch-api.service';
import { ApiError } from '../../models/trace-analysis';
import {
  AnalysisScenarios,
  Confidence,
  OpenQuestion,
  Scenario,
  ScenarioTestCase,
  Severity,
  SourceType,
  TimelineEvent
} from '../../models/analysis-scenarios';

export type FindingsTab = 'scenarios' | 'testcases' | 'timeline' | 'states' | 'sources' | 'method';

export const SEVERITIES: Severity[] = ['High', 'Medium', 'Low', 'Info'];

/** Display names (and column order) of the data-source types. */
export const SOURCE_LABELS: Record<SourceType, string> = {
  pdf: 'PDF report',
  pcap: 'pcapng',
  blf: 'BLF',
  write_log: 'Write log',
  test_spec: 'Test spec',
  telegram_xlsx: 'Telegram xlsx',
  lua_dissector: 'Lua dissector'
};

/** Timeline filter value for pre-test events without a test case. */
export const NO_TEST_CASE = 'NONE';

const CONFIDENCE_LEVEL: Record<Confidence, number> = { Low: 1, Medium: 2, High: 3 };

export interface ChartSegment {
  left: number;
  width: number;
  label: string;
  cssClass: string;
  title: string;
}

export interface StateChart {
  ticks: { left: number; value: number }[];
  testCases: ChartSegment[];
  occupancy: ChartSegment[];
  resettable: ChartSegment[];
  commands: ChartSegment[];
}

@Component({
  selector: 'app-findings',
  standalone: false,
  templateUrl: './findings.component.html',
  styleUrls: ['./findings.component.css']
})
export class FindingsComponent implements OnInit {
  readonly severities = SEVERITIES;
  readonly sourceLabels = SOURCE_LABELS;
  readonly NO_TEST_CASE = NO_TEST_CASE;

  data: AnalysisScenarios | null = null;
  error: ApiError | null = null;
  activeTab: FindingsTab = 'scenarios';

  // Derived once per load
  scenarioIdsBySeverity: Record<Severity, string[]> = { High: [], Medium: [], Low: [], Info: [] };
  categories: string[] = [];
  sourceTypes: SourceType[] = [];
  chart: StateChart | null = null;
  private scenarioById = new Map<string, Scenario>();
  private testCaseById = new Map<string, ScenarioTestCase>();

  // Finding filters
  searchTerm = '';
  severityFilter: Severity | 'ALL' = 'ALL';
  categoryFilter = 'ALL';
  testCaseFilter = 'ALL';
  sourceFilter: SourceType | 'ALL' = 'ALL';
  selectedScenarioId: string | null = null;

  // Timeline filters
  timelineTestCase = 'ALL';
  timelineSource: SourceType | 'ALL' = 'ALL';
  timelineLinkedOnly = false;
  timelineScenario: string | null = null;

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
        this.prepare(data);
        this.changeDetector.markForCheck();
      },
      error: (err: ApiError) => {
        this.data = null;
        this.error = err;
        this.changeDetector.markForCheck();
      }
    });
  }

  // ---------- Overview ----------

  get overallFailed(): boolean {
    return !!this.data && this.data.test_run.overall_verdict.toUpperCase().startsWith('FAIL');
  }

  verdictCount(verdict: ScenarioTestCase['verdict']): number {
    return (this.data?.test_cases ?? []).filter(tc => tc.verdict === verdict).length;
  }

  toggleSeverity(severity: Severity | 'ALL'): void {
    this.severityFilter = this.severityFilter === severity ? 'ALL' : severity;
    this.activeTab = 'scenarios';
  }

  // ---------- Findings explorer ----------

  get filteredScenarios(): Scenario[] {
    const term = this.searchTerm.trim().toLowerCase();
    return (this.data?.scenarios ?? []).filter(s =>
      (this.severityFilter === 'ALL' || s.severity === this.severityFilter) &&
      (this.categoryFilter === 'ALL' || s.category === this.categoryFilter) &&
      (this.sourceFilter === 'ALL' || s.data_sources.some(source => source.type === this.sourceFilter)) &&
      (this.testCaseFilter === 'ALL' || s.applies_to_all_test_cases || s.test_cases.includes(this.testCaseFilter)) &&
      (!term || [
        s.id, s.title, s.category, s.symptom, s.root_cause, s.recommendation, s.method, s.test_case_scope ?? '',
        ...s.evidence, ...s.potential_reasons
      ].some(text => text.toLowerCase().includes(term)))
    );
  }

  /** The selected finding if it passes the filters, otherwise the first visible one. */
  get selectedScenario(): Scenario | null {
    const visible = this.filteredScenarios;
    return visible.find(s => s.id === this.selectedScenarioId) ?? visible[0] ?? null;
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() || this.severityFilter !== 'ALL' || this.categoryFilter !== 'ALL' ||
      this.testCaseFilter !== 'ALL' || this.sourceFilter !== 'ALL';
  }

  selectScenario(id: string): void {
    this.selectedScenarioId = id;
  }

  /** Opens a finding from another tab, clearing filters that would hide it. */
  openScenario(id: string): void {
    if (!this.filteredScenarios.some(s => s.id === id)) {
      this.clearFilters();
    }
    this.selectedScenarioId = id;
    this.activeTab = 'scenarios';
  }

  canStep(offset: number): boolean {
    const visible = this.filteredScenarios;
    const index = visible.findIndex(s => s.id === this.selectedScenario?.id);
    return index + offset >= 0 && index + offset < visible.length;
  }

  stepScenario(offset: number): void {
    const visible = this.filteredScenarios;
    const next = visible[visible.findIndex(s => s.id === this.selectedScenario?.id) + offset];
    if (next) {
      this.selectedScenarioId = next.id;
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.severityFilter = 'ALL';
    this.categoryFilter = 'ALL';
    this.testCaseFilter = 'ALL';
    this.sourceFilter = 'ALL';
  }

  testCasesFor(scenario: Scenario): ScenarioTestCase[] {
    return scenario.test_cases
      .map(id => this.testCaseById.get(id))
      .filter((tc): tc is ScenarioTestCase => !!tc);
  }

  timelineFor(scenario: Scenario): TimelineEvent[] {
    return (this.data?.timeline ?? []).filter(e => e.scenario_ids.includes(scenario.id));
  }

  questionsFor(scenario: Scenario): OpenQuestion[] {
    return (this.data?.method.open_questions ?? []).filter(q => q.scenario_ids.includes(scenario.id));
  }

  scenarioTitle(id: string): string {
    return this.scenarioById.get(id)?.title ?? id;
  }

  scenarioSeverity(id: string): Severity {
    return this.scenarioById.get(id)?.severity ?? 'Info';
  }

  testCaseLabel(id: string | null): string {
    const tc = id ? this.testCaseById.get(id) : undefined;
    return tc ? `TC${tc.number} · ${tc.test_case_id}` : 'Pre-test';
  }

  // ---------- Correlated timeline ----------

  get filteredTimeline(): TimelineEvent[] {
    return (this.data?.timeline ?? []).filter(e =>
      (this.timelineTestCase === 'ALL' ||
        (this.timelineTestCase === NO_TEST_CASE ? e.test_case_id === null : e.test_case_id === this.timelineTestCase)) &&
      (this.timelineSource === 'ALL' || e.source === this.timelineSource) &&
      (!this.timelineLinkedOnly || e.scenario_ids.length > 0)
    );
  }

  /** Analyst comment without its trailing scenario references (e.g. "– S01, S02"), which are shown as chips. */
  commentText(event: TimelineEvent): string {
    return (event.comment ?? '').replace(/\s*(?:[–-]\s*)?(?:S\d{2}(?:\s*[,/]\s*)?)+\s*$/, '').trim();
  }

  /** Shows the timeline of the finding's test case with the finding's events highlighted. */
  showOnTimeline(scenario: Scenario): void {
    this.timelineScenario = scenario.id;
    this.timelineTestCase =
      scenario.test_cases.length === 1 && !scenario.applies_to_all_test_cases ? scenario.test_cases[0] : 'ALL';
    this.timelineSource = 'ALL';
    this.timelineLinkedOnly = false;
    this.activeTab = 'timeline';
  }

  // ---------- Data-source matrix ----------

  usesSource(scenario: Scenario, type: SourceType): boolean {
    return scenario.data_sources.some(source => source.type === type);
  }

  sourceLabelFor(scenario: Scenario, type: SourceType): string {
    return scenario.data_sources.filter(source => source.type === type).map(source => source.label).join(', ');
  }

  sourceCount(type: SourceType): number {
    return (this.data?.scenarios ?? []).filter(s => this.usesSource(s, type)).length;
  }

  // ---------- Styling helpers ----------

  severityClass(severity: Severity): string {
    return 'sev-' + severity.toLowerCase();
  }

  severityBadge(severity: Severity): string {
    switch (severity) {
      case 'High':
        return 'badge-failed';
      case 'Medium':
        return 'badge-warning';
      case 'Low':
        return 'badge-protocol';
      default:
        return 'badge-neutral';
    }
  }

  verdictBadge(verdict: ScenarioTestCase['verdict']): string {
    return verdict === 'Pass' ? 'badge-passed' : verdict === 'Fail' ? 'badge-failed' : 'badge-warning';
  }

  confidenceLevel(confidence: Confidence): number {
    return CONFIDENCE_LEVEL[confidence];
  }

  private prepare(data: AnalysisScenarios): void {
    this.scenarioById = new Map(data.scenarios.map(s => [s.id, s]));
    this.testCaseById = new Map(data.test_cases.map(tc => [tc.test_case_id, tc]));
    this.scenarioIdsBySeverity = { High: [], Medium: [], Low: [], Info: [] };
    for (const scenario of data.scenarios) {
      this.scenarioIdsBySeverity[scenario.severity].push(scenario.id);
    }
    this.categories = [...new Set(data.scenarios.map(s => s.category))];
    const usedSources = new Set(data.scenarios.flatMap(s => s.data_sources.map(source => source.type)));
    this.sourceTypes = (Object.keys(SOURCE_LABELS) as SourceType[]).filter(type => usedSources.has(type));
    this.chart = this.buildStateChart(data);
    // Start with the first high-severity finding
    this.selectedScenarioId = (data.scenarios.find(s => s.severity === 'High') ?? data.scenarios[0])?.id ?? null;
  }

  /** Positions (in % of the run) for the test-case, GFM-A state and AZG/AZGH command rows. */
  private buildStateChart(data: AnalysisScenarios): StateChart | null {
    const states = data.gfma_state_history.states;
    const end = Math.max(0, ...data.test_cases.map(tc => tc.window_end_s), ...states.map(s => s.until_s));
    if (end === 0) {
      return null;
    }
    const pct = (seconds: number) => (seconds / end) * 100;
    const range = (from: number, to: number) => `${from.toFixed(3)} – ${to.toFixed(3)} s`;

    const ticks = [];
    for (let value = 0; value <= end; value += 60) {
      ticks.push({ left: pct(value), value });
    }

    return {
      ticks,
      testCases: data.test_cases.map(tc => ({
        left: pct(tc.window_start_s),
        width: pct(tc.window_end_s - tc.window_start_s),
        label: `TC${tc.number}`,
        cssClass: 'verdict-' + tc.verdict.toLowerCase(),
        title: `TC${tc.number} ${tc.test_case_id} · ${tc.verdict} · ${range(tc.window_start_s, tc.window_end_s)}`
      })),
      occupancy: states.map(s => ({
        left: pct(s.canoe_time_s),
        width: pct(s.duration_s),
        label: s.occupancy,
        cssClass: 'occ-' + s.occupancy_code,
        title: `${s.occupancy} (axle count ${s.axle_count}) · ${range(s.canoe_time_s, s.until_s)} · ${s.duration_s} s`
      })),
      resettable: states.map(s => ({
        left: pct(s.canoe_time_s),
        width: pct(s.duration_s),
        label: s.resettable,
        cssClass: s.resettable_code === 1 ? 'res-yes' : 'res-no',
        title: `${s.resettable} · ${range(s.canoe_time_s, s.until_s)}`
      })),
      // AZG/AZGH commands on the wire (pcap) and from the ZE panel (BLF); PDF steps duplicate the pcap commands
      commands: data.timeline
        .filter(e => e.source !== 'pdf' && /AZG/.test(e.event))
        .map(e => ({
          left: pct(e.canoe_time_s),
          width: 0,
          label: e.event,
          cssClass: e.source === 'blf' ? 'cmd-panel' : 'cmd-wire',
          title: `${e.canoe_time_s.toFixed(3)} s · ${e.event}${e.comment ? ' – ' + e.comment : ''}`
        }))
    };
  }
}
