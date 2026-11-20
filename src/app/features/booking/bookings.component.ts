import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { EventItem, EventServiceItem } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { groupByCategory, photoUrl } from '../../core/service-images';
import { quotationPdf } from '../../core/services-pdf';
import { IconComponent } from '../../shared/icon.component';
import { LightboxComponent, LightboxItem } from '../../shared/lightbox.component';

interface Booking extends EventItem {
  is_online: number; items: (EventServiceItem & { id: number; amount: number })[]; subtotal: number; discount: number; services_total: number;
}

/** All events that have services, as cards with the chosen photos and prices. */
@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [RouterLink, IconComponent, LightboxComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 class="page-title">Booked Events</h1>
        <p class="page-sub">{{ list().length }} bookings · Total {{ sum() | inr }}@if (onlineCount()) { · {{ onlineCount() }} online }</p>
      </div>
      <div class="flex gap-2">
        <a [href]="auth.bookingPath()" target="_blank" rel="noopener" class="btn btn-secondary"><app-icon name="eye" [size]="16" />Client booking page</a>
        <a routerLink="/events/new" class="btn btn-primary"><app-icon name="plus" [size]="16" />Add Event</a>
      </div>
    </div>

    <div class="card card-pad mb-6 flex flex-wrap items-center gap-3">
      <label class="relative block w-full sm:w-72">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><app-icon name="search" [size]="16" /></span>
        <input class="input !py-2 pl-9" placeholder="Event, client, mobile, venue" [value]="q()" (input)="search($any($event.target).value)" />
      </label>
      <div class="flex gap-1 rounded-xl bg-ink-100 p-1" role="group" aria-label="When">
        @for (w of whens; track w.key) {
          <button type="button" class="tab !py-1.5" [class.tab-active]="when() === w.key" (click)="set(when, w.key)">{{ w.label }}</button>
        }
      </div>
      <div class="flex gap-1 rounded-xl bg-ink-100 p-1" role="group" aria-label="Source">
        @for (s of sources; track s.key) {
          <button type="button" class="tab !py-1.5" [class.tab-active]="source() === s.key" (click)="set(source, s.key)">{{ s.label }}</button>
        }
      </div>
      <span class="flex-1"></span>
      <select class="input !w-auto !py-1.5" [value]="sort()" (change)="set(sort, $any($event.target).value)" aria-label="Sort">
        <option value="date">By event date</option>
        <option value="newest">Newest booking first</option>
      </select>
    </div>

    @if (loading()) { <div class="card card-pad text-ink-400">Loading bookings...</div> }
    <div class="grid gap-5 grid-cols-1 xl:grid-cols-2">
      @for (b of list(); track b.id) {
        <article class="card overflow-hidden flex flex-col">
          <div class="h-1.5" [style.background]="b.type_color || '#002453'"></div>
          <div class="p-4 sm:p-5 flex flex-col gap-3 flex-1">
            <div class="flex flex-wrap items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap gap-1.5 mb-1">
                  <span class="badge" [class]="b.status | badge">{{ b.status | label }}</span>
                  @if (b.is_online) { <span class="badge bg-blue-50 text-blue-700">Online booking</span> }
                  @if (b.is_tentative) { <span class="badge bg-gold-50 text-gold-700">To confirm</span> }
                </div>
                <a [routerLink]="['/events', b.id]" class="text-lg font-semibold hover:text-brand-700 leading-snug">{{ b.name }}</a>
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-ink-600">
                  <span class="inline-flex items-center gap-1.5"><app-icon name="calendar" [size]="14" />{{ b.event_date | dmy: true }}</span>
                  <span class="inline-flex items-center gap-1.5"><app-icon name="client" [size]="14" />{{ b.client_name }}</span>
                  <a class="inline-flex items-center gap-1.5 hover:text-brand-700" [href]="'tel:' + b.client_mobile"><app-icon name="phone" [size]="14" />{{ b.client_mobile }}</a>
                  @if (b.venue) { <span class="inline-flex items-center gap-1.5"><app-icon name="pin" [size]="14" />{{ b.venue }}</span> }
                </div>
              </div>
              <div class="text-right">
                <p class="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Total</p>
                <p class="text-2xl font-bold text-brand-700 money">{{ b.services_total | inr }}</p>
                @if (b.booking_amount !== b.services_total) { <p class="text-[11px] text-ink-500">Booking amount {{ b.booking_amount | inr }}</p> }
              </div>
            </div>

            <!-- Photos of the chosen setups -->
            @if (photos(b).length) {
              <div class="flex gap-2 overflow-x-auto pb-1">
                @for (i of photos(b); track i.id; let n = $index) {
                  <button type="button" class="relative shrink-0 w-28 h-24 rounded-xl bg-ink-100 bg-cover bg-center cursor-zoom-in overflow-hidden"
                          [style.background-image]="'url(' + url(i.photo_id!) + ')'" (click)="view(b, n)" [attr.aria-label]="'View ' + i.name">
                    <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/80 to-transparent text-white text-[11px] px-2 pt-4 pb-1 text-left leading-tight">
                      <span class="block truncate">{{ i.name }}</span><b class="money">{{ i.amount | inr }}</b>
                    </span>
                  </button>
                }
              </div>
            }

            <table class="w-full text-sm">
              <tbody>
                @for (g of grouped(b); track g.name) {
                <tr><td colspan="3" class="pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-brand-700">{{ g.name }}</td></tr>
                @for (i of g.items; track i.id) {
                  <tr class="border-b border-dashed border-ink-100 last:border-0">
                    <td class="py-1.5 pr-2">{{ i.name }}@if (i.variant_label) { <span class="text-ink-500"> ({{ i.variant_label }})</span> }</td>
                    <td class="py-1.5 px-2 text-right text-ink-500 whitespace-nowrap">{{ i.unit_price | inr }}@if (i.quantity !== 1) { × {{ i.quantity }} }</td>
                    <td class="py-1.5 pl-2 text-right font-semibold money">{{ i.amount | inr }}</td>
                  </tr>
                }
                }
              </tbody>
            </table>

            <div class="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-ink-100 text-sm">
              @if (b.discount) { <span class="text-ink-500">Subtotal {{ b.subtotal | inr }} · Discount −{{ b.discount | inr }}</span> }
              <span class="text-emerald-700">Received {{ b.total_received | inr }}</span>
              <span [class.text-red-600]="b.remaining_balance > 0">Balance {{ b.remaining_balance | inr }}</span>
              <span class="flex-1"></span>
              <button type="button" class="btn btn-secondary btn-sm" (click)="pdf(b)" [disabled]="making() === b.id"><app-icon name="download" [size]="14" />{{ making() === b.id ? 'Making...' : 'PDF' }}</button>
              <a [routerLink]="['/events', b.id]" [queryParams]="{ tab: 'services' }" class="btn btn-secondary btn-sm"><app-icon name="edit" [size]="14" />Services</a>
              <a [routerLink]="['/events', b.id]" class="btn btn-primary btn-sm">Open event</a>
            </div>
          </div>
        </article>
      } @empty {
        @if (!loading()) {
          <div class="col-span-full card card-pad text-center text-ink-500">
            No booked events here. Events appear when services are selected in the event's <b>Services &amp; Prices</b> tab or a client books on the booking page.
          </div>
        }
      }
    </div>

    <app-lightbox [open]="!!lb()" [title]="lb()?.name || ''" [items]="lbItems()" [(index)]="lbIndex" (closed)="lb.set(null)" />
  `,
})
export class BookingsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  whens = [{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }, { key: 'all', label: 'All' }];
  sources = [{ key: 'all', label: 'All' }, { key: 'online', label: 'Online' }, { key: 'staff', label: 'Added by staff' }];

  list = signal<Booking[]>([]);
  loading = signal(true);
  q = signal('');
  when = signal('upcoming');
  source = signal('all');
  sort = signal('date');
  sum = computed(() => this.list().reduce((a, b) => a + b.services_total, 0));
  onlineCount = computed(() => this.list().filter((b) => b.is_online).length);

  lb = signal<Booking | null>(null);
  lbIndex = signal(0);
  lbItems = computed<LightboxItem[]>(() => {
    const b = this.lb();
    return b ? this.photos(b).map((i) => ({ src: this.url(i.photo_id!), label: i.variant_label ? `${i.name} (${i.variant_label})` : i.name, price: i.amount })) : [];
  });

  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  constructor() {
    this.load();
  }

  url(id: number): string {
    return photoUrl(id, this.auth.token);
  }

  making = signal<number | null>(null);

  grouped(b: Booking) {
    return groupByCategory(b.items);
  }

  async pdf(b: Booking): Promise<void> {
    this.making.set(b.id);
    try {
      const business = await this.api.get<Record<string, string>>('/settings').catch(() => ({}));
      await quotationPdf({
        business, reference: `EV-${String(b.id).padStart(5, '0')}`, event: b,
        lines: this.grouped(b).flatMap((g) => g.items.map((i) => ({ ...i, category: g.name }))),
        subtotal: b.subtotal, discount: b.discount, total: b.services_total,
        received: b.total_received, balance: b.remaining_balance,
        photoUrl: (id) => this.url(id),
        fileName: `Quotation-${b.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || b.id}`,
      });
    } catch (e) {
      this.toast.error('PDF could not be made: ' + (e as Error).message);
    } finally {
      this.making.set(null);
    }
  }

  photos(b: Booking) {
    return b.items.filter((i) => i.photo_id);
  }

  view(b: Booking, n: number): void {
    this.lbIndex.set(n);
    this.lb.set(b);
  }

  set(sig: { set(v: string): void }, v: string): void {
    sig.set(v);
    this.load();
  }

  search(v: string): void {
    this.q.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 300);
  }

  async load(): Promise<void> {
    const seq = ++this.seq;
    this.loading.set(true);
    try {
      const rows = await this.api.get<Booking[]>('/bookings', { q: this.q().trim(), when: this.when(), source: this.source(), sort: this.sort() === 'newest' ? 'newest' : '' });
      if (seq === this.seq) this.list.set(rows);
    } catch (e) {
      this.toast.fail(e);
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }
}
