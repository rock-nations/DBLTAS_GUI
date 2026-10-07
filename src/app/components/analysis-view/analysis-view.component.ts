import { Component, Input, OnChanges } from '@angular/core';
import {
  AnalysisScenarios,
  Confidence,
  Scenario,
  ScenarioTestCase,
  Severity,
  SourceType,
  TimelineEvent,
  Verdict
} from '../../models/analysis-scenarios';

export type AnalysisTab = 'summary' | 'findings' | 'timeline' | 'states';
export type VerdictTone = 'fail' | 'warning' | 'pass' | 'trace';

export const SEVERITIES: Severity[] = ['High', 'Medium', 'Low', 'Info'];

/** Short names of the data sources, shown on timeline events. */
export const SOURCE_LABELS: Record<SourceType, string> = {
  pdf: 'Report',
  pcap: 'Capture',
  blf: 'BLF',
  write_log: 'Write log',
  test_spec: 'Test spec',
  telegram_xlsx: 'Telegram xlsx',
  lua_dissector: 'Lua dissector'
};

/** Timeline filter value for events outside the test cases (pre-test, fixture init). */
export const NO_TEST_CASE = 'NONE';

const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

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
  hasPanelCommands: boolean;
}

/**
 * Shows an analysis (workbook findings or the result of an upload) summary-first:
 * what went wrong and why the test cases failed, then the findings, timeline and GFM-A states for details.
 */
@Component({
  selector: 'app-analysis-view',
  standalone: false,
  templateUrl: './analysis-view.component.html',
  styleUrls: ['./analysis-view.component.css']
})
export class AnalysisViewComponent implements OnChanges {
  @Input({ required: true }) data!: AnalysisScenarios;
  /** Where the analysis comes from, shown above the title. */
  @Input() origin = 'Analysis';

  readonly severities = SEVERITIES;
  readonly sourceLabels = SOURCE_LABELS;
  readonly NO_TEST_CASE = NO_TEST_CASE;

  activeTab: AnalysisTab = 'summary';

  // Summary, derived once per data set
  tone: VerdictTone = 'trace';
  headline = '';
  mainCause: Scenario | null = null;
  notPassed: ScenarioTestCase[] = [];
  passed: ScenarioTestCase[] = [];
  mainProblems: Scenario[] = [];
  furtherFindings = 0;
  ruledOut: Scenario[] = [];
  chart: StateChart | null = null;
  private scenarioById = new Map<string, Scenario>();
  private testCaseById = new Map<string, ScenarioTestCase>();

  // Findings explorer
  searchTerm = '';
  severityFilter: Severity | 'ALL' = 'ALL';
  testCaseFilter = 'ALL';
  selectedScenarioId: string | null = null;

  // Timeline
  timelineTestCase = 'ALL';
  timelineLinkedOnly = false;
  timelineScenario: string | null = null;

  ngOnChanges(): void {
    this.prepare(this.data);
  }

  // ---------- Summary ----------

  get verdictLabel(): string {
    switch (this.tone) {
      case 'fail':
        return 'FAIL';
      case 'warning':
        return 'INCONCLUSIVE';
      case 'pass':
        return 'PASS';
      default:
        return 'TRACE ONLY';
    }
  }

  /** Opens a finding in the findings tab, clearing filters that would hide it. */
  openFinding(id: string): void {
    if (!this.filteredScenarios.some(s => s.id === id)) {
      this.clearFilters();
    }
    this.selectedScenarioId = id;
    this.activeTab = 'findings';
  }

  // ---------- Findings explorer ----------

  get filteredScenarios(): Scenario[] {
    const term = this.searchTerm.trim().toLowerCase();
    return (this.data?.scenarios ?? []).filter(s =>
      (this.severityFilter === 'ALL' || s.severity === this.severityFilter) &&
      (this.testCaseFilter === 'ALL' || s.applies_to_all_test_cases || s.test_cases.includes(this.testCaseFilter)) &&
      (!term || [s.id, s.title, s.category, s.symptom, s.root_cause, s.recommendation, ...s.evidence]
        .some(text => text.toLowerCase().includes(term)))
    );
  }

  /** The selected finding if it passes the filters, otherwise the first visible one. */
  get selectedScenario(): Scenario | null {
    const visible = this.filteredScenarios;
    return visible.find(s => s.id === this.selectedScenarioId) ?? visible[0] ?? null;
  }

  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() || this.severityFilter !== 'ALL' || this.testCaseFilter !== 'ALL';
  }

  selectScenario(id: string): void {
    this.selectedScenarioId = id;
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
    this.testCaseFilter = 'ALL';
  }

  testCasesFor(scenario: Scenario): ScenarioTestCase[] {
    return scenario.test_cases
      .map(id => this.testCaseById.get(id))
      .filter((tc): tc is ScenarioTestCase => !!tc);
  }

  timelineFor(scenario: Scenario): TimelineEvent[] {
    return (this.data?.timeline ?? []).filter(e => e.scenario_ids.includes(scenario.id));
  }

  scenarioTitle(id: string): string {
    return this.scenarioById.get(id)?.title ?? id;
  }

  scenarioSeverity(id: string): Severity {
    return this.scenarioById.get(id)?.severity ?? 'Info';
  }

  testCaseLabel(id: string | null): string {
    const tc = id ? this.testCaseById.get(id) : undefined;
    return tc ? `TC${tc.number} · ${tc.test_case_id}` : '–';
  }

  // ---------- Timeline ----------

  get filteredTimeline(): TimelineEvent[] {
    return (this.data?.timeline ?? []).filter(e =>
      (this.timelineTestCase === 'ALL' ||
        (this.timelineTestCase === NO_TEST_CASE ? e.test_case_id === null : e.test_case_id === this.timelineTestCase)) &&
      (!this.timelineLinkedOnly || e.scenario_ids.length > 0)
    );
  }

  /** Comment without its trailing finding references (e.g. "– S01, S02"), which are shown as chips. */
  commentText(event: TimelineEvent): string {
    return (event.comment ?? '').replace(/\s*(?:[–-]\s*)?(?:S\d{2}(?:\s*[,/]\s*)?)+\s*$/, '').trim();
  }

  /** Shows the timeline of the finding's test case with the finding's events highlighted. */
  showOnTimeline(scenario: Scenario): void {
    this.timelineScenario = scenario.id;
    this.timelineTestCase =
      scenario.test_cases.length === 1 && !scenario.applies_to_all_test_cases ? scenario.test_cases[0] : 'ALL';
    this.timelineLinkedOnly = false;
    this.activeTab = 'timeline';
  }

  // ---------- Styling helpers ----------

  severityClass(severity: Severity): string {
    return 'sev-' + severity.toLowerCase();
  }

  /** Severity uses the status scale: High = critical, Medium = serious, Low = warning, Info = neutral. */
  severityBadge(severity: Severity): string {
    switch (severity) {
      case 'High':
        return 'badge-failed';
      case 'Medium':
        return 'badge-serious';
      case 'Low':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }

  verdictBadge(verdict: Verdict): string {
    switch (verdict) {
      case 'Pass':
        return 'badge-passed';
      case 'Fail':
      case 'Error':
        return 'badge-failed';
      default:
        return 'badge-warning';
    }
  }

  verdictClass(verdict: Verdict): string {
    return 'verdict-' + verdict.toLowerCase();
  }

  confidenceText(confidence: Confidence): string {
    return `${confidence} confidence`;
  }

  private prepare(data: AnalysisScenarios | undefined): void {
    if (!data) {
      return;
    }
    this.scenarioById = new Map(data.scenarios.map(s => [s.id, s]));
    this.testCaseById = new Map(data.test_cases.map(tc => [tc.test_case_id, tc]));

    this.notPassed = data.test_cases.filter(tc => tc.verdict !== 'Pass');
    this.passed = data.test_cases.filter(tc => tc.verdict === 'Pass');
    this.mainProblems = data.scenarios.filter(s => s.severity === 'High');
    this.furtherFindings = data.scenarios.filter(s => s.severity === 'Medium' || s.severity === 'Low').length;
    this.ruledOut = data.scenarios.filter(s => s.severity === 'Info');
    this.mainCause = this.mainProblems[0] ?? null;
    [this.tone, this.headline] = this.verdict(data);

    this.chart = this.buildStateChart(data);
    this.activeTab = 'summary';
    this.clearFilters();
    this.timelineTestCase = 'ALL';
    this.timelineLinkedOnly = false;
    this.timelineScenario = null;
    this.selectedScenarioId = this.mainCause?.id ?? data.scenarios[0]?.id ?? null;
  }

  private verdict(data: AnalysisScenarios): [VerdictTone, string] {
    const total = data.test_cases.length;
    if (total === 0) {
      const high = this.mainProblems.length;
      return ['trace', high
        ? `${high} high-severity ${high === 1 ? 'problem' : 'problems'} found in the trace`
        : 'No high-severity problem found in the trace'];
    }
    const failed = data.test_cases.filter(tc => tc.verdict === 'Fail' || tc.verdict === 'Error').length;
    const open = this.notPassed.length - failed;
    if (failed) {
      return ['fail', `${failed} of ${total} test cases failed` + (open ? `, ${open} inconclusive` : '')];
    }
    if (open) {
      return ['warning', `${open} of ${total} test cases inconclusive, none failed`];
    }
    return ['pass', `All ${total} test cases passed`];
  }

  /** Positions (in % of the run) for the test-case, GFM-A state and AZG/AZGH command rows. */
  private buildStateChart(data: AnalysisScenarios): StateChart | null {
    const states = data.gfma_state_history.states;
    if (states.length === 0) {
      return null;
    }
    const end = Math.max(0, ...data.test_cases.map(tc => tc.window_end_s), ...states.map(s => s.until_s));
    if (end === 0) {
      return null;
    }
    const pct = (seconds: number) => (seconds / end) * 100;
    const range = (from: number, to: number) => `${from.toFixed(3)} – ${to.toFixed(3)} s`;
    const step = TICK_STEPS.find(candidate => end / candidate <= 10) ?? 3600;

    const ticks = [];
    for (let value = 0; value <= end; value += step) {
      ticks.push({ left: pct(value), value });
    }

    // AZG/AZGH commands on the wire (capture) and from the ZE panel (BLF); report steps duplicate the wire commands
    const commands = data.timeline
      .filter(e => e.source !== 'pdf' && /AZG/.test(e.event))
      .map(e => ({
        left: pct(e.canoe_time_s),
        width: 0,
        label: e.event,
        cssClass: e.source === 'blf' ? 'cmd-panel' : 'cmd-wire',
        title: `${e.canoe_time_s.toFixed(3)} s · ${e.event}${e.comment ? ' – ' + e.comment : ''}`
      }));

    return {
      ticks,
      testCases: data.test_cases.map(tc => ({
        left: pct(tc.window_start_s),
        width: pct(tc.window_end_s - tc.window_start_s),
        label: `TC${tc.number}`,
        cssClass: this.verdictClass(tc.verdict),
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
      commands,
      hasPanelCommands: commands.some(c => c.cssClass === 'cmd-panel')
    };
  }
}
