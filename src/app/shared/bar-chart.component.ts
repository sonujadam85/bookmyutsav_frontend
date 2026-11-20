import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { inr } from '../core/format';

export interface ChartSeries { name: string; color: string; values: number[]; }

/** Dependency-free responsive SVG bar chart with hover tooltip. */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      @if (series().length > 1) {
        <div class="flex flex-wrap gap-4 mb-3 text-xs text-ink-600">
          @for (s of series(); track s.name) {
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" [style.background]="s.color"></span>{{ s.name }}</span>
          }
        </div>
      }
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="w-full h-auto" role="img" [attr.aria-label]="ariaLabel()">
        @for (t of ticks(); track $index) {
          <svg:line [attr.x1]="padL" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" stroke="#eeeef1" stroke-width="1" />
          <svg:text [attr.x]="padL - 6" [attr.y]="t.y + 3" text-anchor="end" font-size="10" fill="#9191a3">{{ t.label }}</svg:text>
        }
        @for (g of groups(); track g.i) {
          @for (b of g.bars; track b.k) {
            <svg:rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.fill]="b.color" rx="3"
                  [attr.opacity]="hover() === null || hover() === g.i ? 1 : 0.45" />
          }
          <svg:rect [attr.x]="g.x" y="0" [attr.width]="g.w" [attr.height]="H - padB" fill="transparent"
                (mouseenter)="hover.set(g.i)" (mouseleave)="hover.set(null)" />
          <svg:text [attr.x]="g.x + g.w / 2" [attr.y]="H - 6" text-anchor="middle" font-size="10" fill="#737388">{{ g.label }}</svg:text>
        }
      </svg>
      @if (hover() !== null) {
        <div class="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lift">
          <p class="font-semibold mb-1">{{ labels()[hover()!] }}</p>
          @for (s of series(); track s.name) { <p>{{ s.name }}: {{ fmt(s.values[hover()!]) }}</p> }
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  labels = input<string[]>([]);
  series = input<ChartSeries[]>([]);
  ariaLabel = input<string>('Bar chart');
  hover = signal<number | null>(null);

  readonly W = 640;
  readonly H = 220;
  readonly padL = 52;
  readonly padB = 22;

  fmt = inr;

  private max = computed(() => {
    const m = Math.max(0, ...this.series().flatMap((s) => s.values));
    if (m <= 0) return 1000;
    const pow = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / pow) * pow;
  });

  ticks = computed(() => {
    const max = this.max();
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: (this.H - this.padB) * (1 - f) + 4 * f, label: this.short(max * f) }));
  });

  groups = computed(() => {
    const n = this.labels().length || 1;
    const plotW = this.W - this.padL;
    const gw = plotW / n;
    const ser = this.series();
    const inner = gw * 0.7;
    const bw = inner / Math.max(ser.length, 1);
    const plotH = this.H - this.padB - 4;
    return this.labels().map((label, i) => ({
      i, label, x: this.padL + i * gw, w: gw,
      bars: ser.map((s, k) => {
        const v = s.values[i] || 0;
        const h = (v / this.max()) * plotH;
        return { k, x: this.padL + i * gw + (gw - inner) / 2 + k * bw, y: this.H - this.padB - h, w: Math.max(bw - 2, 1), h, color: s.color };
      }),
    }));
  });

  private short(v: number): string {
    if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return String(Math.round(v));
  }
}
