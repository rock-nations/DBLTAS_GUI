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

  function pointCount(index = 0): number {
    return component.lines[index].points.split(' ').length;
  }

  function cells(row: number): string[] {
    const tableRow = compiled.querySelectorAll('.series-table tbody tr')[row];
    return Array.from(tableRow.querySelectorAll('td')).map(cell => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  /** A graph with the given number of addresses, each sending one packet per 10 ms for one second. */
  function graphWith(hosts: number): IoGraph {
    const times = Array.from({ length: 100 * hosts }, (_, i) => Math.floor(i / hosts) * 10_000);
    return {
      ...structuredClone(SAMPLE_IO_GRAPH),
      duration_s: 0.99,
      total_packets: times.length,
      packet_time_us: times,
      packet_src: times.map((_, i) => i % hosts),
      packet_dst: times.map(() => -1),
      hosts: Array.from({ length: hosts }, (_, i) => ({ address: `10.0.0.${i + 1}`, role: null, packets_sent: 100, packets_received: 0 }))
    };
  }

  it('should draw packets per 100 ms for all packets and every address by default', async () => {
    await setup();

    expect(component.interval).toBe(100_000);
    expect(lineClasses()).toEqual(['series-line slot-all', 'series-line slot-1', 'series-line slot-2']);
    expect(pointCount()).toBe(100);
    expect(component.yTicks.map(t => t.label)).toEqual(['0', '1', '2', '3', '4']); // 4 packets in 7.0-7.1 s
    expect(compiled.querySelector('.io-sub')?.textContent).toContain('11 packets');
    expect(compiled.querySelector('.io-sub')?.textContent).toContain('test-bench time (UTC+02:00)');
  });

  it('should label the y axis vertically with the interval', async () => {
    await setup();

    expect(compiled.querySelector('.y-label #io-y-label')?.textContent?.trim()).toBe('Packets / 100 ms');
    component.chooseInterval(1_000_000);
    render();
    expect(compiled.querySelector('#io-y-label')?.textContent?.trim()).toBe('Packets / 1 s');
  });

  it('should offer 1 ms, 10 ms and 100 ms intervals', async () => {
    await setup();

    const options = Array.from(compiled.querySelectorAll('#io-interval option')).map(o => o.textContent?.trim());
    expect(options).toEqual(['1 ms', '10 ms', '100 ms', '1 s']);
    expect(component.intervalOptions[2]).toBe(component.interval);
  });

  it('should count per second or per millisecond', async () => {
    await setup();

    component.chooseInterval(1_000_000);
    expect(pointCount()).toBe(10);
    expect(component.yMax).toBe(6); // 5 packets in the first second

    expect(component.lines[0].band).toBeUndefined();

    component.chooseInterval(1_000);
    // 9951 intervals: the peak per pixel column as line, the min/max range as band
    expect(pointCount()).toBe(1200);
    expect(component.lines[0].band?.split(' ').length).toBe(2 * 1200);
    expect(component.yTicks.map(t => t.label)).toEqual(['0', '1']);
  });

  it('should show many time labels on the x axis', async () => {
    await setup();

    // 1200 px wide: a label every second (12:24:00 at the left edge would stick out, so it is left out)
    expect(component.xTicks.map(tick => tick.label)).toEqual([
      '12:24:01', '12:24:02', '12:24:03', '12:24:04', '12:24:05', '12:24:06', '12:24:07', '12:24:08', '12:24:09'
    ]);
    expect(component.xTicks[0].sub).toBe('02.10.26');
    expect(component.xTicks[1].sub).toBeUndefined();
  });

  it('should zoom in with millisecond time labels', async () => {
    await setup();

    component.zoomTo(0.70, 0.71); // narrower than four intervals: widened to 400 ms around the middle
    render();
    expect(component.viewTo - component.viewFrom).toBe(400_000);
    expect(component.xTicks.map(tick => tick.label)).toEqual([
      '12:24:06.85', '12:24:06.90', '12:24:06.95', '12:24:07.00', '12:24:07.05', '12:24:07.10', '12:24:07.15'
    ]);
    expect(compiled.querySelector('#io-reset-zoom')).not.toBeNull();

    component.resetZoom();
    expect([component.viewFrom, component.viewTo]).toEqual([0, 9_950_001]);
  });

  it('should show the exact packets of the interval under the pointer', async () => {
    await setup();

    component.hoverAt(0.705);
    render();

    const tooltip = compiled.querySelector('#io-tooltip')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(tooltip).toContain('12:24:07.0 – 12:24:07.1');
    expect(tooltip).toContain('02.10.26 · +7.0 s into the capture · CANoe 10.5 s');
    expect(component.hover?.rows.map(row => row.value)).toEqual([4, 2, 2]);
    expect(compiled.querySelectorAll('.hover-dot').length).toBe(3);
  });

  it('should show the Wireshark display filter and the packets of the chosen direction', async () => {
    await setup();

    expect(cells(0).slice(1)).toEqual(['All packets', 'all frames', '–', '11']);
    expect(cells(1)[1]).toBe('ESTW-ZE (CANoe) 1.208.188.16');
    expect([cells(1)[2], cells(1)[4]]).toEqual(['ip.src == 1.208.188.16', '6']);

    const ze = component.series[1];
    component.setDirection(ze, 'dst');
    render();
    expect([cells(1)[2], cells(1)[4]]).toEqual(['ip.dst == 1.208.188.16', '4']);

    component.setDirection(ze, 'addr');
    render();
    expect([cells(1)[2], cells(1)[4]]).toEqual(['ip.addr == 1.208.188.16', '10']);
  });

  it('should draw only the selected addresses and keep their colours', async () => {
    await setup();

    compiled.querySelectorAll<HTMLInputElement>('.host-row input[type=checkbox]')[0].click();
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
    await setup(graphWith(9));

    expect(component.series.filter(s => s.host && s.enabled).length).toBe(7);
    const eighth = compiled.querySelectorAll<HTMLInputElement>('.host-row input[type=checkbox]')[7];
    eighth.click();
    fixture.detectChanges();

    expect(eighth.checked).toBe(false);
    expect(compiled.querySelector('#io-limit')?.textContent).toContain('At most 7 IP addresses');
  });

  it('should draw the test cases above the graph when the capture is aligned', async () => {
    const testCase = (number: number, verdict: ScenarioTestCase['verdict'], start: number, end: number): ScenarioTestCase => ({
      number, test_case_id: `TC_NPRO.295.0000${number}.01`, variant: null, title: null, verdict,
      window_start_s: start, window_end_s: end, failure_point: null, root_cause: '', scenario_ids: []
    });
    await setup(structuredClone(SAMPLE_IO_GRAPH), [testCase(1, 'Pass', 4.5, 8.5), testCase(2, 'Fail', 8.5, 20)]);

    const [first, second] = component.tcSegments;
    expect([first.label, first.cssClass, second.label, second.cssClass]).toEqual(['TC1', 'verdict-pass', 'TC2', 'verdict-fail']);
    expect(first.left).toBeCloseTo(10.05, 1);
    expect(first.width).toBeCloseTo(40.2, 1);
    expect(second.left + second.width).toBeCloseTo(100, 5);
    expect(compiled.querySelectorAll('.tc-segment').length).toBe(2);
  });
});
