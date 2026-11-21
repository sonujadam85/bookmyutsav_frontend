import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { FORMAT_PIPES, fmtDate, inr, today } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { LightboxComponent, LightboxItem } from '../../shared/lightbox.component';
import { groupByCategory, videoFileUrl } from '../../core/service-images';
import { quotationPdfData } from '../../core/services-pdf';
import { CategoryTab } from '../../shared/category-tabs.component';
import { NgClass } from '@angular/common';

interface PubPhoto { id: number; label: string | null; price: number; }
interface PubVideo { id: number; provider: 'file' | 'youtube' | 'instagram'; video_id: string | null; label: string | null; }
interface PubService { id: number; name: string; category: string | null; price: number; min_price: number; max_price: number; photos: PubPhoto[]; videos?: PubVideo[]; }
interface Info { business_name: string; business_phone: string; business_email: string; business_address: string; logo_url?: string | null; business_type?: string; }
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
  imports: [FormsModule, NgClass, IconComponent, LightboxComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-ink-50 pb-28 lg:pb-10">
      <!-- Header: the company's own brand -->
      <header class="relative overflow-hidden bg-brand-900 text-white">
        <svg aria-hidden="true" class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMid slice">
          <circle cx="1300" cy="40" r="260" fill="none" stroke="#0b2c61" stroke-width="1.5" />
          <circle cx="1300" cy="40" r="190" fill="none" stroke="#0b2c61" stroke-width="1.5" />
          <circle cx="80" cy="380" r="220" fill="none" stroke="#0b2c61" stroke-width="1.5" />
        </svg>
        <div class="relative max-w-[1240px] mx-auto px-4 sm:px-8 pt-5 sm:pt-9 pb-16 sm:pb-24 flex flex-col gap-5 sm:gap-8">
          <div class="flex items-center gap-3 sm:gap-5">
            <div class="w-[52px] h-[52px] sm:w-[76px] sm:h-[76px] rounded-[14px] sm:rounded-[20px] bg-white grid place-items-center shadow-xl shrink-0 overflow-hidden">
              @if (info()?.logo_url; as logo) { <img [src]="logo" [alt]="bizName() + ' logo'" class="w-full h-full object-contain p-1.5" /> }
              @else { <span class="font-display font-bold text-xl sm:text-3xl text-brand-900">{{ initials() }}</span> }
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-display text-xl sm:text-[30px] font-bold leading-tight truncate">{{ bizName() }}</p>
              @if (subtitle()) { <p class="text-xs sm:text-sm text-brand-200 truncate">{{ subtitle() }}</p> }
            </div>
            @if (callLink(); as tel) {
              <a [href]="tel" class="h-11 sm:h-[46px] w-11 sm:w-auto sm:px-[18px] rounded-xl border border-brand-500 text-white grid sm:flex place-items-center items-center gap-2 font-semibold hover:bg-brand-800 shrink-0" [attr.aria-label]="'Call ' + info()!.business_phone">
                <app-icon name="phone" [size]="17" /><span class="hidden sm:inline">{{ info()!.business_phone }}</span>
              </a>
            }
            @if (chatLink(); as wa) {
              <a [href]="wa" target="_blank" rel="noopener" class="h-11 sm:h-[46px] w-11 sm:w-auto sm:px-[18px] rounded-xl bg-emerald-600 text-white grid sm:flex place-items-center items-center gap-2 font-semibold hover:bg-emerald-700 shrink-0" aria-label="WhatsApp">
                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z" /></svg>
                <span class="hidden sm:inline">WhatsApp</span>
              </a>
            }
          </div>

          @if (!result()) {
            <div class="flex flex-col gap-3.5 max-w-[760px]">
              <p class="hidden sm:block text-gold-500 font-bold text-[13px] tracking-[2.5px] uppercase">Book your event</p>
              <h1 class="font-display text-[28px] sm:text-5xl leading-[1.12] font-bold !text-white">Apne function ki booking, ghar baithe.</h1>
              <p class="hidden sm:block text-[17px] leading-relaxed text-brand-200">Services chuno, photo dekh kar apna setup pasand karo, aur details bhejo. Hum call karke date aur price confirm karenge.</p>
            </div>
            <ul class="hidden sm:flex flex-wrap gap-2.5">
              @for (t of trust; track t) {
                <li class="flex items-center gap-2 px-3.5 py-2 rounded-full bg-brand-800 text-sm text-brand-100"><span class="text-gold-500"><app-icon name="check" [size]="16" [stroke]="2.4" /></span>{{ t }}</li>
              }
            </ul>
          }
        </div>
      </header>

      <!-- Steps -->
      <div class="relative max-w-[1240px] mx-auto px-4 sm:px-8 -mt-10 sm:-mt-14">
        <ol class="bg-white rounded-2xl shadow-lift px-4 sm:px-6 py-3.5 sm:py-[18px] flex items-center gap-2 sm:gap-4">
          @for (st of steps; track $index) {
            @if ($index) { <li aria-hidden="true" class="flex-1 min-w-3 h-0.5" [ngClass]="stepNow() > $index ? 'bg-gold-500' : 'bg-ink-100'"></li> }
            <li class="flex items-center gap-2 sm:gap-2.5 text-sm sm:text-[15px] shrink-0" [attr.aria-current]="stepNow() === $index ? 'step' : null"
                [ngClass]="stepNow() >= $index ? 'font-bold text-brand-900' : 'font-semibold text-ink-500'">
              <span class="w-7 h-7 sm:w-[30px] sm:h-[30px] rounded-full grid place-items-center text-[13px]"
                    [ngClass]="stepNow() > $index ? 'bg-gold-500 text-white' : stepNow() === $index ? 'bg-brand-900 text-white' : 'bg-ink-100 text-ink-600'">
                @if (stepNow() > $index) { <app-icon name="check" [size]="15" [stroke]="2.8" /> } @else { {{ $index + 1 }} }
              </span>
              <span [ngClass]="stepNow() === $index ? 'inline' : 'hidden md:inline'">{{ st }}</span>
            </li>
          }
        </ol>
      </div>

      @if (result(); as r) {
        <!-- Thank you -->
        <main class="max-w-2xl mx-auto px-4 sm:px-6 mt-8">
          <div class="bg-white rounded-[22px] shadow-lift p-6 sm:p-8 text-center">
            <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 grid place-items-center"><app-icon name="check" [size]="32" [stroke]="2.4" /></div>
            <h2 class="font-display text-[28px] font-bold text-brand-900 mt-4">Shukriya, {{ form.name }}!</h2>
            <p class="text-ink-600 mt-2">Aapki booking request mil gayi hai. Hum <b>{{ form.mobile }}</b> par call karke confirm karenge.</p>
            <p class="mt-4 inline-flex flex-wrap justify-center gap-x-2 rounded-xl bg-ink-50 px-4 py-2 text-sm">Booking number <b class="text-brand-700">{{ r.reference }}</b> · {{ dateText(r.event_date) }}</p>
          </div>
          <div class="bg-white rounded-[22px] shadow-lift overflow-hidden mt-4">
            <div class="bg-brand-900 text-white px-5 sm:px-6 py-4 font-display text-xl font-bold">Aapki booking</div>
            <div class="px-5 sm:px-6 py-3">
              @for (i of r.items; track $index) {
                <div class="flex items-center gap-3 py-2.5 border-b border-dashed border-ink-200 last:border-0">
                  @if (i.photo_id) { <img [src]="src(i.photo_id)" alt="" class="w-11 h-11 rounded-[10px] object-cover shrink-0" /> }
                  <span class="flex-1">{{ i.name }}@if (i.variant_label) { <span class="text-ink-500"> ({{ i.variant_label }})</span> }@if (i.quantity > 1) { <span class="text-ink-500"> × {{ i.quantity }}</span> }</span>
                  <b class="money">{{ i.amount | inr }}</b>
                </div>
              }
              <div class="flex justify-between items-baseline pt-3 mt-1 border-t-2 border-dashed border-ink-100">
                <span class="font-semibold text-ink-700">Estimated total</span><span class="text-[28px] font-extrabold text-brand-900 money">{{ r.total | inr }}</span>
              </div>
              <p class="text-xs text-ink-500 mt-1 mb-2">Final price aapke event ki baat karne ke baad confirm hoga.</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 justify-center mt-5">
            @if (pdfData()) { <a class="btn btn-gold !rounded-xl" [href]="pdfData()" [attr.download]="'Booking-' + r.reference + '.pdf'"><app-icon name="download" [size]="16" />PDF download karo</a> }
            @if (whatsapp()) { <a class="btn !rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" [href]="whatsapp()" target="_blank" rel="noopener">WhatsApp par bhejo</a> }
            <button class="btn btn-secondary !rounded-xl" (click)="startOver()">Ek aur booking</button>
          </div>
        </main>
      } @else {
        <main class="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 flex flex-col lg:flex-row gap-7 items-start">
          <section class="flex-1 min-w-0 w-full flex flex-col gap-5">
            <div class="flex flex-wrap gap-3 items-center">
              @if (!q().trim() && tabs().length > 1) {
                <div role="tablist" aria-label="Service headings" class="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap flex-[999_1_auto] pb-1 sm:pb-0">
                  @for (t of tabs(); track t.name) {
                    <button type="button" role="tab" [attr.aria-selected]="currentTab() === t.name" (click)="tab.set(t.name)"
                      class="h-11 px-[18px] rounded-full font-semibold text-[15px] flex items-center gap-2 shrink-0 transition"
                      [ngClass]="currentTab() === t.name ? 'bg-brand-900 text-white' : 'bg-white text-ink-800 border border-ink-200 hover:border-brand-300'">
                      {{ t.name }}
                      <span class="px-2 py-0.5 rounded-full text-xs" [ngClass]="currentTab() === t.name ? 'bg-gold-500 text-white' : t.selected ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600'">{{ t.selected ? t.selected + '/' + t.count : t.count }}</span>
                    </button>
                  }
                </div>
              }
              <label class="relative flex flex-1 basis-[200px] sm:max-w-[260px] min-w-0 ml-auto">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"><app-icon name="search" [size]="18" /></span>
                <input class="w-full min-w-0 h-11 rounded-full border border-ink-200 bg-white pl-11 pr-4 text-[15px] focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" aria-label="Search services" placeholder="Service dhoondho..." [value]="q()" (input)="q.set($any($event.target).value)" />
              </label>
            </div>

            @if (loading()) { <p class="text-ink-500 py-10 text-center">Services load ho rahi hain...</p> }
            @if (loadError()) { <p class="text-red-600 py-10 text-center">{{ loadError() }}</p> }

            @for (g of shownGroups(); track g.name) {
              @if (q().trim() || !(tabs().length > 1)) { <h2 class="font-display text-xl font-bold text-brand-900 mt-2">{{ g.name }}</h2> }
              <div class="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                @for (s of g.items; track s.id) {
                  @let p = pickFor(s.id);
                  <article class="bg-white rounded-[18px] sm:rounded-[20px] overflow-hidden border-2 flex flex-col transition"
                           [ngClass]="p ? 'border-brand-900 shadow-lift' : 'border-transparent shadow-soft hover:shadow-lift'">
                    <button type="button" class="relative h-[150px] sm:h-[190px] bg-brand-50 bg-cover bg-center grid place-items-center text-brand-300"
                            [style.background-image]="cover(s, p)" (click)="s.photos.length ? view(s, p?.photo_id ?? null) : toggle(s)"
                            [attr.aria-label]="s.photos.length ? 'Photos of ' + s.name : 'Select ' + s.name">
                      @if (!s.photos.length) { <app-icon name="sparkle" [size]="40" /> }
                      @else if (s.photos.length > 1) { <span class="absolute left-3 bottom-3 rounded-lg bg-ink-950/70 text-white text-xs font-semibold px-2.5 py-1 inline-flex items-center gap-1"><app-icon name="image" [size]="12" />{{ s.photos.length }} photos</span> }
                      @if (p) { <span class="absolute right-3 top-3 w-[34px] h-[34px] rounded-full bg-brand-900 text-white grid place-items-center shadow"><app-icon name="check" [size]="18" [stroke]="3" /></span> }
                    </button>
                    <div class="p-3.5 sm:p-4 flex flex-col gap-2.5 flex-1">
                      <div class="flex justify-between gap-2.5 items-baseline">
                        <h3 class="text-base sm:text-[17px] font-bold leading-snug">{{ s.name }}</h3>
                        <span class="text-base sm:text-[17px] font-extrabold text-brand-900 money whitespace-nowrap">
                          @if (p) { {{ unitPrice(s, p) | inr }} } @else if (s.max_price !== s.min_price) { <span class="text-xs font-semibold text-ink-500">From </span>{{ s.min_price | inr }} } @else { {{ s.min_price | inr }} }
                        </span>
                      </div>

                      @if (s.videos?.length) {
                        <button type="button" class="self-start inline-flex items-center gap-1.5 rounded-full bg-ink-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-brand-800" (click)="viewVideos(s)">
                          ▶ Video dekho{{ s.videos!.length > 1 ? ' (' + s.videos!.length + ')' : '' }}
                        </button>
                      }

                      @if (p && s.photos.length > 1) {
                        <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                          @for (ph of s.photos; track ph.id) {
                            <button type="button" class="shrink-0 w-[58px] rounded-lg border-2 overflow-hidden text-center" [ngClass]="p.photo_id === ph.id ? 'border-brand-900' : 'border-transparent'"
                                    (click)="choose(s, ph.id)" [attr.aria-label]="(ph.label || 'Option') + ' ' + money(ph.price)" [attr.aria-pressed]="p.photo_id === ph.id">
                              <span class="block h-10 bg-ink-100 bg-cover bg-center" [style.background-image]="'url(' + src(ph.id) + ')'"></span>
                              <span class="block text-[10px] font-semibold text-brand-700 py-0.5 money">{{ ph.price | inr }}</span>
                            </button>
                          }
                        </div>
                      } @else if (!p && s.photos.length > 1) {
                        <p class="text-[13px] text-ink-600">Photo par click karke setup dekho</p>
                      }

                      <div class="mt-auto flex items-center gap-2.5 pt-1">
                        @if (p) {
                          <div class="flex items-center rounded-xl border border-ink-200">
                            <button type="button" class="w-11 h-11 text-xl text-ink-700" (click)="qty(s.id, -1)" aria-label="Kam karo">−</button>
                            <span class="w-7 text-center font-bold">{{ p.quantity }}</span>
                            <button type="button" class="w-11 h-11 text-xl text-ink-700" (click)="qty(s.id, 1)" aria-label="Badhao">+</button>
                          </div>
                          <button type="button" class="ml-auto h-11 px-3 text-sm font-semibold text-ink-600 hover:text-red-600" (click)="toggle(s)">Hatao</button>
                        } @else {
                          <button type="button" class="w-full h-[46px] rounded-xl border-[1.5px] border-gold-500 bg-gold-50 text-gold-700 font-bold text-[15px] hover:bg-gold-100" (click)="toggle(s)">+ Select karo</button>
                        }
                      </div>
                    </div>
                  </article>
                }
              </div>
            } @empty {
              @if (!loading() && !loadError()) { <p class="text-center text-ink-500 py-10">Koi service nahi mili.</p> }
            }
          </section>

          <!-- Your booking -->
          <aside id="details" class="w-full lg:w-[380px] shrink-0 bg-white rounded-[22px] shadow-lift overflow-hidden lg:sticky lg:top-6">
            <div class="bg-brand-900 text-white px-[22px] py-5 flex justify-between items-center gap-3">
              <h2 class="font-display text-[22px] font-bold !text-white">Aapki booking</h2>
              @if (picks().length) { <span class="px-3 py-1 rounded-full bg-gold-500 text-[13px] font-bold">{{ picks().length }} service{{ picks().length > 1 ? 's' : '' }}</span> }
            </div>
            <div class="px-[22px] py-[18px] flex flex-col gap-3 border-b border-ink-100">
              @for (l of lines(); track l.s.id) {
                <div class="flex items-center gap-3">
                  @if (l.photo) { <span class="w-11 h-11 shrink-0 rounded-[10px] bg-cover bg-center" [style.background-image]="'url(' + src(l.photo.id) + ')'"></span> }
                  @else { <span class="w-11 h-11 shrink-0 rounded-[10px] bg-brand-50 text-brand-300 grid place-items-center"><app-icon name="sparkle" [size]="18" /></span> }
                  <span class="flex-1 min-w-0 text-[15px]">{{ l.s.name }}@if (l.photo?.label) { <span class="text-ink-500"> ({{ l.photo!.label }})</span> }@if (l.p.quantity > 1) { <span class="text-ink-500"> × {{ l.p.quantity }}</span> }</span>
                  <b class="text-[15px] money">{{ l.amount | inr }}</b>
                </div>
              } @empty { <p class="text-sm text-ink-500">Abhi koi service nahi chuni. Left side se "+ Select karo" dabao.</p> }
              <div class="flex justify-between items-baseline pt-3 border-t-2 border-dashed border-ink-100">
                <span class="font-semibold text-ink-700">Estimated total</span>
                <span class="text-[30px] font-extrabold text-brand-900 money">{{ total() | inr }}</span>
              </div>
            </div>

            <form class="px-[22px] pt-5 pb-6 flex flex-col gap-3.5" (ngSubmit)="submit()" #f="ngForm">
              <h3 class="text-base font-bold text-brand-900">Apni details</h3>
              <div><label class="label" for="b-name">Aapka naam *</label><input id="b-name" class="input !h-[46px] !rounded-xl" name="name" [(ngModel)]="form.name" required maxlength="150" autocomplete="name" /></div>
              <div><label class="label" for="b-mobile">Mobile number *</label><input id="b-mobile" class="input !h-[46px] !rounded-xl" name="mobile" [(ngModel)]="form.mobile" required inputmode="tel" autocomplete="tel" placeholder="10-digit mobile" /></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="label" for="b-date">Event date *</label><input id="b-date" type="date" class="input !h-[46px] !rounded-xl" name="event_date" [(ngModel)]="form.event_date" [min]="minDate" required /></div>
                <div><label class="label" for="b-guests">Guests</label><input id="b-guests" type="number" min="0" class="input !h-[46px] !rounded-xl" name="guests" [(ngModel)]="form.guests" /></div>
              </div>
              <div><label class="label" for="b-venue">Venue / city</label><input id="b-venue" class="input !h-[46px] !rounded-xl" name="venue" [(ngModel)]="form.venue" maxlength="200" /></div>
              <details class="group" [open]="!!form.email || !!form.notes">
                <summary class="cursor-pointer text-sm font-semibold text-brand-700 list-none flex items-center gap-1.5"><span class="group-open:rotate-45 transition inline-block">+</span> Email aur kuch aur batana hai?</summary>
                <div class="flex flex-col gap-3.5 mt-3">
                  <div><label class="label" for="b-email">Email</label><input id="b-email" type="email" class="input !h-[46px] !rounded-xl" name="email" [(ngModel)]="form.email" autocomplete="email" /></div>
                  <div><label class="label" for="b-notes">Kuch aur?</label><textarea id="b-notes" class="input !rounded-xl" rows="2" name="notes" [(ngModel)]="form.notes" maxlength="2000" placeholder="Rang, theme, timing..."></textarea></div>
                </div>
              </details>
              <!-- Hidden from people; bots fill it -->
              <input type="text" name="website" [(ngModel)]="form.website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />

              @if (error()) { <p class="err text-sm" role="alert">{{ error() }}</p> }
              <button class="mt-1 h-[54px] rounded-[14px] bg-gold-500 hover:bg-gold-600 text-white font-bold text-base flex items-center justify-center gap-2.5 disabled:opacity-60" [disabled]="sending()">
                {{ sending() ? 'Bhej rahe hain...' : 'Booking request bhejo' }}
                @if (!sending()) { <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg> }
              </button>
              <p class="text-[13px] text-ink-600 text-center">Abhi koi payment nahi. Hum call karke date aur price confirm karenge.</p>
            </form>
          </aside>
        </main>

        <!-- Mobile bottom bar -->
        @if (picks().length) {
          <div class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ink-100 shadow-lift px-4 py-3.5 flex items-center gap-3">
            <div class="flex-1"><p class="text-xs text-ink-600">{{ picks().length }} service{{ picks().length > 1 ? 's' : '' }} selected</p><p class="text-[22px] font-extrabold text-brand-900 money">{{ total() | inr }}</p></div>
            <button class="h-[50px] px-[22px] rounded-[14px] bg-gold-500 text-white font-bold" (click)="goDetails()">Aage badho →</button>
          </div>
        }
      }
      <footer class="max-w-6xl mx-auto px-4 sm:px-6 mt-10 flex items-center justify-center gap-2 text-[13px] text-ink-500">
        Powered by <b class="text-brand-900">Book<span class="text-gold-600">My</span>Utsav</b>
      </footer>
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

  readonly trust = ['Abhi koi payment nahi', 'Turant quotation PDF', 'Call karke confirm'];
  readonly steps = ['Services chuno', 'Apni details', 'Booking request bhejo'];
  /** 0 choosing, 1 filling details, 3 all done. */
  stepNow = computed(() => (this.result() ? 3 : this.picks().length ? 1 : 0));
  bizName = computed(() => this.info()?.business_name || 'BookMyUtsav');
  initials = computed(() => this.bizName().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(''));
  subtitle = computed(() => {
    const i = this.info();
    const city = (i?.business_address || '').split(/[\n]/)[0].trim();
    return [i?.business_type, city].filter(Boolean).join(' · ');
  });
  private phoneDigits = computed(() => (this.info()?.business_phone || '').replace(/\D/g, ''));
  callLink = computed(() => (this.phoneDigits().length >= 10 ? `tel:${this.phoneDigits()}` : ''));
  chatLink = computed(() => {
    const d = this.phoneDigits();
    if (d.length < 10) return '';
    const text = `Namaste ${this.bizName()}, mujhe apne event ke liye booking ke baare mein baat karni hai.`;
    return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(text)}`;
  });

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
