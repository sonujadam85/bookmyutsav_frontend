import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { ClientPayment, EventFunction, EventItem } from '../../core/models';
import { FORMAT_PIPES, isoDate, parseDate } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { BarChartComponent } from '../../shared/bar-chart.component';

interface Dashboard {
  today: string;
  stats: Record<string, number | null>;
  vendor_pending: number;
  upcoming_events: EventItem[];
  todays_events: EventItem[];
  todays_functions: (EventFunction & { event_name: string; client_name: string; venue_name: string })[];
  recent_payments: (ClientPayment & { event_name: string; client_name: string })[];
  pending_payments: EventItem[];
  charts: { months: string[]; revenue: number[]; bookings: number[]; expenses: number[] };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent, BarChartComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">{{ greeting() }}, {{ auth.user()?.name }}. Here is how your events are doing.</p>
      </div>
      <div class="flex gap-2">
        <a routerLink="/calendar" class="btn btn-secondary"><app-icon name="calendar" [size]="16" />Calendar</a>
        <a routerLink="/events/new" class="btn btn-primary"><app-icon name="plus" [size]="16" />New Event</a>
      </div>
    </div>

    @if (loading() && !data()) {
      <div class="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        @for (i of [1,2,3,4,5,6,7,8,9]; track i) { <div class="stat h-24 animate-pulse bg-ink-100/60"></div> }
      </div>
    }

    @if (data(); as d) {
      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        <a routerLink="/events" class="stat hover:shadow-lift transition">
          <span class="stat-label">Total Events</span><span class="stat-value">{{ d.stats['total_events'] }}</span>
        </a>
        <a routerLink="/events" [queryParams]="{ status: 'UPCOMING' }" class="stat hover:shadow-lift transition">
          <span class="stat-label">Upcoming</span><span class="stat-value text-blue-700">{{ d.stats['upcoming_events'] }}</span>
        </a>
        <a routerLink="/calendar" class="stat hover:shadow-lift transition">
          <span class="stat-label">This Month</span><span class="stat-value">{{ d.stats['events_this_month'] }}</span>
        </a>
        <a routerLink="/events" [queryParams]="{ status: 'COMPLETED' }" class="stat hover:shadow-lift transition">
          <span class="stat-label">Completed</span><span class="stat-value text-emerald-700">{{ d.stats['completed_events'] }}</span>
        </a>
        <div class="stat"><span class="stat-label">Total Booking</span><span class="stat-value money">{{ d.stats['total_booking_amount'] | inr }}</span></div>
        <a routerLink="/payments" class="stat hover:shadow-lift transition">
          <span class="stat-label">Advance / Received</span><span class="stat-value money text-emerald-700">{{ d.stats['total_advance_received'] | inr }}</span>
        </a>
        <a routerLink="/events" [queryParams]="{ pending: 1 }" class="stat hover:shadow-lift transition">
          <span class="stat-label">Pending Payments</span><span class="stat-value money text-red-600">{{ d.stats['total_pending_payments'] | inr }}</span>
        </a>
        <a routerLink="/expenses" class="stat hover:shadow-lift transition">
          <span class="stat-label">Event Expenses</span><span class="stat-value money">{{ d.stats['total_event_expenses'] | inr }}</span>
        </a>
        @if (d.stats['total_profit'] !== null) {
          <div class="stat bg-gradient-to-br from-brand-900 to-brand-700 !border-0 text-white">
            <span class="stat-label !text-brand-200">Total Profit</span><span class="stat-value money !text-white">{{ d.stats['total_profit'] | inr }}</span>
          </div>
        }
        <a routerLink="/vendors" [queryParams]="{ pending: 1 }" class="stat hover:shadow-lift transition">
          <span class="stat-label">Vendor Pending</span><span class="stat-value money text-gold-600">{{ d.vendor_pending | inr }}</span>
        </a>
      </div>

      <!-- Today -->
      @if (d.todays_events.length || d.todays_functions.length) {
        <div class="card card-pad mt-6 border-gold-200 bg-gold-50/50">
          <h2 class="card-title flex items-center gap-2"><app-icon name="sparkle" class="text-gold-600" />Today's Events</h2>
          <div class="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (e of d.todays_events; track e.id) {
              <a [routerLink]="['/events', e.id]" class="rounded-xl bg-white border border-ink-100 p-4 hover:shadow-soft">
                <p class="font-semibold">{{ e.name }}</p>
                <p class="text-sm text-ink-500">{{ e.client_name }} · {{ e.start_time | time12 }}</p>
                <p class="text-xs text-ink-400 mt-1">{{ e.venue || 'Venue not set' }}</p>
              </a>
            }
            @for (f of d.todays_functions; track f.id) {
              <a [routerLink]="['/events', f.event_id]" [queryParams]="{ tab: 'schedule' }" class="rounded-xl bg-white border border-ink-100 p-4 hover:shadow-soft">
                <p class="font-semibold">{{ f.name }} <span class="chip ml-1">Function</span></p>
                <p class="text-sm text-ink-500">{{ f.event_name }} · {{ f.start_time | time12 }}</p>
                <p class="text-xs text-ink-400 mt-1">{{ f.venue_name || 'Venue not set' }}</p>
              </a>
            }
          </div>
        </div>
      }

      <div class="grid xl:grid-cols-3 gap-6 mt-6">
        <!-- Charts -->
        <div class="card card-pad xl:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h2 class="card-title">Monthly Revenue &amp; Expenses</h2>
            <span class="text-xs text-ink-400">Last 12 months</span>
          </div>
          <app-bar-chart [labels]="monthLabels()" ariaLabel="Monthly revenue and expenses"
            [series]="[{ name: 'Payments received', color: '#812a57', values: d.charts.revenue }, { name: 'Bookings (by event date)', color: '#ebc455', values: d.charts.bookings }]" />
          <div class="mt-6">
            <h3 class="text-sm font-semibold text-ink-700 mb-2">Monthly Expenses</h3>
            <app-bar-chart [labels]="monthLabels()" ariaLabel="Monthly expenses" [series]="[{ name: 'Expenses', color: '#5d5d70', values: d.charts.expenses }]" />
          </div>
        </div>

        <!-- Mini calendar -->
        <div class="card card-pad">
          <div class="flex items-center justify-between mb-3">
            <h2 class="card-title">{{ monthTitle() }}</h2>
            <a routerLink="/calendar" class="text-xs font-semibold text-brand-700 hover:underline">Open calendar</a>
          </div>
          <div class="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-400 mb-1">
            @for (w of ['S','M','T','W','T','F','S']; track $index) { <span>{{ w }}</span> }
          </div>
          <div class="grid grid-cols-7 gap-1">
            @for (c of miniCal(); track $index) {
              @if (c) {
                <a [routerLink]="'/calendar'" [queryParams]="{ date: c.date, view: 'day' }"
                   class="aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative"
                   [class]="c.date === d.today ? 'bg-brand-800 text-white font-semibold' : 'hover:bg-ink-100'">
                  {{ c.day }}
                  @if (c.count) { <span class="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-gold-400"></span> }
                </a>
              } @else { <span></span> }
            }
          </div>
          <h3 class="text-sm font-semibold mt-5 mb-2">Upcoming Events</h3>
          <ul class="divide-y divide-ink-100">
            @for (e of d.upcoming_events; track e.id) {
              <li>
                <a [routerLink]="['/events', e.id]" class="flex items-center gap-3 py-2.5 hover:bg-ink-50 -mx-2 px-2 rounded-lg">
                  <div class="w-11 text-center shrink-0 rounded-lg py-1" [style.background]="(e.type_color || '#6b7280') + '1a'" [style.color]="e.type_color || '#6b7280'">
                    <p class="text-[10px] font-semibold uppercase">{{ monthShort(e.event_date) }}</p>
                    <p class="text-base font-bold leading-none">{{ e.event_date.slice(8, 10) }}</p>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold truncate">{{ e.name }}</p>
                    <p class="text-xs text-ink-500 truncate">{{ e.client_name }} · {{ e.venue || 'Venue TBD' }}</p>
                  </div>
                  @if (e.is_tentative) { <span class="badge bg-gold-50 text-gold-700">Tentative</span> }
                </a>
              </li>
            } @empty { <li class="text-sm text-ink-400 py-4 text-center">No upcoming events</li> }
          </ul>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-6 mt-6">
        <div class="card card-pad">
          <div class="flex items-center justify-between mb-3">
            <h2 class="card-title">Recent Payments</h2>
            <a routerLink="/payments" class="text-xs font-semibold text-brand-700 hover:underline">View all</a>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Date</th><th>Client / Event</th><th>Mode</th><th class="!text-right">Amount</th></tr></thead>
              <tbody>
                @for (p of d.recent_payments; track p.id) {
                  <tr>
                    <td class="whitespace-nowrap">{{ p.payment_date | dmy }}</td>
                    <td><p class="font-medium">{{ p.client_name }}</p><p class="text-xs text-ink-500">{{ p.event_name }}</p></td>
                    <td><span class="chip">{{ p.mode | label }}</span></td>
                    <td class="text-right font-semibold money text-emerald-700">{{ p.amount | inr }}</td>
                  </tr>
                } @empty { <tr><td colspan="4" class="text-center text-ink-400 py-6">No payments yet</td></tr> }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-pad">
          <div class="flex items-center justify-between mb-3">
            <h2 class="card-title">Pending Payments</h2>
            <a routerLink="/events" [queryParams]="{ pending: 1 }" class="text-xs font-semibold text-brand-700 hover:underline">View all</a>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Event</th><th>Date</th><th class="!text-right">Booking</th><th class="!text-right">Pending</th></tr></thead>
              <tbody>
                @for (e of d.pending_payments; track e.id) {
                  <tr class="cursor-pointer" [routerLink]="['/events', e.id]" [queryParams]="{ tab: 'payments' }">
                    <td><p class="font-medium">{{ e.name }}</p><p class="text-xs text-ink-500">{{ e.client_name }} · {{ e.client_mobile }}</p></td>
                    <td class="whitespace-nowrap">{{ e.event_date | dmy }}</td>
                    <td class="text-right money">{{ e.booking_amount | inr }}</td>
                    <td class="text-right money font-semibold text-red-600">{{ e.remaining_balance | inr }}</td>
                  </tr>
                } @empty { <tr><td colspan="4" class="text-center text-ink-400 py-6">Nothing pending</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  data = signal<Dashboard | null>(null);
  loading = signal(true);
  private monthEvents = signal<Record<string, number>>({});

  greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  monthLabels = computed(() => (this.data()?.charts.months || []).map((m) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`));
  monthTitle = computed(() => new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));

  miniCal = computed(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const counts = this.monthEvents();
    const cells: ({ day: number; date: string; count: number } | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= days; d++) {
      const date = isoDate(new Date(now.getFullYear(), now.getMonth(), d));
      cells.push({ day: d, date, count: counts[date] || 0 });
    }
    return cells;
  });

  constructor() {
    this.load();
  }

  monthShort(d: string): string {
    return MONTHS[parseDate(d).getMonth()];
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const now = new Date();
      const from = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const [d, cal] = await Promise.all([
        this.api.get<Dashboard>('/dashboard'),
        this.api.get<{ date: string }[]>('/calendar', { from, to }),
      ]);
      const counts: Record<string, number> = {};
      for (const c of cal) counts[c.date] = (counts[c.date] || 0) + 1;
      this.monthEvents.set(counts);
      this.data.set(d);
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.loading.set(false);
    }
  }
}
