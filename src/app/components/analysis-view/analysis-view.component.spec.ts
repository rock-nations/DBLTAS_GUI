import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppModule } from '../../app-module';
import { AnalysisViewComponent } from './analysis-view.component';
import { AnalysisScenarios } from '../../models/analysis-scenarios';
import { SAMPLE_ANALYSIS, SAMPLE_IO_GRAPH, TC1, TC3 } from '../../../testing/analysis-scenarios.fixture';

describe('AnalysisViewComponent', () => {
  let component: AnalysisViewComponent;
  let fixture: ComponentFixture<AnalysisViewComponent>;
  let compiled: HTMLElement;

  async function setup(data: AnalysisScenarios = structuredClone(SAMPLE_ANALYSIS)): Promise<void> {
    await TestBed.configureTestingModule({ imports: [AppModule] }).compileComponents();
    fixture = TestBed.createComponent(AnalysisViewComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('origin', 'Data analysis');
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return compiled.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function click(selector: string, label?: string): void {
    const element = Array.from(compiled.querySelectorAll<HTMLElement>(selector))
      .find(el => label === undefined || el.textContent?.includes(label));
    if (!element) {
      throw new Error(`No element ${selector} ${label ?? ''}`);
    }
    element.click();
    fixture.detectChanges();
  }

  /** The sample without test cases, as returned for an uploaded capture without test report. */
  function traceOnly(): AnalysisScenarios {
    const data = structuredClone(SAMPLE_ANALYSIS);
    data.test_cases = [];
    data.scenarios.forEach(s => (s.test_cases = []));
    data.timeline.forEach(e => (e.test_case_id = null));
    data.gfma_state_history.states.forEach(s => (s.test_case_id = null));
    return data;
  }

  it('should open with a summary of what went wrong', async () => {
    await setup();

    expect(component.activeTab).toBe('summary');
    expect(text('.origin')).toContain('Data analysis · SCI_TDS_Analysis_Scenarios_2026-10-02.xlsx');
    expect(compiled.querySelector('#verdict-banner')?.classList).toContain('tone-fail');
    expect(text('#verdict-banner .verdict-label')).toBe('FAIL');
    expect(text('#verdict-headline')).toBe('1 of 2 test cases failed');
    expect(text('#main-cause')).toBe("GFM-A became 'gestört' 102 ms after manual occupation");
  });

  it('should explain each failed test case in plain language', async () => {
    await setup();

    const cards = compiled.querySelectorAll('.why-card');
    expect(cards.length).toBe(1);
    const card = cards[0].textContent?.replace(/\s+/g, ' ') ?? '';
    expect(card).toContain('Fail');
    expect(card).toContain('TC3');
    expect(card).toContain("AZGH makes GFM-A 'belegt & grundstellbar'");
    expect(card).toContain('Invalid axle count.');
    expect(cards[0].querySelector('.why-where')?.textContent).toContain('Preparation');
    expect(Array.from(cards[0].querySelectorAll('.chip-link')).map(c => c.textContent?.trim())).toEqual(['S01', 'S06']);
  });

  it('should list the main problems with what to do and what works', async () => {
    await setup();

    const actions = Array.from(compiled.querySelectorAll('.action-list li')).map(li => li.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(actions.length).toBe(1);
    expect(actions[0]).toContain('S01');
    expect(actions[0]).toContain('Use a defined stimulation procedure or a wheel-sensor simulator.');
    expect(text('.summary-columns .link-btn')).toContain('2 further findings of medium or low severity');

    const working = Array.from(compiled.querySelectorAll('.ok-list li')).map(li => li.textContent?.replace(/\s+/g, ' ') ?? '');
    expect(working).toEqual([expect.stringContaining('Communication layer ruled out'), expect.stringContaining(`TC1 ${TC1} passed`)]);
    expect(compiled.querySelector('.run-details')?.hasAttribute('open')).toBe(false);
  });

  it('should not show data sources, method or the severity cards', async () => {
    await setup();

    const tabs = Array.from(compiled.querySelectorAll('.tab-btn')).map(tab => tab.textContent?.trim());
    expect(tabs).toEqual(['📋 Summary', '🔎 Findings (4)', '🕒 Timeline (7)', '🚦 GFM-A 34W1']);
    expect(compiled.querySelector('.severity-grid')).toBeNull();
    expect(compiled.textContent).not.toContain('Data sources');
    expect(compiled.textContent).not.toContain('PDF test report, pcapng, BLF');
  });

  it('should open a finding from the summary with the details collapsed', async () => {
    await setup();

    click('.why-card .chip-link', 'S06');
    expect(component.activeTab).toBe('findings');
    expect(component.selectedScenario?.id).toBe('S06');
    expect(text('#scenario-title')).toBe('Cleanup routine cannot succeed');

    const detail = compiled.querySelector('.scenario-detail') as HTMLElement;
    expect(detail.textContent).toContain('What happened');
    expect(detail.textContent).toContain('What to do');
    const technical = detail.querySelector('details.tech-details') as HTMLDetailsElement;
    expect(technical.open).toBe(false);
    expect(technical.textContent).toContain('306.791 (frame 1222): AZGH while not grundstellbar');
    expect(detail.querySelector('.src-tag')?.closest('details')).toBe(technical);
  });

  it('should filter and step through the findings', async () => {
    await setup();
    click('#tab-findings');

    expect(component.selectedScenario?.id).toBe('S01');
    component.severityFilter = 'Medium';
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S06', 'S09']);
    component.clearFilters();
    component.searchTerm = 'silent';
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S09']);
    component.clearFilters();
    component.testCaseFilter = TC1;
    expect(component.filteredScenarios.map(s => s.id)).toEqual(['S09', 'S13']);
    component.clearFilters();
    fixture.detectChanges();

    click('.step-btn', 'Next');
    expect(component.selectedScenario?.id).toBe('S06');
    click('.step-btn', 'Previous');
    expect(component.selectedScenario?.id).toBe('S01');
  });

  it('should show a finding on the timeline with its events highlighted', async () => {
    await setup();
    click('#tab-findings');

    click('.link-btn', 'Show on timeline');
    expect(component.activeTab).toBe('timeline');
    expect(component.timelineTestCase).toBe(TC3);
    expect(compiled.querySelectorAll('.timeline-table tbody tr').length).toBe(5);
    expect(compiled.querySelectorAll('.timeline-table tr.row-highlight').length).toBe(2);

    component.timelineTestCase = 'ALL';
    component.timelineLinkedOnly = true;
    expect(component.filteredTimeline.length).toBe(5);
  });

  it('should chart the GFM-A states and keep the state table collapsed', async () => {
    await setup();
    click('#tab-states');

    expect(component.chart?.occupancy.length).toBe(3);
    expect(compiled.querySelectorAll('.chart-track .segment.short').length).toBe(1);
    expect(compiled.querySelectorAll('.marker.cmd-wire').length).toBe(2);
    expect(compiled.querySelectorAll('.marker.cmd-panel').length).toBe(1);
    expect(component.chart?.ticks.map(t => t.value)).toEqual([0, 60, 120, 180, 240, 300]);
    expect((compiled.querySelector('details.state-details') as HTMLDetailsElement).open).toBe(false);
    expect(compiled.querySelectorAll('.state-details tbody tr.row-error').length).toBe(1);
  });

  it('should show the I/O graph of an uploaded capture', async () => {
    const data = structuredClone(SAMPLE_ANALYSIS);
    data.io_graph = structuredClone(SAMPLE_IO_GRAPH);
    await setup(data);

    click('#tab-traffic');
    expect(component.activeTab).toBe('traffic');
    expect(compiled.querySelector('app-io-graph #io-title')?.textContent).toContain('I/O Graph');
    expect(compiled.querySelectorAll('app-io-graph polyline').length).toBe(3);
  });

  it('should summarize a trace without test report', async () => {
    await setup(traceOnly());

    expect(text('#verdict-banner .verdict-label')).toBe('TRACE ONLY');
    expect(text('#verdict-headline')).toBe('1 high-severity problem found in the trace');
    expect(compiled.querySelector('.why-card')).toBeNull();
    expect(text('.summary-note')).toContain('Upload the CANoe test report');
    expect(compiled.querySelector('#filter-test-case')).toBeNull();
  });

  it('should show a passed run without a main cause', async () => {
    const data = structuredClone(SAMPLE_ANALYSIS);
    data.test_cases[1].verdict = 'Pass';
    await setup(data);

    expect(text('#verdict-banner .verdict-label')).toBe('PASS');
    expect(text('#verdict-headline')).toBe('All 2 test cases passed');
    expect(compiled.querySelector('#main-cause')).toBeNull();
    expect(text('.summary-section')).toContain('All test cases passed.');
  });
});
