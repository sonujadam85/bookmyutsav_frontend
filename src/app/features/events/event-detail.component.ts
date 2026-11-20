import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { EventItem, EventStatus } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { OverviewTabComponent } from './tabs/overview-tab.component';
import { ScheduleTabComponent } from './tabs/schedule-tab.component';
import { ChecklistTabComponent } from './tabs/checklist-tab.component';
import { DecorTabComponent } from './tabs/decor-tab.component';
import { MaterialsTabComponent } from './tabs/materials-tab.component';
import { ExpensesTabComponent } from './tabs/expenses-tab.component';
import { VendorsTabComponent } from './tabs/vendors-tab.component';
import { PaymentsTabComponent } from './tabs/payments-tab.component';
import { DocumentsTabComponent } from './tabs/documents-tab.component';
import { PnlTabComponent } from './tabs/pnl-tab.component';
import { ServicesTabComponent } from './tabs/services-tab.component';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'eye' },
  { key: 'services', label: 'Services & Prices', icon: 'money' },
  { key: 'schedule', label: 'Event Schedule', icon: 'clock' },
  { key: 'checklist', label: 'Setup Checklist', icon: 'list' },
  { key: 'decoration', label: 'Decoration', icon: 'sparkle' },
  { key: 'materials', label: 'Materials & Inventory', icon: 'box' },
  { key: 'expenses', label: 'Expenses', icon: 'receipt' },
  { key: 'vendors', label: 'Vendors', icon: 'vendor' },
  { key: 'payments', label: 'Client Payments', icon: 'wallet' },
  { key: 'documents', label: 'Documents & Images', icon: 'image' },
  { key: 'pnl', label: 'Profit & Loss', icon: 'trending' },
];

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [
    RouterLink, IconComponent, ...FORMAT_PIPES,
    OverviewTabComponent, ScheduleTabComponent, ChecklistTabComponent, DecorTabComponent, MaterialsTabComponent,
    ExpensesTabComponent, VendorsTabComponent, PaymentsTabComponent, DocumentsTabComponent, PnlTabComponent, ServicesTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!event()) { <div class="card card-pad text-ink-400">Loading event...</div> }
    @if (event(); as e) {
      <a routerLink="/events" class="text-sm text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"><app-icon name="chevronLeft" [size]="16" />All events</a>
      <div class="card mt-2 overflow-hidden">
        <div class="h-1.5" [style.background]="e.type_color || '#002453'"></div>
        <div class="card-pad flex flex-wrap gap-6 justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              @if (e.type_name) { <span class="badge" [style.background]="(e.type_color || '#6b7280') + '1a'" [style.color]="e.type_color">{{ e.type_name }}</span> }
              <span class="badge" [class]="e.status | badge">{{ e.status | label }}</span>
              @if (e.is_tentative) { <span class="badge bg-gold-50 text-gold-700">Tentative date</span> }
            </div>
            <h1 class="page-title mt-2">{{ e.name }}</h1>
            <div class="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-ink-600">
              <span class="inline-flex items-center gap-1.5"><app-icon name="calendar" [size]="15" />{{ e.event_date | dmy: true }}</span>
              @if (e.start_time) { <span class="inline-flex items-center gap-1.5"><app-icon name="clock" [size]="15" />{{ e.start_time | time12 }}@if (e.end_time) { – {{ e.end_time | time12 }} }</span> }
              <span class="inline-flex items-center gap-1.5"><app-icon name="pin" [size]="15" />{{ e.venue || 'Venue not set' }}</span>
              <a [routerLink]="['/clients', e.client_id]" class="inline-flex items-center gap-1.5 hover:text-brand-700"><app-icon name="client" [size]="15" />{{ e.client_name }} · {{ e.client_mobile }}</a>
            </div>
          </div>
          <div class="flex flex-wrap items-start gap-2">
            <select class="input !w-auto !py-2" [value]="e.status" (change)="setStatus($any($event.target).value)" aria-label="Change status">
              @for (s of statuses; track s) { <option [value]="s" [selected]="s === e.status">{{ s | label }}</option> }
            </select>
            <a [routerLink]="['/events', e.id, 'edit']" class="btn btn-secondary"><app-icon name="edit" [size]="16" />Edit</a>
            @if (auth.isAdmin()) { <button class="btn btn-ghost hover:!text-red-600" (click)="remove()"><app-icon name="trash" [size]="16" /></button> }
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 border-t border-ink-100 divide-x divide-ink-100 text-center">
          <div class="p-3"><p class="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Booking</p><p class="font-bold money">{{ e.booking_amount | inr }}</p></div>
          <div class="p-3"><p class="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Received</p><p class="font-bold money text-emerald-700">{{ e.total_received | inr }}</p></div>
          <div class="p-3"><p class="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Balance</p><p class="font-bold money" [class.text-red-600]="e.remaining_balance > 0">{{ e.remaining_balance | inr }}</p></div>
          <div class="p-3"><p class="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Expenses</p><p class="font-bold money">{{ e.total_expenses | inr }}</p></div>
        </div>
      </div>

      <nav class="flex gap-1 overflow-x-auto mt-6 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist">
        @for (t of visibleTabs(); track t.key) {
          <button role="tab" class="tab inline-flex items-center gap-1.5" [class.tab-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="selectTab(t.key)">
            <app-icon [name]="t.icon" [size]="15" />{{ t.label }}
          </button>
        }
      </nav>

      <div class="mt-4">
        @switch (tab()) {
          @case ('overview') { <app-overview-tab [event]="e" (goTab)="selectTab($event)" /> }
          @case ('services') { <app-services-tab [event]="e" (changed)="reload()" /> }
          @case ('schedule') { <app-schedule-tab [event]="e" (changed)="reload()" /> }
          @case ('checklist') { <app-checklist-tab [eventId]="e.id" (changed)="reload()" /> }
          @case ('decoration') { <app-decor-tab [eventId]="e.id" /> }
          @case ('materials') { <app-materials-tab [event]="e" (changed)="reload()" /> }
          @case ('expenses') { <app-expenses-tab [event]="e" (changed)="reload()" /> }
          @case ('vendors') { <app-vendors-tab [event]="e" (changed)="reload()" /> }
          @case ('payments') { <app-payments-tab [event]="e" (changed)="reload()" /> }
          @case ('documents') { <app-documents-tab [eventId]="e.id" (changed)="reload()" /> }
          @case ('pnl') { <app-pnl-tab [eventId]="e.id" /> }
        }
      </div>
    }
  `,
})
export class EventDetailComponent {
  id = input.required<string>();
  /** ?tab=payments etc. */
  tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  auth = inject(AuthService);

  statuses: EventStatus[] = ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  event = signal<EventItem | null>(null);
  tab = signal('overview');

  visibleTabs = () => (this.auth.isAdmin() ? TABS : TABS.filter((t) => t.key !== 'pnl'));

  constructor() {
    effect(() => {
      const t = this.tabParam();
      if (t && TABS.some((x) => x.key === t)) this.tab.set(t);
    });
    effect(() => {
      const id = this.id();
      if (id) this.reload();
    });
  }

  selectTab(key: string): void {
    this.tab.set(key);
    this.router.navigate([], { queryParams: { tab: key }, replaceUrl: true });
  }

  async reload(): Promise<void> {
    try {
      this.event.set(await this.api.get<EventItem>(`/events/${this.id()}`));
    } catch (e) {
      this.toast.fail(e);
      this.router.navigate(['/events']);
    }
  }

  async setStatus(status: EventStatus): Promise<void> {
    const e = this.event();
    if (!e || status === e.status) return;
    if (status === 'CANCELLED' && !(await this.confirm.ask({ title: 'Cancel this event?', message: 'It will be excluded from bookings, pending payments and profit totals. You can change the status back later.', confirmText: 'Mark cancelled', danger: true }))) {
      this.event.set({ ...e });
      return;
    }
    try {
      this.event.set(await this.api.patch<EventItem>(`/events/${e.id}/status`, { status }));
      this.toast.success(`Status changed to ${status.replace('_', ' ').toLowerCase()}`);
    } catch (err) {
      this.toast.fail(err);
    }
  }

  async remove(): Promise<void> {
    const e = this.event();
    if (!e) return;
    const ok = await this.confirm.ask({
      title: `Delete "${e.name}"?`,
      message: 'The event will disappear from lists, the calendar and reports. Its payment and expense records stay archived in the database.',
      confirmText: 'Delete event',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.delete(`/events/${e.id}`);
      this.toast.success('Event deleted');
      this.router.navigate(['/events']);
    } catch (err) {
      this.toast.fail(err);
    }
  }
}
