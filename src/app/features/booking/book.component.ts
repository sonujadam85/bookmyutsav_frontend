import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { FORMAT_PIPES, fmtDate, inr, today } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { LightboxComponent, LightboxItem } from '../../shared/lightbox.component';
import { groupByCategory, videoFileUrl } from '../../core/service-images';
import { quotationPdfData } from '../../core/services-pdf';
import { CategoryTab, CategoryTabsComponent } from '../../shared/category-tabs.component';

interface PubPhoto { id: number; label: string | null; price: number; }
interface PubVideo { id: number; provider: 'file' | 'youtube' | 'instagram'; video_id: string | null; label: string | null; }
interface PubService { id: number; name: string; category: string | null; price: number; min_price: number; max_price: number; photos: PubPhoto[]; videos?: PubVideo[]; }
interface Info { business_name: string; business_phone: string; business_email: string; business_address: string; }
interface Pick { service_id: number; photo_id: number | null; quantity: number; }
interface BookingResult {
  reference: string; event_date: string; total: number;
  items: { name: string; variant_label: string | null; unit_price: number; quantity: number; amount: number; photo_id: number | null }[];
}

// Each company has its own booking page: /book/<profile>. Plain /book is the main company.
let base = '/public';
const photoSrc = (id: number) => `/api${base}/service-photos/${id}/file`;

/** Public page (no login): a client picks services and photos, fills in details, and a tentative event is created. */
@Component({
  selector: 'app-book',
  standalone: true,
  imports: [FormsModule, IconComponent, LightboxComponent, CategoryTabsComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-ink-50 pb-28 lg:pb-10">
      <header class="bg-brand-950 text-white">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <p class="text-[11px] uppercase tracking-[0.25em] text-gold-300 font-semibold">Book your event</p>
          <h1 class="font-display text-3xl sm:text-4xl font-bold text-white mt-1">{{ info()?.business_name || 'BookMyUtsav' }}</h1>
          <p class="text-brand-200 mt-2 text-sm sm:text-base max-w-2xl">Choose the services you want. Where there are photos, pick the setup you like – its price is used. Then send us your details and we will call you to confirm.</p>
          @if (info()?.business_phone) { <p class="mt-3 text-sm text-brand-100 inline-flex items-center gap-2"><app-icon name="phone" [size]="15" />{{ info()!.business_phone }}</p> }
        </div>
      </header>

      @if (result(); as r) {
        <!-- Thank you -->
        <main class="max-w-2xl mx-auto px-4 sm:px-6 -mt-6">
          <div class="card card-pad text-center">
            <div class="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><app-icon name="check" [size]="28" [stroke]="2.4" /></div>
            <h2 class="text-2xl font-bold mt-3">Thank you, {{ form.name }}!</h2>
            <p class="text-ink-500 mt-1">Your booking request has been received. We will call you on {{ form.mobile }} to confirm.</p>
            <p class="mt-3 text-sm">Booking number <b class="text-brand-700">{{ r.reference }}</b> · {{ dateText(r.event_date) }}</p>
          </div>
          <div class="card card-pad mt-4">
            @for (i of r.items; track $index) {
              <div class="flex items-center gap-3 py-2 border-b border-dashed border-ink-200 last:border-0 text-sm">
                @if (i.photo_id) { <img [src]="src(i.photo_id)" alt="" class="w-12 h-12 rounded-lg object-cover" /> }
                <span class="flex-1">{{ i.name }}@if (i.variant_label) { <span class="text-ink-500"> ({{ i.variant_label }})</span> }@if (i.quantity > 1) { <span class="text-ink-500"> × {{ i.quantity }}</span> }</span>
                <b class="money">{{ i.amount | inr }}</b>
              </div>
            }
            <div class="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-ink-100">
              <span class="font-semibold">Estimated total</span><span class="text-2xl font-bold text-brand-700 money">{{ r.total | inr }}</span>
            </div>
            <p class="text-xs text-ink-400 mt-2">Final price is confirmed after we discuss your event.</p>
          </div>
          <div class="flex flex-wrap gap-2 justify-center mt-5">
            @if (pdfData()) { <a class="btn btn-gold" [href]="pdfData()" [attr.download]="'Booking-' + r.reference + '.pdf'"><app-icon name="download" [size]="16" />Download PDF</a> }
            @if (whatsapp()) { <a class="btn btn-primary" [href]="whatsapp()" target="_blank" rel="noopener"><app-icon name="phone" [size]="16" />Send on WhatsApp</a> }
            <button class="btn btn-secondary" (click)="startOver()">Book another event</button>
          </div>
        </main>
      } @else {
        <main class="max-w-6xl mx-auto px-4 sm:px-6 -mt-6 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <section>
            <div class="card card-pad">
              <div class="flex flex-wrap items-center gap-3 mb-4">
                <h2 class="card-title flex-1">1. Choose services</h2>
                <label class="relative block w-full sm:w-60">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><app-icon name="search" [size]="16" /></span>
                  <input class="input !py-2 pl-9" placeholder="Search services..." [value]="q()" (input)="q.set($any($event.target).value)" />
                </label>
              </div>
              @if (loading()) { <p class="text-ink-400 py-6 text-center">Loading services...</p> }
              @if (loadError()) { <p class="text-red-600 py-6 text-center">{{ loadError() }}</p> }

              @if (!q().trim() && tabs().length > 1) { <div class="mb-4"><app-category-tabs [tabs]="tabs()" [active]="currentTab()" (activeChange)="tab.set($event)" /></div> }
              @for (g of shownGroups(); track g.name) {
              @if (q().trim() || !(tabs().length > 1)) { <h3 class="font-display text-xl font-bold text-brand-900 mt-6 first:mt-0 mb-3 pb-1.5 border-b-2 border-brand-100">{{ g.name }}</h3> }
              <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                @for (s of g.items; track s.id) {
                  @let p = pickFor(s.id);
                  <div class="rounded-2xl border-2 overflow-hidden bg-white transition flex flex-col" [class]="p ? 'border-brand-600 shadow-lift' : 'border-ink-100'">
                    <button type="button" class="relative h-44 bg-ink-100 bg-cover bg-center flex items-center justify-center text-ink-300"
                            [style.background-image]="cover(s, p)" (click)="s.photos.length ? view(s, p?.photo_id ?? null) : toggle(s)"
                            [attr.aria-label]="s.photos.length ? 'View photos of ' + s.name : 'Select ' + s.name">
                      @if (!s.photos.length) { <app-icon name="sparkle" [size]="36" /> }
                      @else { <span class="absolute left-2 bottom-2 rounded-md bg-ink-950/60 text-white text-[11px] px-2 py-1 inline-flex items-center gap-1"><app-icon name="image" [size]="12" />{{ s.photos.length }} photo{{ s.photos.length > 1 ? 's' : '' }}</span> }
                      @if (p) { <span class="absolute right-2 top-2 w-8 h-8 rounded-full bg-brand-700 text-white flex items-center justify-center shadow"><app-icon name="check" [size]="18" [stroke]="2.6" /></span> }
                    </button>
                    <div class="p-3.5 flex flex-col gap-2 flex-1">
                      <p class="font-semibold leading-snug">{{ s.name }}</p>
                      @if (s.videos?.length) {
                        <button type="button" class="self-start inline-flex items-center gap-1.5 rounded-full bg-ink-900 text-white text-xs font-semibold px-3 py-1 hover:bg-brand-800" (click)="viewVideos(s)">
                          ▶ Watch video{{ s.videos!.length > 1 ? 's (' + s.videos!.length + ')' : '' }}
                        </button>
                      }
                      <p class="text-sm text-brand-700 font-bold money">
                        @if (p) { {{ unitPrice(s, p) | inr }} }
                        @else { @if (s.max_price !== s.min_price) { From {{ s.min_price | inr }} } @else { {{ s.min_price | inr }} } }
                      </p>

                      @if (p && s.photos.length > 1) {
                        <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                          @for (ph of s.photos; track ph.id) {
                            <button type="button" class="shrink-0 w-16 rounded-lg border-2 overflow-hidden text-center" [class]="p.photo_id === ph.id ? 'border-brand-600' : 'border-ink-100'"
                                    (click)="choose(s, ph.id)" [attr.aria-label]="(ph.label || 'Option') + ' ' + money(ph.price)">
                              <span class="block h-12 bg-ink-100 bg-cover bg-center" [style.background-image]="'url(' + src(ph.id) + ')'"></span>
                              <span class="block text-[10px] font-semibold text-brand-700 py-0.5 money">{{ ph.price | inr }}</span>
                            </button>
                          }
                        </div>
                      }

                      <div class="mt-auto flex items-center gap-2 pt-1">
                        @if (p) {
                          <div class="flex items-center rounded-xl border border-ink-200">
                            <button type="button" class="w-9 h-9 text-lg text-ink-600" (click)="qty(s.id, -1)" aria-label="Less">−</button>
                            <span class="w-8 text-center text-sm font-semibold">{{ p.quantity }}</span>
                            <button type="button" class="w-9 h-9 text-lg text-ink-600" (click)="qty(s.id, 1)" aria-label="More">+</button>
                          </div>
                          <button type="button" class="btn btn-ghost btn-sm ml-auto" (click)="toggle(s)">Remove</button>
                        } @else {
                          <button type="button" class="btn btn-secondary btn-sm w-full" (click)="toggle(s)"><app-icon name="plus" [size]="14" />Select</button>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
              } @empty {
                @if (!loading() && !loadError()) { <p class="text-center text-ink-400 py-6">No services found.</p> }
              }
            </div>
          </section>

          <aside id="details" class="card card-pad lg:sticky lg:top-6">
            <h2 class="card-title mb-3">2. Your details</h2>
            <form class="space-y-3" (ngSubmit)="submit()" #f="ngForm">
              <div><label class="label" for="b-name">Your name *</label><input id="b-name" class="input" name="name" [(ngModel)]="form.name" required maxlength="150" autocomplete="name" /></div>
              <div><label class="label" for="b-mobile">Mobile number *</label><input id="b-mobile" class="input" name="mobile" [(ngModel)]="form.mobile" required inputmode="tel" autocomplete="tel" placeholder="10-digit mobile" /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="label" for="b-date">Event date *</label><input id="b-date" type="date" class="input" name="event_date" [(ngModel)]="form.event_date" [min]="minDate" required /></div>
                <div><label class="label" for="b-guests">Guests</label><input id="b-guests" type="number" min="0" class="input" name="guests" [(ngModel)]="form.guests" /></div>
              </div>
              <div><label class="label" for="b-venue">Venue / city</label><input id="b-venue" class="input" name="venue" [(ngModel)]="form.venue" maxlength="200" /></div>
              <div><label class="label" for="b-email">Email</label><input id="b-email" type="email" class="input" name="email" [(ngModel)]="form.email" autocomplete="email" /></div>
              <div><label class="label" for="b-notes">Anything else?</label><textarea id="b-notes" class="input" rows="2" name="notes" [(ngModel)]="form.notes" maxlength="2000" placeholder="Colours, theme, timings..."></textarea></div>
              <!-- Hidden from people; bots fill it -->
              <input type="text" name="website" [(ngModel)]="form.website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />

              <div class="border-t border-ink-100 pt-3">
                <h3 class="text-sm font-semibold mb-1">Selected ({{ picks().length }})</h3>
                @for (l of lines(); track l.s.id) {
                  <div class="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span class="flex items-center gap-2 min-w-0">
                      @if (l.photo) { <span class="w-7 h-7 shrink-0 rounded-md bg-cover bg-center" [style.background-image]="'url(' + src(l.photo.id) + ')'"></span> }
                      <span class="truncate">{{ l.s.name }}@if (l.photo?.label) { <span class="text-ink-500"> ({{ l.photo!.label }})</span> }@if (l.p.quantity > 1) { <span class="text-ink-500"> × {{ l.p.quantity }}</span> }</span>
                    </span>
                    <b class="money">{{ l.amount | inr }}</b>
                  </div>
                } @empty { <p class="text-sm text-ink-400">Select services on the left.</p> }
                <div class="flex justify-between items-baseline border-t-2 border-ink-100 mt-2 pt-2">
                  <span class="font-semibold">Estimated total</span><span class="text-2xl font-bold text-brand-700 money">{{ total() | inr }}</span>
                </div>
              </div>
              @if (error()) { <p class="err text-sm">{{ error() }}</p> }
              <button class="btn btn-primary w-full !py-3" [disabled]="sending()">{{ sending() ? 'Sending...' : 'Send booking request' }}</button>
              <p class="text-[11px] text-ink-400 text-center">No payment now. We will call you to confirm the date and price.</p>
            </form>
          </aside>
        </main>
        <footer class="max-w-6xl mx-auto px-4 sm:px-6 mt-10 flex items-center justify-center gap-2 text-xs text-ink-500">
          Powered by <img src="/brand/logo-icon-192.png" alt="" class="w-6 h-6 rounded-md" /> <b class="text-brand-900">Book<span class="text-gold-600">My</span>Utsav</b>
        </footer>

        <!-- Mobile bottom bar -->
        @if (picks().length) {
          <div class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ink-100 shadow-lift px-4 py-3 flex items-center gap-3">
            <div class="flex-1"><p class="text-xs text-ink-500">{{ picks().length }} selected</p><p class="text-lg font-bold text-brand-700 money">{{ total() | inr }}</p></div>
            <button class="btn btn-primary" (click)="goDetails()">Continue</button>
          </div>
        }
      }
    </div>

    <app-lightbox [open]="!!lb()" [title]="lb()?.name || ''" [items]="lbItems()" [(index)]="lbIndex"
                  [actionText]="lbMode() === 'photos' ? selectText : null" (action)="selectFromViewer($event)" (closed)="lb.set(null)" />
  `,
})
export class BookComponent {
  private api = inject(ApiService);

  info = signal<Info | null>(null);
  services = signal<PubService[]>([]);
  picks = signal<Pick[]>([]);
  loading = signal(true);
  loadError = signal('');
  sending = signal(false);
  error = signal('');
  result = signal<BookingResult | null>(null);
  /** The PDF sent with the booking, for the client to download. */
  pdfData = signal('');
  q = signal('');
  minDate = today();
  form = { name: '', mobile: '', email: '', event_date: '', venue: '', guests: null as number | null, notes: '', website: '' };

  filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.services().filter((s) => s.name.toLowerCase().includes(q)) : this.services();
  });
  groups = computed(() => groupByCategory(this.filtered()));
  tab = signal('');
  tabs = computed<CategoryTab[]>(() => {
    const picked = new Set(this.picks().map((p) => p.service_id));
    return groupByCategory(this.services()).map((g) => ({ name: g.name, count: g.items.length, selected: g.items.filter((s) => picked.has(s.id)).length }));
  });
  currentTab = computed(() => {
    const names = this.tabs().map((t) => t.name);
    return names.includes(this.tab()) ? this.tab() : names[0] ?? '';
  });
  shownGroups = computed(() => (this.q().trim() ? this.groups() : this.groups().filter((g) => g.name === this.currentTab())));
  lines = computed(() => {
    const by = new Map(this.services().map((s) => [s.id, s]));
    return this.picks().flatMap((p) => {
      const s = by.get(p.service_id);
      if (!s) return [];
      const photo = s.photos.find((x) => x.id === p.photo_id) ?? null;
      const unit = photo ? photo.price : s.price;
      return [{ s, p, photo, amount: unit * p.quantity }];
    });
  });
  total = computed(() => this.lines().reduce((a, l) => a + l.amount, 0));
  whatsapp = computed(() => {
    const r = this.result();
    const phone = (this.info()?.business_phone || '').replace(/\D/g, '');
    if (!r || phone.length < 10) return '';
    const num = phone.length === 10 ? `91${phone}` : phone;
    const text = [
      `Booking ${r.reference} – ${this.form.name}`, `Date: ${fmtDate(r.event_date)}`, '',
      ...r.items.map((i, n) => `${n + 1}. ${i.name}${i.variant_label ? ` (${i.variant_label})` : ''}${i.quantity > 1 ? ` × ${i.quantity}` : ''} – ${inr(i.amount)}`),
      '', `Total: ${inr(r.total)}`,
    ].join('\n');
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  });

  lb = signal<PubService | null>(null);
  lbIndex = signal(0);
  lbMode = signal<'photos' | 'videos'>('photos');
  lbItems = computed<LightboxItem[]>(() => {
    const s = this.lb();
    if (!s) return [];
    if (this.lbMode() === 'videos') return (s.videos ?? []).map((v) => ({ src: v.provider === 'file' ? videoFileUrl(v.id, null, base) : '', label: v.label, video: v }));
    return s.photos.map((p) => ({ src: photoSrc(p.id), label: p.label, price: p.price }));
  });
  selectText = (i: number): string => {
    const s = this.lb();
    const ph = s?.photos[i];
    return s && ph && this.pickFor(s.id)?.photo_id === ph.id ? '✓ Selected' : 'Select this';
  };

  src = photoSrc;
  money = inr;
  dateText = (d: string) => fmtDate(d, true);

  constructor() {
    const slug = inject(ActivatedRoute).snapshot.paramMap.get('slug');
    base = slug ? `/public/c/${encodeURIComponent(slug)}` : '/public';
    document.title = 'Book your event';
    this.load();
  }

  async load(): Promise<void> {
    try {
      const [info, services] = await Promise.all([this.api.get<Info>(`${base}/info`), this.api.get<PubService[]>(`${base}/services`)]);
      this.info.set(info);
      this.services.set(services);
      if (info.business_name) document.title = `Book your event · ${info.business_name}`;
    } catch (e) {
      this.loadError.set(ApiService.message(e));
    } finally {
      this.loading.set(false);
    }
  }

  pickFor(id: number): Pick | undefined {
    return this.picks().find((p) => p.service_id === id);
  }

  unitPrice(s: PubService, p: Pick): number {
    return s.photos.find((x) => x.id === p.photo_id)?.price ?? s.price;
  }

  cover(s: PubService, p: Pick | undefined): string | null {
    const id = p?.photo_id ?? s.photos[0]?.id;
    return id ? `url(${photoSrc(id)})` : null;
  }

  toggle(s: PubService): void {
    if (this.pickFor(s.id)) this.picks.update((l) => l.filter((p) => p.service_id !== s.id));
    else this.picks.update((l) => [...l, { service_id: s.id, photo_id: s.photos[0]?.id ?? null, quantity: 1 }]);
  }

  choose(s: PubService, photoId: number): void {
    if (!this.pickFor(s.id)) this.picks.update((l) => [...l, { service_id: s.id, photo_id: photoId, quantity: 1 }]);
    else this.picks.update((l) => l.map((p) => (p.service_id === s.id ? { ...p, photo_id: photoId } : p)));
  }

  qty(id: number, d: number): void {
    this.picks.update((l) => l.map((p) => (p.service_id === id ? { ...p, quantity: Math.min(1000, Math.max(1, p.quantity + d)) } : p)));
  }

  viewVideos(s: PubService): void {
    this.lbMode.set('videos');
    this.lbIndex.set(0);
    this.lb.set(s);
  }

  view(s: PubService, photoId: number | null): void {
    this.lbMode.set('photos');
    this.lbIndex.set(Math.max(0, s.photos.findIndex((p) => p.id === photoId)));
    this.lb.set(s);
  }

  selectFromViewer(i: number): void {
    const s = this.lb();
    const ph = s?.photos[i];
    if (s && ph) this.choose(s, ph.id);
  }

  goDetails(): void {
    document.getElementById('details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async submit(): Promise<void> {
    this.error.set('');
    const f = this.form;
    if (!this.picks().length) { this.error.set('Please select at least one service.'); return; }
    if (!f.name.trim() || !f.mobile.trim() || !f.event_date) { this.error.set('Please fill in your name, mobile number and event date.'); this.goDetails(); return; }
    this.sending.set(true);
    try {
      // PDF of everything selected, with photos and total. It goes to the owner by email; booking still works without it.
      const pdf = await this.makePdf().catch(() => '');
      this.pdfData.set(pdf);
      const res = await this.api.post<BookingResult>(`${base}/bookings`, {
        ...f, guests: f.guests ?? null, pdf_base64: pdf || null,
        items: this.picks().map(({ service_id, photo_id, quantity }) => ({ service_id, photo_id, quantity })),
      });
      this.result.set(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      const fields = ApiService.fieldErrors(e);
      this.error.set(Object.values(fields)[0] || ApiService.message(e));
    } finally {
      this.sending.set(false);
    }
  }

  private makePdf(): Promise<string> {
    const f = this.form;
    const lines = this.lines().map((l) => ({
      name: l.s.name, category: l.s.category, variant_label: l.photo?.label ?? null, photo_id: l.photo?.id ?? null,
      unit_price: l.photo ? l.photo.price : l.s.price, quantity: l.p.quantity, amount: l.amount,
    }));
    // Keep the headings in price-list order
    const order = new Map(this.services().map((s, i) => [s.name, i]));
    lines.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
    return quotationPdfData({
      business: this.info() ?? {}, title: 'Booking Request',
      event: { name: `${f.name.trim()} – Booking request`, client_name: f.name.trim(), client_mobile: f.mobile.trim(), event_date: f.event_date, venue: f.venue, guests: f.guests },
      lines, subtotal: this.total(), discount: 0, total: this.total(),
      photoUrl: photoSrc, fileName: 'Booking',
      note: 'Estimated prices. Final price is confirmed after we discuss your event.',
    });
  }

  startOver(): void {
    this.pdfData.set('');
    this.result.set(null);
    this.picks.set([]);
    this.form = { ...this.form, event_date: '', venue: '', guests: null, notes: '', website: '' };
  }
}
