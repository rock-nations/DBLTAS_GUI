import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppModule } from '../../app-module';
import { IoGraphComponent } from './io-graph.component';
import { IoGraph, ScenarioTestCase } from '../../models/analysis-scenarios';
import { SAMPLE_IO_GRAPH } from '../../../testing/analysis-scenarios.fixture';

describe('IoGraphComponent', () => {
  let component: IoGraphComponent;
  let fixture: ComponentFixture<IoGraphComponent>;
  let compiled: HTMLElement;

  async function setup(graph: IoGraph = structuredClone(SAMPLE_IO_GRAPH), testCases: ScenarioTestCase[] = []): Promise<void> {
    await TestBed.configureTestingModule({ imports: [AppModule] }).compileComponents();
    fixture = TestBed.createComponent(IoGraphComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('graph', graph);
    fixture.componentRef.setInput('testCases', testCases);
    fixture.detectChanges();
  }

  /** Re-renders after calling component methods directly; in the zoneless app DOM events mark the view dirty. */
  function render(): void {
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  }

  function lineClasses(): string[] {
    return Array.from(compiled.querySelectorAll('polyline')).map(line => line.getAttribute('class') ?? '');
  }

  function cells(row: number): string[] {
    const tableRow = compiled.querySelectorAll('.series-table tbody tr')[row];
    return Array.from(tableRow.querySelectorAll('td')).map(cell => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  /** A graph with the given number of addresses and intervals (one packet per address and interval). */
  function graphWith(hosts: number, intervals: number): IoGraph {
    const ones = Array(intervals).fill(1);
    return {
      ...structuredClone(SAMPLE_IO_GRAPH),
      total_packets: hosts * intervals,
      all_packets: Array(intervals).fill(hosts),
      hosts: Array.from({ length: hosts }, (_, i) => ({
        address: `10.0.0.${i + 1}`, role: null, packets_sent: intervals, packets_received: 0, sent: ones, received: Array(intervals).fill(0)
      }))
    };
  }

  it('should draw all packets and every address sent by default', async () => {
    await setup();

    expect(lineClasses()).toEqual(['series-line slot-all', 'series-line slot-1', 'series-line slot-2']);
    expect(compiled.querySelector('polyline')?.getAttribute('points')?.split(' ').length).toBe(10);
    expect(compiled.querySelector('.y-unit')?.textContent).toContain('Packets / 1 s');
    expect(component.yTicks.map(t => t.label)).toEqual(['0', '5', '10', '15', '20']);
    expect(compiled.querySelector('.io-sub')?.textContent).toContain('74 packets');
    expect(compiled.querySelector('.io-sub')?.textContent).toContain('test-bench time (UTC+02:00)');
  });

  it('should show the Wireshark display filter and the packets of the chosen direction', async () => {
    await setup();

    expect(cells(0).slice(1)).toEqual(['All packets', 'all frames', '–', '74']);
    expect(cells(1)[1]).toBe('ESTW-ZE (CANoe) 1.208.188.16');
    expect([cells(1)[2], cells(1)[4]]).toEqual(['ip.src == 1.208.188.16', '38']);

    const ze = component.series[1];
    component.setDirection(ze, 'dst');
    render();
    expect([cells(1)[2], cells(1)[4]]).toEqual(['ip.dst == 1.208.188.16', '36']);

    component.setDirection(ze, 'addr');
    render();
    expect([cells(1)[2], cells(1)[4]]).toEqual(['ip.addr == 1.208.188.16', '74']);
  });

  it('should draw only the selected addresses and keep their colours', async () => {
    await setup();

    const checkbox = compiled.querySelectorAll<HTMLInputElement>('.host-row input[type=checkbox]')[0];
    checkbox.click();
    fixture.detectChanges();

    expect(lineClasses()).toEqual(['series-line slot-all', 'series-line slot-2']);
    expect(compiled.querySelector('.host-row')?.classList).toContain('row-off');

    (compiled.querySelector('#io-show-all-packets') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(lineClasses()).toEqual(['series-line slot-2']);
  });

  it('should filter the address list and draw only the matching addresses', async () => {
    await setup();

    component.searchTerm = '10.129';
    render();
    expect(compiled.querySelectorAll('.host-row').length).toBe(1);

    (compiled.querySelector('#io-show-matching') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.lines.map(line => line.key)).toEqual(['all', '10.129.15.2']);

    (compiled.querySelector('#io-hide-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.lines.map(line => line.key)).toEqual(['all']);
  });

  it('should draw at most seven addresses at once', async () => {
    await setup(graphWith(9, 10));

    expect(component.series.filter(s => s.host && s.enabled).length).toBe(7);
    const eighth = compiled.querySelectorAll<HTMLInputElement>('.host-row input[type=checkbox]')[7];
    eighth.click();
    fixture.detectChanges();

    expect(eighth.checked).toBe(false);
    expect(compiled.querySelector('#io-limit')?.textContent).toContain('At most 7 IP addresses');
    expect(component.series.filter(s => s.host && s.enabled).length).toBe(7);
  });

  it('should sum intervals and zoom into a range', async () => {
    await setup(graphWith(1, 100));

    expect(component.aggregationOptions).toEqual([1, 2, 5, 10]);
    component.setAggregation(10);
    render();
    expect(compiled.querySelector('.y-unit')?.textContent).toContain('Packets / 10 s');
    expect(component.lines[0].points.split(' ').length).toBe(10);
    expect(component.yMax).toBe(10);

    component.zoomTo(0.2, 0.4);
    render();
    expect([component.viewFrom, component.viewTo]).toEqual([20, 40]);
    expect(component.aggregation).toBe(2); // 10 s intervals are too coarse for 20 s
    expect(compiled.querySelector('#io-reset-zoom')).not.toBeNull();

    component.resetZoom();
    expect([component.viewFrom, component.viewTo]).toEqual([0, 100]);
  });

  it('should show the values of the interval under the pointer', async () => {
    await setup();

    component.hoverAt(0.75);
    render();

    const tooltip = compiled.querySelector('#io-tooltip')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(tooltip).toContain('12:24:07 – 12:24:08');
    expect(tooltip).toContain('02.10.26 · +7 s into the capture · CANoe 10.5 s');
    expect(component.hover?.rows.map(row => row.value)).toEqual([20, 10, 10]);
    expect(compiled.querySelectorAll('.hover-dot').length).toBe(3);
  });

  it('should label the time axis in test-bench time', async () => {
    await setup();

    expect(component.xTicks.map(tick => tick.label)).toEqual(['12:24:00', '12:24:02', '12:24:04', '12:24:06', '12:24:08', '12:24:10']);
    expect(component.xTicks[0].sub).toBe('02.10.26');
    expect(component.xTicks[1].sub).toBeUndefined();
  });

  it('should draw the test cases above the graph when the capture is aligned', async () => {
    const testCase = (number: number, verdict: ScenarioTestCase['verdict'], start: number, end: number): ScenarioTestCase => ({
      number, test_case_id: `TC_NPRO.295.0000${number}.01`, variant: null, title: null, verdict,
      window_start_s: start, window_end_s: end, failure_point: null, root_cause: '', scenario_ids: []
    });
    await setup(structuredClone(SAMPLE_IO_GRAPH), [testCase(1, 'Pass', 4.5, 8.5), testCase(2, 'Fail', 8.5, 20)]);

    expect(component.tcSegments.map(s => [s.label, s.left, s.width, s.cssClass])).toEqual([
      ['TC1', 10, 40, 'verdict-pass'],
      ['TC2', 50, 50, 'verdict-fail']
    ]);
    expect(compiled.querySelectorAll('.tc-segment').length).toBe(2);
  });
});
