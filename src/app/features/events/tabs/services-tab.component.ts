import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ToastService } from '../../../core/toast.service';
import { EventItem, EventServiceItem, EventServices, Service, ServicePhoto } from '../../../core/models';
import { FORMAT_PIPES, fmtDate, inr } from '../../../core/format';
import { groupByCategory, photoUrl, videoFileUrl } from '../../../core/service-images';
import { quotationPdf } from '../../../core/services-pdf';
import { IconComponent } from '../../../shared/icon.component';
import { LightboxComponent, LightboxItem } from '../../../shared/lightbox.component';
import { CategoryTab, CategoryTabsComponent } from '../../../shared/category-tabs.component';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Pick services for an event from the price list. If a service has photos, the chosen photo's price is used. */
@Component({
  selector: 'app-services-tab',
  standalone: true,
  imports: [RouterLink, IconComponent, LightboxComponent, CategoryTabsComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <section class="card card-pad">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex-1 min-w-[180px]">
            <h2 class="card-title">Select Services</h2>
            <p class="text-xs text-ink-500 mt-0.5">Tick a service. If it has photos, pick a photo and its price is used. Quantity and price can be changed for this event.</p>
          </div>
          <label class="relative block w-full sm:w-56">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><app-icon name="search" [size]="16" /></span>
            <input class="input !py-2 pl-9" placeholder="Search..." [value]="q()" (input)="q.set($any($event.target).value)" />
          </label>
        </div>

        @if (loading()) { <p class="text-ink-400 text-sm py-4">Loading services...</p> }
        @if (!loading() && !services().length) {
          <p class="text-sm text-ink-500 py-4">The price list is empty. @if (auth.isAdmin()) { <a routerLink="/services" class="text-brand-700 font-semibold">Add services</a> }</p>
        }

        @if (!q().trim()) { <div class="mb-3"><app-category-tabs [tabs]="tabs()" [active]="currentTab()" (activeChange)="tab.set($event)" /></div> }

        <div class="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          @for (g of shownGroups(); track g.name) {
          <h3 class="sticky top-0 z-10 bg-white/95 backdrop-blur py-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 flex items-center gap-2">
            {{ g.name }}<span class="font-medium text-ink-400 normal-case tracking-normal">{{ countIn(g.items) }} selected</span>
          </h3>
          @for (s of g.items; track s.id) {
            @let it = itemFor(s.id);
            <div class="rounded-xl border p-2.5 transition" [class]="it ? 'border-brand-300 bg-brand-50/50' : 'border-ink-100 bg-white'">
              <div class="grid grid-cols-[24px_44px_1fr] sm:grid-cols-[24px_44px_1fr_72px_112px] gap-x-3 gap-y-2 items-center">
                <input type="checkbox" class="w-[18px] h-[18px] accent-brand-700" [checked]="!!it" (change)="toggle(s, $any($event.target).checked)" [attr.aria-label]="'Select ' + s.name" />
                <button type="button" class="w-11 h-11 rounded-lg bg-ink-100 bg-cover bg-center"
                        [class.cursor-zoom-in]="s.photos.length" [style.background-image]="thumb(s, it)"
                        (click)="s.photos.length ? openPicker(s, it?.photo_id ?? null) : toggle(s, !it)" [attr.aria-label]="'Photos of ' + s.name"></button>
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ s.name }}@if (s.videos.length) { <button type="button" class="ml-1.5 inline-flex items-center rounded-full bg-ink-900 text-white text-[10px] font-semibold px-2 py-0.5 align-middle hover:bg-brand-800" (click)="openVideos(s)" title="Show videos">▶ {{ s.videos.length }}</button> }</p>
                  <p class="text-[11px] text-ink-500">
                    @if (s.photos.length) { {{ s.photos.length }} photo{{ s.photos.length > 1 ? 's' : '' }} · {{ s.min_price | inr }}@if (s.max_price !== s.min_price) { – {{ s.max_price | inr }} } }
                    @else { Default {{ s.price | inr }} }
                  </p>
                </div>
                <div class="col-span-3 sm:col-span-1 sm:col-start-4 grid grid-cols-2 sm:contents gap-2 pl-[80px] sm:pl-0">
                  <input type="number" min="1" class="input !px-2 !py-1.5 text-sm" [value]="it ? it.quantity : 1" [disabled]="!it" title="Quantity" aria-label="Quantity"
                         (input)="setQty(s.id, $any($event.target).value)" />
                  <input type="number" min="0" class="input !px-2 !py-1.5 text-sm money" [value]="it ? it.unit_price : defaultPrice(s)" [disabled]="!it" title="Price for this event" aria-label="Price"
                         (input)="setPrice(s.id, $any($event.target).value)" />
                </div>
              </div>
              @if (it && s.photos.length) {
                <div class="mt-2.5 pt-2.5 border-t border-dashed border-brand-200">
                  <p class="text-[11px] text-ink-500 mb-2">Pick a photo – its price is used:</p>
                  <div class="flex flex-wrap gap-2">
                    @for (p of s.photos; track p.id) {
                      <button type="button" class="relative w-[104px] rounded-xl border-2 bg-white overflow-hidden text-center transition"
                              [class]="it.photo_id === p.id ? 'border-brand-600 ring-4 ring-brand-100' : 'border-ink-100 hover:border-ink-300'"
                              (click)="pickPhoto(s, p)">
                        <span class="block h-[76px] bg-ink-100 bg-cover bg-center" [style.background-image]="'url(' + url(p.id) + ')'"></span>
                        <span class="absolute top-1 right-1 rounded-md bg-ink-950/60 text-white p-1 leading-none" (click)="$event.stopPropagation(); openPicker(s, p.id)" title="View large"><app-icon name="search" [size]="12" /></span>
                        <span class="block text-xs font-bold text-brand-700 pt-1 money">{{ p.price | inr }}</span>
                        <span class="block text-[11px] text-ink-500 px-1 pb-1 truncate">{{ p.label || '\u00a0' }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
          } @empty {
            @if (!loading() && services().length) { <p class="text-sm text-ink-400 py-4 text-center">Nothing found.</p> }
          }
        </div>

        <div class="mt-5">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold">Other items</h3>
            <button type="button" class="btn btn-secondary btn-sm" (click)="addCustom()"><app-icon name="plus" [size]="14" />Custom item</button>
          </div>
          @for (o of others(); track o.idx) {
            <div class="grid grid-cols-[1fr_72px_112px_32px] gap-2 items-center mb-2">
              <input class="input !py-1.5 text-sm" [value]="o.item.name" placeholder="Item name" (input)="setName(o.idx, $any($event.target).value)" aria-label="Item name" />
              <input type="number" min="1" class="input !px-2 !py-1.5 text-sm" [value]="o.item.quantity" (input)="setQtyAt(o.idx, $any($event.target).value)" aria-label="Quantity" />
              <input type="number" min="0" class="input !px-2 !py-1.5 text-sm money" [value]="o.item.unit_price" (input)="setPriceAt(o.idx, $any($event.target).value)" aria-label="Price" />
              <button type="button" class="btn-icon !w-8 !h-8 hover:!text-red-600" (click)="removeAt(o.idx)" title="Remove"><app-icon name="trash" [size]="15" /></button>
            </div>
          } @empty { <p class="text-xs text-ink-400">Add anything that is not in the price list.</p> }
        </div>
      </section>

      <aside class="card card-pad lg:sticky lg:top-20">
        <div class="flex items-center justify-between mb-3">
          <h2 class="card-title">Selected services</h2>
          @if (dirty()) { <span class="badge bg-gold-50 text-gold-700">Not saved</span> }
        </div>
        <div>
          @for (g of summaryGroups(); track g.name) {
            <p class="text-[11px] font-bold uppercase tracking-wider text-brand-700 mt-3 first:mt-0">{{ g.name }}</p>
          <div class="divide-y divide-dashed divide-ink-200">
          @for (x of g.items; track x.idx) {
            @let i = x.item;
            <div class="flex items-center justify-between gap-3 py-2 text-sm">
              <span class="flex items-center gap-2 min-w-0">
                @if (i.photo_id) {
                  <button type="button" class="w-7 h-7 shrink-0 rounded-md bg-ink-100 bg-cover bg-center cursor-zoom-in" [style.background-image]="'url(' + url(i.photo_id) + ')'" (click)="viewSelected(x.idx)" title="View large"></button>
                }
                <span class="min-w-0">{{ i.name || 'Unnamed item' }}@if (i.variant_label) { <span class="text-ink-500"> ({{ i.variant_label }})</span> }@if (i.quantity !== 1) { <span class="text-ink-500"> × {{ i.quantity }}</span> }</span>
              </span>
              <b class="money">{{ i.unit_price * i.quantity | inr }}</b>
            </div>
          }
          </div>
          } @empty { <p class="text-sm text-ink-400 py-2">No service selected yet.</p> }
        </div>
        <div class="flex justify-between text-sm pt-3"><span>Subtotal</span><b class="money">{{ subtotal() | inr }}</b></div>
        <label class="flex items-center justify-between gap-3 text-sm mt-2">
          <span>Discount ₹</span>
          <input type="number" min="0" class="input !w-32 !py-1.5 money text-right" [value]="discount()" (input)="setDiscount($any($event.target).value)" aria-label="Discount" />
        </label>
        <div class="flex justify-between items-baseline border-t-2 border-ink-100 mt-3 pt-3">
          <span class="font-semibold">Total</span><span class="text-2xl font-bold text-brand-700 money">{{ total() | inr }}</span>
        </div>

        <div class="rounded-xl bg-ink-50 p-3 mt-4 text-xs text-ink-600">
          Booking amount on this event: <b class="money">{{ event().booking_amount | inr }}</b>
          @if (event().booking_amount !== total() && items().length) {
            <label class="flex items-start gap-2 mt-2 cursor-pointer">
              <input type="checkbox" class="mt-0.5 accent-brand-700" [checked]="setBooking()" (change)="setBooking.set($any($event.target).checked)" />
              <span>Also change the booking amount to {{ total() | inr }} when I save</span>
            </label>
          }
        </div>

        <div class="flex flex-col gap-2 mt-4">
          <button class="btn btn-primary" (click)="save()" [disabled]="saving() || !dirty() && !setBooking()">{{ saving() ? 'Saving...' : 'Save Services' }}</button>
          <button class="btn btn-gold" (click)="pdf()" [disabled]="!items().length || making()" title="All services under their headings, with photos and prices, in one PDF">
            <app-icon name="download" [size]="15" />{{ making() ? 'Making PDF...' : 'Download PDF' }}
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn btn-secondary" (click)="copy()" [disabled]="!items().length"><app-icon name="copy" [size]="15" />Copy summary</button>
            <button class="btn btn-ghost" (click)="reset()" [disabled]="!dirty()"><app-icon name="refresh" [size]="15" />Undo changes</button>
          </div>
          @if (dirty()) { <p class="text-[11px] text-ink-500 text-center">The PDF shows what is on screen, including unsaved changes.</p> }
        </div>
      </aside>
    </div>

    <app-lightbox [open]="!!lbItems().length" [title]="lbTitle()" [items]="lbItems()" [(index)]="lbIndex"
                  [actionText]="lbService() ? selectText : null" (action)="selectFromViewer($event)" (closed)="closeViewer()" />
  `,
})
export class ServicesTabComponent {
  event = input.required<EventItem>();
  changed = output<void>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);

  services = signal<Service[]>([]);
  saved = signal<EventServices | null>(null);
  items = signal<EventServiceItem[]>([]);
  discount = signal(0);
  setBooking = signal(false);
  loading = signal(true);
  saving = signal(false);
  q = signal('');

  filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.services().filter((s) => s.name.toLowerCase().includes(q)) : this.services();
  });
  /** Custom lines, and lines whose service was removed from the price list. */
  others = computed(() => {
    const ids = new Set(this.services().map((s) => s.id));
    return this.items().map((item, idx) => ({ item, idx })).filter((o) => o.item.service_id == null || !ids.has(o.item.service_id));
  });
  groups = computed(() => groupByCategory(this.filtered()));
  /** One tab per heading. While searching, all headings are shown. */
  tab = signal('');
  tabs = computed<CategoryTab[]>(() => groupByCategory(this.services()).map((g) => ({ name: g.name, count: g.items.length, selected: this.countIn(g.items) })));
  currentTab = computed(() => {
    const names = this.tabs().map((t) => t.name);
    return names.includes(this.tab()) ? this.tab() : names[0] ?? '';
  });
  shownGroups = computed(() => (this.q().trim() ? this.groups() : this.groups().filter((g) => g.name === this.currentTab())));
  /** Selected lines under their headings (custom lines go under "Other"). */
  summaryGroups = computed(() => {
    const cat = new Map(this.services().map((s) => [s.id, s.category]));
    return groupByCategory(this.items().map((item, idx) => ({ item, idx, category: item.category || (item.service_id ? cat.get(item.service_id) : null) })));
  });
  making = signal(false);
  subtotal = computed(() => round2(this.items().reduce((a, i) => a + i.unit_price * i.quantity, 0)));
  total = computed(() => round2(Math.max(0, this.subtotal() - this.discount())));
  dirty = computed(() => {
    const s = this.saved();
    if (!s) return false;
    const key = (l: EventServiceItem[]) => JSON.stringify(l.map((i) => [i.service_id, i.photo_id, i.name, i.variant_label, +i.unit_price, +i.quantity]));
    return key(s.items) !== key(this.items()) || s.discount !== this.discount();
  });

  // Big photo viewer
  lbService = signal<Service | null>(null);
  lbSelected = signal<LightboxItem[] | null>(null);
  lbIndex = signal(0);
  lbVideos = signal<Service | null>(null);
  lbItems = computed<LightboxItem[]>(() => {
    const vs = this.lbVideos();
    if (vs) return vs.videos.map((v) => ({ src: v.provider === 'file' ? videoFileUrl(v.id, this.auth.token) : '', label: v.label, video: v }));
    const s = this.lbService();
    if (s) return s.photos.map((p) => ({ src: this.url(p.id), label: p.label, price: p.price }));
    return this.lbSelected() ?? [];
  });
  lbTitle = computed(() => this.lbVideos()?.name ?? this.lbService()?.name ?? this.event().name);
  selectText = (i: number): string => {
    const s = this.lbService();
    const p = s?.photos[i];
    return p && s && this.itemFor(s.id)?.photo_id === p.id ? '✓ Selected' : 'Select this photo';
  };

  /** Only reload when the event itself changes, not when its header data refreshes (keeps unsaved picks). */
  private eventId = computed(() => this.event().id);

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (id) this.load(id);
    });
  }

  url(id: number): string {
    return photoUrl(id, this.auth.token);
  }

  async load(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const [services, saved] = await Promise.all([this.api.get<Service[]>('/services'), this.api.get<EventServices>(`/events/${id}/services`)]);
      this.services.set(services);
      this.apply(saved);
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  private apply(saved: EventServices): void {
    this.saved.set(saved);
    this.items.set(saved.items.map((i) => ({ ...i })));
    this.discount.set(saved.discount);
    this.setBooking.set(false);
  }

  reset(): void {
    const s = this.saved();
    if (s) this.apply(s);
  }

  countIn(list: Service[]): number {
    return list.filter((s) => this.itemFor(s.id)).length;
  }

  itemFor(serviceId: number): EventServiceItem | undefined {
    return this.items().find((i) => i.service_id === serviceId);
  }

  defaultPrice(s: Service): number {
    return s.photos[0]?.price ?? s.price;
  }

  thumb(s: Service, it: EventServiceItem | undefined): string | null {
    const id = it?.photo_id ?? s.photos[0]?.id;
    return id ? `url(${this.url(id)})` : null;
  }

  toggle(s: Service, on: boolean): void {
    if (!on) {
      this.items.update((l) => l.filter((i) => i.service_id !== s.id));
      return;
    }
    if (this.itemFor(s.id)) return;
    const p = s.photos[0];
    this.items.update((l) => [...l, {
      service_id: s.id, photo_id: p?.id ?? null, name: s.name, category: s.category, variant_label: p?.label ?? null,
      unit_price: p ? p.price : s.price, quantity: 1,
    }]);
  }

  pickPhoto(s: Service, p: ServicePhoto): void {
    if (!this.itemFor(s.id)) this.toggle(s, true);
    this.patch((i) => i.service_id === s.id, { photo_id: p.id, variant_label: p.label, unit_price: p.price });
  }

  private patch(match: (i: EventServiceItem, idx: number) => boolean, change: Partial<EventServiceItem>): void {
    this.items.update((l) => l.map((i, idx) => (match(i, idx) ? { ...i, ...change } : i)));
  }

  private qty = (v: string) => Math.max(1, Number(v) || 1);
  private money = (v: string) => Math.max(0, round2(Number(v) || 0));

  setQty(sid: number, v: string): void { this.patch((i) => i.service_id === sid, { quantity: this.qty(v) }); }
  setPrice(sid: number, v: string): void { this.patch((i) => i.service_id === sid, { unit_price: this.money(v) }); }
  setQtyAt(idx: number, v: string): void { this.patch((_, n) => n === idx, { quantity: this.qty(v) }); }
  setPriceAt(idx: number, v: string): void { this.patch((_, n) => n === idx, { unit_price: this.money(v) }); }
  setName(idx: number, v: string): void { this.patch((_, n) => n === idx, { name: v }); }
  removeAt(idx: number): void { this.items.update((l) => l.filter((_, n) => n !== idx)); }
  setDiscount(v: string): void { this.discount.set(this.money(v)); }

  addCustom(): void {
    this.items.update((l) => [...l, { service_id: null, photo_id: null, name: '', variant_label: null, unit_price: 0, quantity: 1 }]);
  }

  openVideos(s: Service): void {
    this.lbService.set(null);
    this.lbSelected.set(null);
    this.lbIndex.set(0);
    this.lbVideos.set(s);
  }

  openPicker(s: Service, photoId: number | null): void {
    if (!s.photos.length) return;
    this.lbVideos.set(null);
    this.lbSelected.set(null);
    this.lbIndex.set(Math.max(0, s.photos.findIndex((p) => p.id === photoId)));
    this.lbService.set(s);
  }

  viewSelected(index: number): void {
    this.lbVideos.set(null);
    const withPhoto = this.items().map((i, n) => ({ i, n })).filter((x) => x.i.photo_id);
    this.lbService.set(null);
    this.lbIndex.set(Math.max(0, withPhoto.findIndex((x) => x.n === index)));
    this.lbSelected.set(withPhoto.map(({ i }) => ({ src: this.url(i.photo_id!), label: i.name + (i.variant_label ? ` (${i.variant_label})` : ''), price: i.unit_price })));
  }

  selectFromViewer(i: number): void {
    const s = this.lbService();
    const p = s?.photos[i];
    if (!s || !p) return;
    this.pickPhoto(s, p);
    this.toast.success(`${s.name}: ${inr(p.price)} selected`);
  }

  closeViewer(): void {
    this.lbVideos.set(null);
    this.lbService.set(null);
    this.lbSelected.set(null);
  }

  async save(): Promise<void> {
    const items = this.items();
    if (items.some((i) => !i.name.trim())) { this.toast.error('Give every custom item a name'); return; }
    if (this.discount() > this.subtotal()) { this.toast.error('Discount cannot be more than the subtotal'); return; }
    this.saving.set(true);
    try {
      const res = await this.api.put<EventServices>(`/events/${this.event().id}/services`, {
        discount: this.discount(),
        set_booking_amount: this.setBooking(),
        items: items.map(({ service_id, photo_id, name, variant_label, unit_price, quantity }) => ({ service_id, photo_id, name: name.trim(), variant_label, unit_price, quantity })),
      });
      const bookingChanged = res.booking_amount !== this.event().booking_amount;
      this.apply(res);
      this.toast.success(bookingChanged ? 'Services saved and booking amount updated' : 'Services saved');
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  /** One PDF with every selected service under its heading, with photos and prices. */
  async pdf(): Promise<void> {
    const e = this.event();
    this.making.set(true);
    try {
      const business = await this.api.get<Record<string, string>>('/settings').catch(() => ({}));
      const lines = this.summaryGroups().flatMap((g) => g.items.map(({ item }) => ({ ...item, category: g.name })));
      await quotationPdf({
        business, reference: `EV-${String(e.id).padStart(5, '0')}`,
        event: e, lines, subtotal: this.subtotal(), discount: this.discount(), total: this.total(),
        photoUrl: (id) => this.url(id),
        fileName: `Quotation-${e.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || e.id}`,
      });
    } catch (err) {
      this.toast.error('PDF could not be made: ' + (err as Error).message);
    } finally {
      this.making.set(false);
    }
  }

  /** Text for WhatsApp. */
  async copy(): Promise<void> {
    const e = this.event();
    const lines: (string | null)[] = [
      `*${e.name}*`,
      e.client_name ? `Client: ${e.client_name}` : null,
      `Date: ${fmtDate(e.event_date)}`,
      e.venue ? `Venue: ${e.venue}` : null,
      '',
      ...this.summaryGroups().flatMap((g) => [
        `_${g.name}_`,
        ...g.items.map(({ item: i }) => `• ${i.name}${i.variant_label ? ` (${i.variant_label})` : ''}${i.quantity !== 1 ? ` × ${i.quantity}` : ''} – ${inr(i.unit_price * i.quantity)}`),
        '',
      ]),
      '',
      `Subtotal: ${inr(this.subtotal())}`,
      this.discount() ? `Discount: −${inr(this.discount())}` : null,
      `*Total: ${inr(this.total())}*`,
    ];
    const text = lines.filter((x) => x !== null).join('\n').replace(/\n{3,}/g, '\n\n');
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Summary copied – paste it in WhatsApp');
    } catch {
      this.toast.error('Could not copy. Your browser blocked the clipboard.');
    }
  }
}
