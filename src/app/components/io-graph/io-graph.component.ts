import { Component, Input, OnChanges } from '@angular/core';
import { IoGraph, IoGraphHost, ScenarioTestCase } from '../../models/analysis-scenarios';

/** Which packets of an address are counted, as in a Wireshark display filter. */
export type Direction = 'src' | 'dst' | 'addr';

/** IP series use the categorical colours --cat-1 .. --cat-7; 'All packets' uses neutral ink. */
export const MAX_IP_SERIES = 7;
export const ALL_PACKETS = 'all';

const AGGREGATIONS = [1, 2, 5, 10, 30, 60, 120, 300, 600];
const TIME_STEPS_S = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
const PLOT_WIDTH = 1000;
const PLOT_HEIGHT = 300;

export interface GraphSeries {
  key: string;
  host: IoGraphHost | null;
  enabled: boolean;
  direction: Direction;
  /** Colour slot 1..7 while an IP series is shown; it stays with the address until it is hidden. */
  slot: number | null;
}

export interface PlotLine {
  key: string;
  cssClass: string;
  points: string;
}

export interface AxisTick {
  position: number;
  label: string;
  sub?: string;
}

export interface HoverRow {
  name: string;
  cssClass: string;
  value: number;
  bottom: number;
}

export interface HoverInfo {
  left: number;
  flip: boolean;
  time: string;
  detail: string;
  rows: HoverRow[];
}

export interface StripSegment {
  left: number;
  width: number;
  label: string;
  cssClass: string;
  title: string;
}

/**
 * Wireshark-like I/O graph of an uploaded capture: packets per interval for all frames and for
 * the IP addresses selected in the series table (sent, received or both).
 */
@Component({
  selector: 'app-io-graph',
  standalone: false,
  templateUrl: './io-graph.component.html',
  styleUrls: ['./io-graph.component.css']
})
export class IoGraphComponent implements OnChanges {
  @Input({ required: true }) graph!: IoGraph;
  /** Test cases of the run, drawn as a strip above the graph when the capture is aligned with CANoe time. */
  @Input() testCases: ScenarioTestCase[] = [];

  readonly plotWidth = PLOT_WIDTH;
  readonly plotHeight = PLOT_HEIGHT;
  readonly maxIpSeries = MAX_IP_SERIES;

  series: GraphSeries[] = [];
  searchTerm = '';
  aggregation = 1;
  aggregationOptions: number[] = [1];
  viewFrom = 0;
  viewTo = 0;
  limitMessage: string | null = null;

  lines: PlotLine[] = [];
  yTicks: AxisTick[] = [];
  xTicks: AxisTick[] = [];
  yMax = 1;
  tcSegments: StripSegment[] = [];
  hover: HoverInfo | null = null;
  selection: { left: number; width: number } | null = null;

  private dragStart: number | null = null;
  private binStarts: number[] = [];
  private binValues = new Map<string, number[]>();

  ngOnChanges(): void {
    if (!this.graph) {
      return;
    }
    const hosts = this.graph.hosts.map((host, index) => ({
      key: host.address,
      host,
      enabled: index < MAX_IP_SERIES,
      direction: 'src' as Direction,
      slot: index < MAX_IP_SERIES ? index + 1 : null
    }));
    this.series = [{ key: ALL_PACKETS, host: null, enabled: true, direction: 'src', slot: null }, ...hosts];
    this.searchTerm = '';
    this.limitMessage = null;
    this.aggregation = 1;
    this.viewFrom = 0;
    this.viewTo = this.intervals;
    this.refresh();
  }

  get intervals(): number {
    return this.graph?.all_packets.length ?? 0;
  }

  get hostSeries(): GraphSeries[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.series.filter(s => s.host && (!term ||
      s.host.address.toLowerCase().includes(term) || (s.host.role ?? '').toLowerCase().includes(term)));
  }

  get allPackets(): GraphSeries {
    return this.series[0];
  }

  get zoomed(): boolean {
    return this.viewFrom > 0 || this.viewTo < this.intervals;
  }

  get timeBase(): string {
    const offset = this.graph.utc_offset_min;
    if (offset === null) {
      return 'local time';
    }
    const sign = offset < 0 ? '-' : '+';
    const minutes = Math.abs(offset);
    return `test-bench time (UTC${sign}${this.pad(Math.floor(minutes / 60))}:${this.pad(minutes % 60)})`;
  }

  get durationLabel(): string {
    return this.secondsLabel(this.intervals * this.graph.interval_s);
  }

  // ---------- Series table ----------

  seriesName(series: GraphSeries): string {
    return series.host ? series.host.role ?? series.host.address : 'All packets';
  }

  displayFilter(series: GraphSeries): string {
    if (!series.host) {
      return 'all frames';
    }
    const family = series.host.address.includes(':') ? 'ipv6' : 'ip';
    return `${family}.${series.direction} == ${series.host.address}`;
  }

  packetCount(series: GraphSeries): number {
    if (!series.host) {
      return this.graph.total_packets;
    }
    const { packets_sent: sent, packets_received: received } = series.host;
    return series.direction === 'src' ? sent : series.direction === 'dst' ? received : sent + received;
  }

  seriesClass(series: GraphSeries): string {
    return series.host ? (series.slot ? `slot-${series.slot}` : 'slot-none') : 'slot-all';
  }

  toggle(series: GraphSeries, enabled: boolean): void {
    this.limitMessage = null;
    if (enabled && series.host && !series.enabled) {
      const slot = this.freeSlot();
      if (slot === null) {
        this.limitMessage = `At most ${MAX_IP_SERIES} IP addresses can be drawn at once. Hide one first.`;
        return;
      }
      series.slot = slot;
    }
    if (!enabled && series.host) {
      series.slot = null;
    }
    series.enabled = enabled;
    this.refresh();
  }

  setDirection(series: GraphSeries, direction: Direction): void {
    series.direction = direction;
    this.refresh();
  }

  /** Draws only the addresses that match the filter text (at most seven). */
  showMatching(): void {
    const matching = new Set(this.hostSeries.map(s => s.key));
    for (const series of this.series.filter(s => s.host)) {
      if (!matching.has(series.key) && series.enabled) {
        series.enabled = false;
        series.slot = null;
      }
    }
    const hidden = this.hostSeries.filter(s => !s.enabled);
    for (const series of hidden) {
      const slot = this.freeSlot();
      if (slot === null) {
        break;
      }
      series.enabled = true;
      series.slot = slot;
    }
    this.limitMessage = this.hostSeries.some(s => !s.enabled)
      ? `Only the first ${MAX_IP_SERIES} matching addresses are drawn.`
      : null;
    this.refresh();
  }

  hideAll(): void {
    for (const series of this.series.filter(s => s.host)) {
      series.enabled = false;
      series.slot = null;
    }
    this.limitMessage = null;
    this.refresh();
  }

  // ---------- Interval and zoom ----------

  setAggregation(multiple: number): void {
    this.aggregation = multiple;
    this.refresh();
  }

  intervalLabel(multiple: number): string {
    return this.secondsLabel(multiple * this.graph.interval_s);
  }

  /** Zooms to a part of the visible range, given as fractions (0..1) of the plot width. */
  zoomTo(fromFraction: number, toFraction: number): void {
    const span = this.viewTo - this.viewFrom;
    let from = Math.floor(this.viewFrom + Math.min(fromFraction, toFraction) * span);
    let to = Math.ceil(this.viewFrom + Math.max(fromFraction, toFraction) * span);
    if (to - from < 4) {
      const middle = Math.round((from + to) / 2);
      from = Math.max(0, middle - 2);
      to = Math.min(this.intervals, from + 4);
    }
    this.viewFrom = from;
    this.viewTo = to;
    this.refresh();
  }

  resetZoom(): void {
    this.viewFrom = 0;
    this.viewTo = this.intervals;
    this.refresh();
  }

  // ---------- Pointer interaction ----------

  onPointerDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.dragStart = this.fractionAt(event);
    this.selection = null;
  }

  onPointerMove(event: MouseEvent): void {
    const fraction = this.fractionAt(event);
    if (this.dragStart !== null) {
      this.selection = {
        left: Math.min(this.dragStart, fraction) * 100,
        width: Math.abs(fraction - this.dragStart) * 100
      };
    }
    this.hoverAt(fraction);
  }

  onPointerUp(event: MouseEvent): void {
    if (this.dragStart === null) {
      return;
    }
    const start = this.dragStart;
    const end = this.fractionAt(event);
    this.dragStart = null;
    this.selection = null;
    if (Math.abs(end - start) > 0.01) {
      this.zoomTo(start, end);
      this.hoverAt(end);
    }
  }

  onPointerLeave(): void {
    this.hover = null;
    this.dragStart = null;
    this.selection = null;
  }

  /** Tooltip values of the interval under the pointer (fraction 0..1 of the plot width). */
  hoverAt(fraction: number): void {
    if (this.binStarts.length === 0) {
      this.hover = null;
      return;
    }
    const index = this.viewFrom + fraction * (this.viewTo - this.viewFrom);
    const position = Math.min(this.binStarts.length - 1, Math.max(0, Math.floor((index - this.binStarts[0]) / this.aggregation)));
    const bin = this.binStarts[position];
    const left = Math.min(100, Math.max(0, this.toX(bin) / PLOT_WIDTH * 100));
    const epoch = this.graph.start_epoch_s + bin * this.graph.interval_s;
    const end = epoch + this.aggregation * this.graph.interval_s;
    const canoe = this.graph.canoe_zero_epoch_s;
    this.hover = {
      left,
      flip: left > 60,
      time: `${this.clock(epoch, true)} – ${this.clock(end, true)}`,
      detail: `${this.date(epoch)} · +${Math.round(bin * this.graph.interval_s)} s into the capture` +
        (canoe !== null ? ` · CANoe ${(epoch - canoe).toFixed(1)} s` : ''),
      rows: this.series.filter(s => s.enabled).map(s => {
        const value = this.binValues.get(s.key)?.[position] ?? 0;
        return {
          name: s.host ? `${this.seriesName(s)} (${this.displayFilter(s)})` : 'All packets',
          cssClass: this.seriesClass(s),
          value,
          bottom: (value / this.yMax) * 100
        };
      })
    };
  }

  // ---------- Drawing ----------

  /** Recomputes the lines, axes and test-case strip after any change of series, interval or zoom. */
  refresh(): void {
    const visible = Math.max(1, this.viewTo - this.viewFrom);
    this.aggregationOptions = AGGREGATIONS.filter(m => m === 1 || visible / m >= 10);
    if (!this.aggregationOptions.includes(this.aggregation)) {
      this.aggregation = this.aggregationOptions[this.aggregationOptions.length - 1];
    }

    const first = Math.floor(this.viewFrom / this.aggregation) * this.aggregation;
    this.binStarts = [];
    for (let bin = first; bin < this.viewTo; bin += this.aggregation) {
      this.binStarts.push(bin);
    }

    this.binValues = new Map();
    let max = 0;
    for (const series of this.series.filter(s => s.enabled)) {
      const values = this.valuesOf(series);
      const binned = this.binStarts.map(bin => {
        let sum = 0;
        for (let index = bin; index < Math.min(bin + this.aggregation, values.length); index++) {
          sum += values[index];
        }
        return sum;
      });
      this.binValues.set(series.key, binned);
      max = Math.max(max, ...binned);
    }

    const step = this.niceStep(max);
    this.yMax = Math.max(step, Math.ceil(max / step) * step);
    this.yTicks = [];
    for (let value = 0; value <= this.yMax; value += step) {
      this.yTicks.push({ position: (value / this.yMax) * 100, label: String(value) });
    }

    this.lines = this.series.filter(s => s.enabled).map(series => ({
      key: series.key,
      cssClass: this.seriesClass(series),
      points: (this.binValues.get(series.key) ?? [])
        .map((value, position) => `${this.toX(this.binStarts[position]).toFixed(1)},${(PLOT_HEIGHT - (value / this.yMax) * PLOT_HEIGHT).toFixed(1)}`)
        .join(' ')
    }));
    // keep the 'All packets' line below the IP lines
    this.lines.sort((a, b) => (a.key === ALL_PACKETS ? -1 : b.key === ALL_PACKETS ? 1 : 0));

    this.xTicks = this.timeTicks();
    this.tcSegments = this.testCaseStrip();
    this.hover = null;
  }

  private valuesOf(series: GraphSeries): number[] {
    if (!series.host) {
      return this.graph.all_packets;
    }
    if (series.direction === 'src') {
      return series.host.sent;
    }
    if (series.direction === 'dst') {
      return series.host.received;
    }
    return series.host.sent.map((value, index) => value + series.host!.received[index]);
  }

  private freeSlot(): number | null {
    const used = new Set(this.series.map(s => s.slot));
    for (let slot = 1; slot <= MAX_IP_SERIES; slot++) {
      if (!used.has(slot)) {
        return slot;
      }
    }
    return null;
  }

  private toX(interval: number): number {
    return ((interval - this.viewFrom) / Math.max(1, this.viewTo - this.viewFrom)) * PLOT_WIDTH;
  }

  private niceStep(max: number): number {
    const raw = Math.max(max, 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= raw) ?? raw;
    return Math.max(1, step);
  }

  /** Ticks on round wall-clock times (e.g. 18:15:00), with the date on the first tick and at midnight. */
  private timeTicks(): AxisTick[] {
    const interval = this.graph.interval_s;
    const from = this.graph.start_epoch_s + this.viewFrom * interval;
    const span = (this.viewTo - this.viewFrom) * interval;
    const step = TIME_STEPS_S.find(candidate => span / candidate <= 7) ?? TIME_STEPS_S[TIME_STEPS_S.length - 1];
    const offset = this.offsetSeconds(from);
    const ticks: AxisTick[] = [];
    let lastDate = '';
    for (let tick = Math.ceil((from + offset) / step) * step - offset; tick <= from + span; tick += step) {
      const date = this.date(tick);
      ticks.push({
        position: ((tick - from) / span) * 100,
        label: this.clock(tick, step < 60),
        sub: date !== lastDate ? date : undefined
      });
      lastDate = date;
    }
    return ticks;
  }

  private testCaseStrip(): StripSegment[] {
    const zero = this.graph.canoe_zero_epoch_s;
    if (zero === null || this.testCases.length === 0) {
      return [];
    }
    const toIndex = (canoeSeconds: number) => (zero + canoeSeconds - this.graph.start_epoch_s) / this.graph.interval_s;
    const span = this.viewTo - this.viewFrom;
    return this.testCases
      .map(tc => {
        const start = Math.max(this.viewFrom, toIndex(tc.window_start_s));
        const end = Math.min(this.viewTo, toIndex(tc.window_end_s));
        return {
          left: ((start - this.viewFrom) / span) * 100,
          width: ((end - start) / span) * 100,
          label: `TC${tc.number}`,
          cssClass: 'verdict-' + tc.verdict.toLowerCase(),
          title: `TC${tc.number} ${tc.test_case_id} · ${tc.verdict} · CANoe ${tc.window_start_s.toFixed(1)} – ${tc.window_end_s.toFixed(1)} s`
        };
      })
      .filter(segment => segment.width > 0);
  }

  /** Seconds to add to Unix time to get the wall clock: the bench offset if known, else the browser's. */
  private offsetSeconds(epoch: number): number {
    return this.graph.utc_offset_min !== null
      ? this.graph.utc_offset_min * 60
      : -new Date(epoch * 1000).getTimezoneOffset() * 60;
  }

  private wall(epoch: number): Date {
    return new Date((epoch + this.offsetSeconds(epoch)) * 1000);
  }

  private clock(epoch: number, seconds: boolean): string {
    const wall = this.wall(epoch);
    const time = `${this.pad(wall.getUTCHours())}:${this.pad(wall.getUTCMinutes())}`;
    return seconds ? `${time}:${this.pad(wall.getUTCSeconds())}` : time;
  }

  private date(epoch: number): string {
    const wall = this.wall(epoch);
    return `${this.pad(wall.getUTCDate())}.${this.pad(wall.getUTCMonth() + 1)}.${String(wall.getUTCFullYear()).slice(-2)}`;
  }

  private secondsLabel(seconds: number): string {
    if (seconds < 60) {
      return `${+seconds.toFixed(1)} s`;
    }
    if (seconds < 3600) {
      return `${+(seconds / 60).toFixed(1)} min`;
    }
    return `${+(seconds / 3600).toFixed(1)} h`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private fractionAt(event: MouseEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
  }
}
