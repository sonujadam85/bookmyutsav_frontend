import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { CalendarEntry, EventItem } from '../../core/models';
import { FORMAT_PIPES, isoDate, parseDate, today } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

type View = 'month' | 'week' | 'day';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="page-title">Event Calendar</h1>
        <p class="page-sub">Click a date to add an event · click an event to see details.</p>
      </div>
      <a routerLink="/events/new" [queryParams]="{ date: cursor() }" class="btn btn-primary"><app-icon name="plus" [size]="16" />New Event</a>
    </div>

    <div class="card card-pad">
      <div class="flex flex-wrap items-center gap-3 mb-5">
        <div class="flex items-center gap-1">
          <button class="btn-icon" (click)="move(-1)" aria-label="Previous"><app-icon name="chevronLeft" /></button>
          <button class="btn btn-secondary btn-sm" (click)="go(today)">Today</button>
          <button class="btn-icon" (click)="move(1)" aria-label="Next"><app-icon name="chevronRight" /></button>
        </div>
        <h2 class="text-lg font-semibold min-w-[200px]">{{ title() }}</h2>
        <span class="flex-1"></span>
        <select class="input !w-auto !py-2" [ngModel]="typeId()" (ngModelChange)="typeId.set($event)" aria-label="Filter by type">
          <option value="">All types</option>
          @for (t of lookups.data().event_types; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
        </select>
        <select class="input !w-auto !py-2" [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="UPCOMING">Upcoming</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
        </select>
        <div class="inline-flex rounded-xl bg-ink-100 p-1">
          @for (v of views; track v) {
            <button class="px-3 py-1.5 text-sm font-medium rounded-lg capitalize" [class]="view() === v ? 'bg-white shadow-sm text-ink-900' : 'text-ink-600'" (click)="setView(v)">{{ v }}</button>
          }
        </div>
      </div>

      <!-- Month view -->
      @if (view() === 'month') {
        <div class="grid grid-cols-7 text-xs font-semibold text-ink-500 uppercase tracking-wider border-b border-ink-100">
          @for (w of weekdays; track w) { <div class="py-2 px-2">{{ w }}</div> }
        </div>
        <div class="grid grid-cols-7">
          @for (c of monthCells(); track c.date) {
            <div class="min-h-[92px] sm:min-h-[118px] border-b border-r border-ink-100 p-1 sm:p-1.5 cursor-pointer hover:bg-brand-50/40 transition group"
                 [class.bg-ink-50]="!c.inMonth" (click)="addOn(c.date)" [attr.aria-label]="'Add event on ' + c.date">
              <div class="flex items-center justify-between">
                <button class="w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center"
                        [class]="c.date === today ? 'bg-brand-800 text-white' : c.inMonth ? 'text-ink-800 hover:bg-ink-200' : 'text-ink-300'"
                        (click)="$event.stopPropagation(); openDay(c.date)">{{ c.day }}</button>
                <span class="opacity-0 group-hover:opacity-100 text-brand-700 hidden sm:inline"><app-icon name="plus" [size]="14" /></span>
              </div>
              <div class="space-y-0.5 mt-0.5">
                @for (e of c.entries.slice(0, 3); track e.kind + e.event_id + '-' + (e.function_id || 0)) {
                  <button class="w-full text-left rounded-md px-1.5 py-0.5 text-[11px] leading-tight truncate block border-l-[3px]"
                          [style.borderColor]="e.color" [style.background]="e.color + '18'" [class.opacity-50]="e.status === 'CANCELLED'"
                          (click)="$event.stopPropagation(); show(e)" [title]="e.title + ' · ' + e.client_name">
                    <span class="hidden sm:inline font-semibold">{{ e.start_time | time12 }} </span>{{ e.title }}
                    <span class="hidden lg:inline text-ink-500"> · {{ e.client_name }}</span>
                  </button>
                }
                @if (c.entries.length > 3) {
                  <button class="text-[11px] font-semibold text-brand-700 px-1.5" (click)="$event.stopPropagation(); openDay(c.date)">+{{ c.entries.length - 3 }} more</button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Week view -->
      @if (view() === 'week') {
        <div class="grid grid-cols-1 sm:grid-cols-7 gap-2">
          @for (c of weekCells(); track c.date) {
            <div class="rounded-xl border border-ink-100 min-h-[260px] flex flex-col" [class.ring-2]="c.date === today" [class.ring-brand-300]="c.date === today">
              <button class="px-3 py-2 border-b border-ink-100 text-left hover:bg-ink-50 rounded-t-xl" (click)="openDay(c.date)">
                <p class="text-[11px] uppercase font-semibold text-ink-400">{{ c.weekday }}</p>
                <p class="text-lg font-bold">{{ c.day }}</p>
              </button>
              <div class="p-2 space-y-1.5 flex-1">
                @for (e of c.entries; track e.kind + e.event_id + '-' + (e.function_id || 0)) {
                  <button class="w-full text-left rounded-lg p-2 text-xs border-l-4" [style.borderColor]="e.color" [style.background]="e.color + '14'" (click)="show(e)">
                    <p class="font-semibold">{{ e.start_time | time12 }}</p>
                    <p class="font-medium text-ink-900">{{ e.title }}</p>
                    <p class="text-ink-500 truncate">{{ e.client_name }}</p>
                    <p class="text-ink-400 truncate">{{ e.venue || '' }}</p>
                  </button>
                }
              </div>
              <button class="m-2 btn btn-ghost btn-sm" (click)="addOn(c.date)"><app-icon name="plus" [size]="14" />Add</button>
            </div>
          }
        </div>
      }

      <!-- Day view -->
      @if (view() === 'day') {
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-ink-500">{{ dayEntries().length }} booking(s) on this date. Multiple events on the same date are allowed.</p>
          <button class="btn btn-secondary btn-sm" (click)="addOn(cursor())"><app-icon name="plus" [size]="14" />Add event on this date</button>
        </div>
        <div class="space-y-3">
          @for (e of dayEntries(); track e.kind + e.event_id + '-' + (e.function_id || 0)) {
            <button class="w-full text-left flex gap-4 rounded-2xl border border-ink-100 p-4 hover:shadow-soft transition" (click)="show(e)">
              <div class="w-20 shrink-0 text-center">
                <p class="text-sm font-bold">{{ (e.start_time | time12) || '—' }}</p>
                <p class="text-xs text-ink-400">{{ e.end_time | time12 }}</p>
              </div>
              <div class="w-1 rounded-full" [style.background]="e.color"></div>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-semibold">{{ e.title }}</p>
                  @if (e.kind === 'function') { <span class="chip">Function of {{ e.event_name }}</span> }
                  <span class="badge" [class]="e.status | badge">{{ e.status | label }}</span>
                  @if (e.is_tentative) { <span class="badge bg-gold-50 text-gold-700">Tentative</span> }
                </div>
                <p class="text-sm text-ink-600 mt-1">{{ e.client_name }} · {{ e.client_mobile }}</p>
                <p class="text-sm text-ink-500">{{ e.venue || 'Venue not set' }}</p>
              </div>
            </button>
          } @empty { <div class="text-center py-12 text-ink-400">No events on this date.</div> }
        </div>
      }

      <!-- Legend -->
      <div class="flex flex-wrap gap-x-4 gap-y-2 mt-5 text-xs text-ink-600">
        @for (t of lookups.data().event_types; track t.id) {
          <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded" [style.background]="t.color"></span>{{ t.name }}</span>
        }
      </div>
    </div>

    <app-modal [open]="!!selected()" [title]="selected()?.title || ''" [subtitle]="selected()?.kind === 'function' ? 'Function of ' + selected()?.event_name : (selected()?.type_name || '')" (closed)="selected.set(null)">
      @if (selected(); as s) {
        @if (detail(); as d) {
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div><dt class="label">Date</dt><dd>{{ s.date | dmy: true }}</dd></div>
            <div><dt class="label">Time</dt><dd>{{ (s.start_time | time12) || '—' }}@if (s.end_time) { – {{ s.end_time | time12 }} }</dd></div>
            <div><dt class="label">Client</dt><dd>{{ d.client_name }}<br /><a class="text-brand-700" [href]="'tel:' + d.client_mobile">{{ d.client_mobile }}</a></dd></div>
            <div><dt class="label">Status</dt><dd><span class="badge" [class]="s.status | badge">{{ s.status | label }}</span></dd></div>
            <div class="col-span-2"><dt class="label">Venue</dt><dd>{{ s.venue || '—' }}@if (d.address) { <br /><span class="text-ink-500">{{ d.address }}</span> }</dd></div>
            <div><dt class="label">Guests</dt><dd>{{ d.guests ?? '—' }}</dd></div>
            <div><dt class="label">Booking</dt><dd class="money font-semibold">{{ d.booking_amount | inr }}</dd></div>
            <div><dt class="label">Received</dt><dd class="money text-emerald-700">{{ d.total_received | inr }}</dd></div>
            <div><dt class="label">Balance</dt><dd class="money text-red-600 font-semibold">{{ d.remaining_balance | inr }}</dd></div>
            @if (d.special_instructions) { <div class="col-span-2"><dt class="label">Special Instructions</dt><dd class="whitespace-pre-line">{{ d.special_instructions }}</dd></div> }
            @if (d.functions?.length) {
              <div class="col-span-2"><dt class="label">All Functions</dt>
                <dd class="space-y-1">@for (f of d.functions; track f.id) { <p>{{ f.function_date | dmy }} · {{ f.name }} {{ f.start_time | time12 }}</p> }</dd>
              </div>
            }
          </dl>
        } @else { <p class="text-ink-400">Loading details...</p> }
      }
      <div footer>
        <button class="btn btn-secondary" (click)="selected.set(null)">Close</button>
        @if (selected(); as s) {
          <a class="btn btn-secondary" [routerLink]="['/events', s.event_id, 'edit']">Edit</a>
          <a class="btn btn-primary" [routerLink]="['/events', s.event_id]">Open Event</a>
        }
      </div>
    </app-modal>
  `,
})
export class CalendarComponent {
  /** query params */
  date = input<string>();
  viewParam = input<string | undefined>(undefined, { alias: 'view' });

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  lookups = inject(LookupService);

  readonly today = today();
  readonly weekdays = WEEKDAYS;
  readonly views: View[] = ['month', 'week', 'day'];
  view = signal<View>('month');
  cursor = signal(today());
  typeId = signal('');
  status = signal('');
  entries = signal<CalendarEntry[]>([]);
  selected = signal<CalendarEntry | null>(null);
  detail = signal<EventItem | null>(null);

  private range = computed(() => {
    const c = parseDate(this.cursor());
    if (this.view() === 'day') return { from: this.cursor(), to: this.cursor() };
    if (this.view() === 'week') {
      const s = new Date(c);
      s.setDate(c.getDate() - c.getDay());
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { from: isoDate(s), to: isoDate(e) };
    }
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const s = new Date(first);
    s.setDate(1 - first.getDay());
    const e = new Date(s);
    e.setDate(s.getDate() + 41);
    return { from: isoDate(s), to: isoDate(e) };
  });

  private byDate = computed(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of this.entries()) m.set(e.date, [...(m.get(e.date) || []), e]);
    return m;
  });

  title = computed(() => {
    const c = parseDate(this.cursor());
    if (this.view() === 'month') return c.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (this.view() === 'day') return c.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const r = this.range();
    return `${parseDate(r.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${parseDate(r.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  });

  monthCells = computed(() => {
    const r = this.range();
    const month = parseDate(this.cursor()).getMonth();
    const start = parseDate(r.from);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = isoDate(d);
      return { date, day: d.getDate(), inMonth: d.getMonth() === month, entries: this.byDate().get(date) || [] };
    });
  });

  weekCells = computed(() => {
    const start = parseDate(this.range().from);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const date = isoDate(d);
      return { date, day: d.getDate(), weekday: WEEKDAYS[d.getDay()], entries: this.byDate().get(date) || [] };
    });
  });

  dayEntries = computed(() => this.byDate().get(this.cursor()) || []);

  constructor() {
    this.lookups.load();
    effect(() => {
      const d = this.date();
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) this.cursor.set(d);
      const v = this.viewParam();
      if (v === 'month' || v === 'week' || v === 'day') this.view.set(v);
    });
    effect(() => {
      const r = this.range();
      const typeId = this.typeId();
      const status = this.status();
      this.api
        .get<CalendarEntry[]>('/calendar', { from: r.from, to: r.to, typeId, status })
        .then((e) => this.entries.set(e))
        .catch((e) => this.toast.fail(e));
    });
  }

  setView(v: View): void {
    this.view.set(v);
  }

  go(date: string): void {
    this.cursor.set(date);
  }

  move(step: number): void {
    const c = parseDate(this.cursor());
    if (this.view() === 'month') c.setMonth(c.getMonth() + step, 1);
    else c.setDate(c.getDate() + step * (this.view() === 'week' ? 7 : 1));
    this.cursor.set(isoDate(c));
  }

  openDay(date: string): void {
    this.cursor.set(date);
    this.view.set('day');
  }

  addOn(date: string): void {
    this.router.navigate(['/events/new'], { queryParams: { date } });
  }

  async show(e: CalendarEntry): Promise<void> {
    this.selected.set(e);
    this.detail.set(null);
    try {
      this.detail.set(await this.api.get<EventItem>(`/events/${e.event_id}`));
    } catch (err) {
      this.toast.fail(err);
    }
  }
}
