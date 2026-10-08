import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { IoGraph, IoGraphHost, ScenarioTestCase } from '../../models/analysis-scenarios';

/** Which packets of an address are counted, as in a Wireshark display filter. */
export type Direction = 'src' | 'dst' | 'addr';

/** IP series use the categorical colours --cat-1 .. --cat-7; 'All packets' uses neutral ink. */
export const MAX_IP_SERIES = 7;
export const ALL_PACKETS = 'all';
/** Interval choices of the Wireshark I/O graph [µs]. */
export const INTERVALS_US = [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 60_000_000, 600_000_000];
export const DEFAULT_INTERVAL_US = 100_000;

const TICK_STEPS_US = [
  1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5,
  1e6, 2e6, 5e6, 1e7, 1.5e7, 3e7, 6e7, 1.2e8, 3e8, 6e8, 9e8, 1.8e9, 3.6e9, 7.2e9, 1.08e10, 2.16e10, 4.32e10, 8.64e10
];
const PLOT_WIDTH = 1000;
const PLOT_HEIGHT = 300;
/** Up to this many intervals each interval is a point; more are drawn as min/max per pixel column. */
const MAX_POINTS = 2000;
/** Space a time label needs on the x axis [px]: HH:MM, HH:MM:SS and per digit after the second. */
const LABEL_PX_MINUTES = 50;
const LABEL_PX_SECONDS = 70;
const LABEL_PX_PER_DIGIT = 10;
const DEFAULT_PLOT_PX = 1200;

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
  /** The line: every interval, or the peak per pixel column when there are more intervals than pixels. */
  points: string;
  /** Range between minimum and maximum per pixel column (only when there are more intervals than pixels). */
  band?: string;
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

interface SeriesValues {
  xs: number[];
  values: number[];
  /** Minimum per pixel column; set when the intervals are drawn as a min/max band. */
  low?: number[];
  max: number;
}

/** First index of a sorted array whose value is >= value. */
function lowerBound(sorted: Float64Array, value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sorted[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * Wireshark-like I/O graph of an uploaded capture: packets per interval (1 ms to 10 min) for all
 * frames and for the IP addresses selected in the series table (sent, received or both).
 */
@Component({
  selector: 'app-io-graph',
  standalone: false,
  templateUrl: './io-graph.component.html',
  styleUrls: ['./io-graph.component.css']
})
export class IoGraphComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) graph!: IoGraph;
  /** Test cases of the run, drawn as a strip above the graph when the capture is aligned with CANoe time. */
  @Input() testCases: ScenarioTestCase[] = [];
  @ViewChild('plot') plotElement?: ElementRef<HTMLElement>;

  readonly plotWidth = PLOT_WIDTH;
  readonly plotHeight = PLOT_HEIGHT;
  readonly maxIpSeries = MAX_IP_SERIES;

  series: GraphSeries[] = [];
  searchTerm = '';
  interval = DEFAULT_INTERVAL_US;
  intervalOptions: number[] = INTERVALS_US;
  /** Visible time range [µs after the first packet]. */
  viewFrom = 0;
  viewTo = 1;
  limitMessage: string | null = null;

  lines: PlotLine[] = [];
  yTicks: AxisTick[] = [];
  xTicks: AxisTick[] = [];
  yMax = 1;
  tcSegments: StripSegment[] = [];
  hover: HoverInfo | null = null;
  selection: { left: number; width: number } | null = null;

  private plotPx = DEFAULT_PLOT_PX;
  private resizeObserver?: ResizeObserver;
  private dragStart: number | null = null;
  private allTimes = new Float64Array(0);
  private sentTimes: Float64Array[] = [];
  private receivedTimes: Float64Array[] = [];
  private bothTimes = new Map<number, Float64Array>();

  constructor(private changeDetector: ChangeDetectorRef) {}

  ngOnChanges(): void {
    if (!this.graph) {
      return;
    }
    this.indexPackets();
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
    this.interval = DEFAULT_INTERVAL_US;
    this.viewFrom = 0;
    this.viewTo = this.fullSpan;
    this.refresh();
  }

  /** The number of time labels follows the real width of the graph. */
  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined' || !this.plotElement) {
      return;
    }
    this.resizeObserver = new ResizeObserver(entries => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0 && width !== this.plotPx) {
        this.plotPx = width;
        this.refresh();
        this.changeDetector.markForCheck();
      }
    });
    this.resizeObserver.observe(this.plotElement.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /** End of the full view [µs]: just after the last packet, so it falls into an interval. */
  get fullSpan(): number {
    return Math.round(this.graph.duration_s * 1e6) + 1;
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
    return this.viewFrom > 0 || this.viewTo < this.fullSpan;
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
    const seconds = this.graph.duration_s;
    if (seconds < 60) {
      return `${+seconds.toFixed(1)} s`;
    }
    return seconds < 3600 ? `${+(seconds / 60).toFixed(1)} min` : `${+(seconds / 3600).toFixed(1)} h`;
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
    return this.timesOf(series).length;
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
    for (const series of this.hostSeries.filter(s => !s.enabled)) {
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

  chooseInterval(interval: number): void {
    this.interval = interval;
    this.refresh();
  }

  intervalLabel(us: number): string {
    if (us < 1e6) {
      return `${us / 1000} ms`;
    }
    return us < 6e7 ? `${us / 1e6} s` : `${us / 6e7} min`;
  }

  /** Zooms to a part of the visible range, given as fractions (0..1) of the graph width. */
  zoomTo(fromFraction: number, toFraction: number): void {
    const span = this.viewTo - this.viewFrom;
    let from = this.viewFrom + Math.min(fromFraction, toFraction) * span;
    let to = this.viewFrom + Math.max(fromFraction, toFraction) * span;
    const minimum = Math.min(this.fullSpan, Math.max(4 * this.interval, 4000)); // at least four intervals
    if (to - from < minimum) {
      const middle = (from + to) / 2;
      from = middle - minimum / 2;
      to = middle + minimum / 2;
    }
    if (from < 0) {
      to -= from;
      from = 0;
    }
    if (to > this.fullSpan) {
      from = Math.max(0, from - (to - this.fullSpan));
      to = this.fullSpan;
    }
    this.viewFrom = Math.round(from);
    this.viewTo = Math.round(to);
    this.refresh();
  }

  resetZoom(): void {
    this.viewFrom = 0;
    this.viewTo = this.fullSpan;
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
    if (Math.abs(end - start) > 0.005) {
      this.zoomTo(start, end);
      this.hoverAt(end);
    }
  }

  onPointerLeave(): void {
    this.hover = null;
    this.dragStart = null;
    this.selection = null;
  }

  /** Packets of the interval under the pointer (fraction 0..1 of the graph width), counted exactly. */
  hoverAt(fraction: number): void {
    const span = this.viewTo - this.viewFrom;
    const time = this.viewFrom + fraction * span;
    const start = Math.floor(time / this.interval) * this.interval;
    const end = start + this.interval;
    const left = Math.min(100, Math.max(0, ((start - this.viewFrom) / span) * 100));
    const epoch = this.graph.start_epoch_s + start / 1e6;
    const decimals = this.decimalsFor(this.interval);
    const seconds = Math.max(decimals, 1);
    const canoe = this.graph.canoe_zero_epoch_s;
    this.hover = {
      left,
      flip: left > 60,
      time: `${this.clock(epoch, decimals)} – ${this.clock(epoch + this.interval / 1e6, decimals)}`,
      detail: `${this.date(epoch)} · +${(start / 1e6).toFixed(seconds)} s into the capture` +
        (canoe !== null ? ` · CANoe ${(epoch - canoe).toFixed(seconds)} s` : ''),
      rows: this.series.filter(s => s.enabled).map(s => {
        const times = this.timesOf(s);
        const value = lowerBound(times, end) - lowerBound(times, start);
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

  /** Recomputes the lines, axes and test-case strip after any change of series, interval, zoom or size. */
  refresh(): void {
    const span = this.viewTo - this.viewFrom;
    this.intervalOptions = INTERVALS_US.filter(interval => span / interval >= 2);
    if (this.intervalOptions.length === 0) {
      this.intervalOptions = [INTERVALS_US[0]];
    }
    if (!this.intervalOptions.includes(this.interval)) {
      this.interval = this.intervalOptions.filter(interval => interval <= this.interval).pop() ?? this.intervalOptions[0];
    }

    const computed = this.series.filter(s => s.enabled).map(series => ({ series, values: this.binned(this.timesOf(series)) }));
    const max = Math.max(0, ...computed.map(c => c.values.max));
    const step = this.niceStep(max);
    this.yMax = Math.max(step, Math.ceil(max / step) * step);
    this.yTicks = [];
    for (let value = 0; value <= this.yMax; value += step) {
      this.yTicks.push({ position: (value / this.yMax) * 100, label: String(value) });
    }

    const y = (value: number) => (PLOT_HEIGHT - (value / this.yMax) * PLOT_HEIGHT).toFixed(1);
    this.lines = computed.map(({ series, values }) => {
      const top = values.xs.map((x, i) => `${x.toFixed(1)},${y(values.values[i])}`);
      const low = values.low;
      const bottom = low ? values.xs.map((x, i) => `${x.toFixed(1)},${y(low[i])}`).reverse() : [];
      return {
        key: series.key,
        cssClass: this.seriesClass(series),
        points: top.join(' '),
        band: low ? [...top, ...bottom].join(' ') : undefined
      };
    });
    // keep the 'All packets' line below the IP lines
    this.lines.sort((a, b) => (a.key === ALL_PACKETS ? -1 : b.key === ALL_PACKETS ? 1 : 0));

    this.xTicks = this.timeTicks();
    this.tcSegments = this.testCaseStrip();
    this.hover = null;
  }

  /**
   * Packets per interval in the visible range. With more intervals than pixels, every pixel column gets the
   * minimum and maximum of its intervals, so short bursts stay visible without drawing each interval.
   */
  private binned(times: Float64Array): SeriesValues {
    const { interval, viewFrom: from, viewTo: to } = this;
    const span = to - from;
    const firstBin = Math.floor(from / interval);
    const bins = Math.ceil(to / interval) - firstBin;
    const begin = lowerBound(times, firstBin * interval);
    const end = lowerBound(times, (firstBin + bins) * interval);
    const toX = (time: number) => ((time - from) / span) * PLOT_WIDTH;
    const xs: number[] = [];
    const values: number[] = [];

    if (bins <= MAX_POINTS) {
      const counts = new Uint32Array(bins);
      for (let i = begin; i < end; i++) {
        counts[Math.floor(times[i] / interval) - firstBin]++;
      }
      let max = 0;
      for (let bin = 0; bin < bins; bin++) {
        xs.push(toX((firstBin + bin) * interval));
        values.push(counts[bin]);
        max = Math.max(max, counts[bin]);
      }
      return { xs, values, max };
    }

    const columns = Math.min(bins, Math.max(100, this.plotPx));
    const columnMax = new Uint32Array(columns);
    const columnMin = new Uint32Array(columns).fill(0xffffffff);
    const busyBins = new Uint32Array(columns);
    let bin = -1;
    let count = 0;
    const flush = () => {
      if (count > 0) {
        const column = Math.min(columns - 1, Math.floor(((bin - firstBin) * columns) / bins));
        columnMax[column] = Math.max(columnMax[column], count);
        columnMin[column] = Math.min(columnMin[column], count);
        busyBins[column]++;
      }
    };
    for (let i = begin; i < end; i++) {
      const packetBin = Math.floor(times[i] / interval);
      if (packetBin !== bin) {
        flush();
        bin = packetBin;
        count = 0;
      }
      count++;
    }
    flush();

    const low: number[] = [];
    let max = 0;
    for (let column = 0; column < columns; column++) {
      const binsInColumn = Math.ceil(((column + 1) * bins) / columns) - Math.ceil((column * bins) / columns);
      xs.push(toX((firstBin + ((column + 0.5) * bins) / columns) * interval));
      values.push(columnMax[column]);
      low.push(busyBins[column] === binsInColumn ? columnMin[column] : 0); // an empty interval in the column counts 0
      max = Math.max(max, columnMax[column]);
    }
    return { xs, values, low, max };
  }

  /** Sorted packet times [µs] of a series. */
  private timesOf(series: GraphSeries): Float64Array {
    if (!series.host) {
      return this.allTimes;
    }
    const index = this.graph.hosts.indexOf(series.host);
    if (series.direction === 'src') {
      return this.sentTimes[index];
    }
    if (series.direction === 'dst') {
      return this.receivedTimes[index];
    }
    let both = this.bothTimes.get(index);
    if (!both) {
      const { packet_time_us: times, packet_src: src, packet_dst: dst } = this.graph;
      both = Float64Array.from(times.filter((_, i) => src[i] === index || dst[i] === index));
      this.bothTimes.set(index, both);
    }
    return both;
  }

  private indexPackets(): void {
    const { packet_time_us: times, packet_src: src, packet_dst: dst, hosts } = this.graph;
    const sent: number[][] = hosts.map(() => []);
    const received: number[][] = hosts.map(() => []);
    for (let i = 0; i < times.length; i++) {
      if (src[i] >= 0) {
        sent[src[i]].push(times[i]);
      }
      if (dst[i] >= 0) {
        received[dst[i]].push(times[i]);
      }
    }
    this.allTimes = Float64Array.from(times);
    this.sentTimes = sent.map(list => Float64Array.from(list));
    this.receivedTimes = received.map(list => Float64Array.from(list));
    this.bothTimes.clear();
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

  private niceStep(max: number): number {
    const raw = Math.max(max, 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= raw) ?? raw;
    return Math.max(1, step);
  }

  /**
   * Time labels on round wall-clock times (e.g. 12:27:30), as many as fit the graph width; labels that
   * would stick out at the ends of the axis are left out.
   */
  private timeTicks(): AxisTick[] {
    const span = this.viewTo - this.viewFrom;
    const labelPx = (step: number) =>
      step >= 6e7 ? LABEL_PX_MINUTES : LABEL_PX_SECONDS + LABEL_PX_PER_DIGIT * this.decimalsFor(step);
    const step = TICK_STEPS_US.find(candidate => (span / candidate) * labelPx(candidate) <= this.plotPx)
      ?? TICK_STEPS_US[TICK_STEPS_US.length - 1];
    const from = Math.round(this.graph.start_epoch_s * 1e6) + this.viewFrom;
    const offset = Math.round(this.offsetSeconds(from / 1e6) * 1e6);
    const decimals = step >= 6e7 ? -1 : this.decimalsFor(step);
    const margin = (labelPx(step) / 2 / this.plotPx) * 100;
    const ticks: AxisTick[] = [];
    let lastDate = '';
    for (let tick = Math.ceil((from + offset) / step) * step - offset; tick <= from + span; tick += step) {
      const position = ((tick - from) / span) * 100;
      if (position < margin || position > 100 - margin) {
        continue;
      }
      const date = this.date(tick / 1e6);
      ticks.push({ position, label: this.clock(tick / 1e6, decimals), sub: date !== lastDate ? date : undefined });
      lastDate = date;
    }
    return ticks;
  }

  private testCaseStrip(): StripSegment[] {
    const zero = this.graph.canoe_zero_epoch_s;
    if (zero === null || this.testCases.length === 0) {
      return [];
    }
    const toMicros = (canoeSeconds: number) => (zero + canoeSeconds - this.graph.start_epoch_s) * 1e6;
    const span = this.viewTo - this.viewFrom;
    return this.testCases
      .map(tc => {
        const start = Math.max(this.viewFrom, toMicros(tc.window_start_s));
        const end = Math.min(this.viewTo, toMicros(tc.window_end_s));
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

  /** Digits after the second for a time step: 100 ms -> 1, 10 ms -> 2, 1 ms -> 3. */
  private decimalsFor(stepUs: number): number {
    return stepUs >= 1e6 ? 0 : stepUs >= 1e5 ? 1 : stepUs >= 1e4 ? 2 : 3;
  }

  /** Seconds to add to Unix time to get the wall clock: the bench offset if known, else the browser's. */
  private offsetSeconds(epoch: number): number {
    return this.graph.utc_offset_min !== null
      ? this.graph.utc_offset_min * 60
      : -new Date(epoch * 1000).getTimezoneOffset() * 60;
  }

  private wall(epoch: number): Date {
    return new Date(Math.round((epoch + this.offsetSeconds(epoch)) * 1000));
  }

  /** HH:MM (decimals -1), HH:MM:SS (0) or HH:MM:SS.f.. with the given digits. */
  private clock(epoch: number, decimals: number): string {
    const wall = this.wall(epoch);
    const minutes = `${this.pad(wall.getUTCHours())}:${this.pad(wall.getUTCMinutes())}`;
    if (decimals < 0) {
      return minutes;
    }
    const seconds = `${minutes}:${this.pad(wall.getUTCSeconds())}`;
    return decimals === 0 ? seconds : `${seconds}.${String(wall.getUTCMilliseconds()).padStart(3, '0').slice(0, decimals)}`;
  }

  private date(epoch: number): string {
    const wall = this.wall(epoch);
    return `${this.pad(wall.getUTCDate())}.${this.pad(wall.getUTCMonth() + 1)}.${String(wall.getUTCFullYear()).slice(-2)}`;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private fractionAt(event: MouseEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
  }
}
