import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { EventItem, EventStatus } from '../../core/models';
import { FORMAT_PIPES, inr } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="page-title">Events</h1>
        <p class="page-sub">{{ events().length }} events · Booking {{ totals().booking }} · Pending {{ totals().pending }}</p>
      </div>
      <a routerLink="/events/new" class="btn btn-primary"><app-icon name="plus" [size]="16" />Add Event</a>
    </div>

    <div class="card card-pad mb-6">
      <div class="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div class="lg:col-span-2">
          <label class="label">Search</label>
          <input class="input" placeholder="Event, client, mobile, venue" [(ngModel)]="f.q" (ngModelChange)="debounced()" />
        </div>
        <div>
          <label class="label">Status</label>
          <select class="input" [(ngModel)]="f.status" (ngModelChange)="apply()">
            <option value="">All</option>
            @for (s of statuses; track s) { <option [value]="s">{{ s | label }}</option> }
          </select>
        </div>
        <div>
          <label class="label">Event Type</label>
          <select class="input" [(ngModel)]="f.typeId" (ngModelChange)="apply()">
            <option value="">All</option>
            @for (t of lookups.data().event_types; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
          </select>
        </div>
        <div>
          <label class="label">From</label>
          <input type="date" class="input" [(ngModel)]="f.from" (ngModelChange)="apply()" />
        </div>
        <div>
          <label class="label">To</label>
          <input type="date" class="input" [(ngModel)]="f.to" (ngModelChange)="apply()" />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 mt-4">
        <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" class="rounded text-brand-700" [(ngModel)]="f.pending" (ngModelChange)="apply()" />Only with pending payment</label>
        <span class="flex-1"></span>
        <label class="text-sm text-ink-500">Sort</label>
        <select class="input !w-auto !py-1.5" [(ngModel)]="f.sort" (ngModelChange)="apply()">
          <option value="date_asc">Date (oldest first)</option>
          <option value="date_desc">Date (newest first)</option>
          <option value="name">Event name</option>
          <option value="client">Client name</option>
          <option value="amount_desc">Booking amount</option>
          <option value="created_desc">Recently added</option>
        </select>
        <button class="btn btn-ghost btn-sm" (click)="reset()">Clear filters</button>
      </div>
    </div>

    @if (loading()) { <div class="card card-pad text-center text-ink-400">Loading events...</div> }
    @else if (!events().length) {
      <div class="card card-pad text-center py-16">
        <div class="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mb-4"><app-icon name="event" [size]="26" /></div>
        <p class="font-semibold">No events found</p>
        <p class="text-sm text-ink-500 mt-1">Try changing the filters or add a new event.</p>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="card hidden md:block">
        <div class="table-wrap p-2">
          <table class="table">
            <thead>
              <tr><th>Date</th><th>Event</th><th>Client</th><th>Venue</th><th>Status</th><th class="!text-right">Booking</th><th class="!text-right">Received</th><th class="!text-right">Balance</th><th></th></tr>
            </thead>
            <tbody>
              @for (e of events(); track e.id) {
                <tr>
                  <td class="whitespace-nowrap">
                    <p class="font-medium">{{ e.event_date | dmy }}</p>
                    <p class="text-xs text-ink-500">{{ e.start_time | time12 }}@if (e.end_time) { – {{ e.end_time | time12 }} }</p>
                  </td>
                  <td>
                    <a [routerLink]="['/events', e.id]" class="font-semibold hover:text-brand-700">{{ e.name }}</a>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      @if (e.type_name) { <span class="badge" [style.background]="(e.type_color || '#6b7280') + '1a'" [style.color]="e.type_color">{{ e.type_name }}</span> }
                      @if (e.is_tentative) { <span class="badge bg-gold-50 text-gold-700">Tentative</span> }
                    </div>
                  </td>
                  <td><p>{{ e.client_name }}</p><p class="text-xs text-ink-500">{{ e.client_mobile }}</p></td>
                  <td class="max-w-[180px] truncate">{{ e.venue || '—' }}</td>
                  <td><span class="badge" [class]="e.status | badge">{{ e.status | label }}</span></td>
                  <td class="text-right money">{{ e.booking_amount | inr }}</td>
                  <td class="text-right money text-emerald-700">{{ e.total_received | inr }}</td>
                  <td class="text-right money font-semibold" [class.text-red-600]="e.remaining_balance > 0">{{ e.remaining_balance | inr }}</td>
                  <td class="text-right whitespace-nowrap">
                    <a class="btn-icon" [routerLink]="['/events', e.id]" title="View"><app-icon name="eye" [size]="16" /></a>
                    <a class="btn-icon" [routerLink]="['/events', e.id, 'edit']" title="Edit"><app-icon name="edit" [size]="16" /></a>
                    @if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="remove(e)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden space-y-3">
        @for (e of events(); track e.id) {
          <a [routerLink]="['/events', e.id]" class="card p-4 block">
            <div class="flex justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold truncate">{{ e.name }}</p>
                <p class="text-xs text-ink-500">{{ e.event_date | dmy: true }} · {{ e.client_name }}</p>
              </div>
              <span class="badge h-fit" [class]="e.status | badge">{{ e.status | label }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div><p class="text-ink-400">Booking</p><p class="font-semibold money">{{ e.booking_amount | inr }}</p></div>
              <div><p class="text-ink-400">Received</p><p class="font-semibold money text-emerald-700">{{ e.total_received | inr }}</p></div>
              <div><p class="text-ink-400">Balance</p><p class="font-semibold money text-red-600">{{ e.remaining_balance | inr }}</p></div>
            </div>
          </a>
        }
      </div>
    }
  `,
})
export class EventListComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  auth = inject(AuthService);
  lookups = inject(LookupService);

  statuses: EventStatus[] = ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  events = signal<EventItem[]>([]);
  loading = signal(true);
  f = { q: '', status: '', typeId: '', from: '', to: '', pending: false, sort: 'date_asc' };
  private timer: ReturnType<typeof setTimeout> | undefined;

  totals = computed(() => {
    const list = this.events().filter((e) => e.status !== 'CANCELLED');
    return {
      booking: inr(list.reduce((s, e) => s + e.booking_amount, 0)),
      pending: inr(list.reduce((s, e) => s + Math.max(e.remaining_balance, 0), 0)),
    };
  });

  constructor() {
    this.route.queryParamMap.subscribe((p) => {
      this.f = {
        q: p.get('q') || '', status: p.get('status') || '', typeId: p.get('typeId') || '', from: p.get('from') || '', to: p.get('to') || '',
        pending: p.get('pending') === '1', sort: p.get('sort') || 'date_asc',
      };
      this.load();
    });
  }

  debounced(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(), 300);
  }

  apply(): void {
    const qp: Record<string, string> = {};
    if (this.f.q) qp['q'] = this.f.q;
    if (this.f.status) qp['status'] = this.f.status;
    if (this.f.typeId) qp['typeId'] = String(this.f.typeId);
    if (this.f.from) qp['from'] = this.f.from;
    if (this.f.to) qp['to'] = this.f.to;
    if (this.f.pending) qp['pending'] = '1';
    if (this.f.sort !== 'date_asc') qp['sort'] = this.f.sort;
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
  }

  reset(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.events.set(await this.api.get<EventItem[]>('/events', { ...this.f, pending: this.f.pending ? 1 : '' }));
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  async remove(e: EventItem): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete "${e.name}"?`,
      message: 'The event will be removed from lists, calendar and reports. Its payments and expenses are kept in the database archive.',
      confirmText: 'Delete event',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.delete(`/events/${e.id}`);
      this.toast.success('Event deleted');
      this.load();
    } catch (err) {
      this.toast.fail(err);
    }
  }
}
