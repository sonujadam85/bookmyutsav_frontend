import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

interface Listing {
  slug: string; name: string; business_type: string; city: string; phone: string;
  logo_url: string | null; cover_url: string | null; services: number; min_price: number;
  highlights: string[]; categories: string[];
}
type Sort = 'price' | 'services' | 'name';

/** Tint and drawing for a card without photos, by business type. */
const LOOKS: { test: RegExp; bg: string; art: 'decor' | 'photo' | 'dj' | 'tent' }[] = [
  { test: /photo|video|studio/i, bg: 'bg-[#e8eef9]', art: 'photo' },
  { test: /dj|sound|music|band/i, bg: 'bg-[#f3ecfb]', art: 'dj' },
  { test: /tent|venue|banquet|cater/i, bg: 'bg-[#eaf6ee]', art: 'tent' },
  { test: /./, bg: 'bg-[#fdeee3]', art: 'decor' },
];
const PAGE = 12;

/** Public home page: every approved event business, by city and type. Clients call, WhatsApp or book online. */
@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgTemplateOutlet, RouterLink, IconComponent, ...FORMAT_PIPES],
  template: `
    <div class="min-h-screen bg-ink-50 text-ink-950">
      <header class="relative overflow-hidden bg-brand-900 text-white">
        <svg aria-hidden="true" class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMid slice">
          <circle cx="1300" cy="60" r="300" fill="none" stroke="#0b2c61" stroke-width="1.5" />
          <circle cx="1300" cy="60" r="220" fill="none" stroke="#0b2c61" stroke-width="1.5" />
          <circle cx="80" cy="600" r="260" fill="none" stroke="#0b2c61" stroke-width="1.5" />
        </svg>
        <nav class="relative max-w-[1240px] mx-auto px-4 sm:px-8 py-4 sm:py-[22px] flex items-center gap-3 sm:gap-6">
          <a routerLink="/" class="flex items-center gap-2.5 flex-1 min-w-0 text-white hover:text-white">
            <img src="/brand/logo-icon.png" alt="" class="w-9 h-9 sm:w-10 sm:h-10 rounded-[11px] bg-white object-contain p-[3px]" />
            <span class="font-extrabold text-lg sm:text-xl">Book<span class="text-gold-500">My</span>Utsav</span>
          </a>
          <a href="#how" class="hidden md:inline text-[15px] font-semibold text-brand-100 hover:text-white">Kaise kaam karta hai</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/dashboard" class="h-10 sm:h-[42px] px-4 rounded-[11px] bg-gold-500 hover:bg-gold-600 text-white font-bold text-sm sm:text-[15px] flex items-center">Mera panel</a>
          } @else {
            <a routerLink="/login" class="h-10 sm:h-[42px] px-3 sm:px-4 rounded-[11px] border border-brand-500 text-white hover:bg-brand-800 font-semibold text-sm sm:text-[15px] flex items-center">
              <span class="sm:hidden">Login</span><span class="hidden sm:inline">Business login</span>
            </a>
            <a routerLink="/signup" class="hidden sm:flex h-[42px] px-4 rounded-[11px] bg-gold-500 hover:bg-gold-600 text-white font-bold text-[15px] items-center">Apna business jodo</a>
          }
        </nav>

        <div class="relative max-w-[1240px] mx-auto px-4 sm:px-8 pt-4 sm:pt-10 pb-20 sm:pb-[120px] flex flex-col sm:items-center sm:text-center gap-4 sm:gap-[18px]">
          <p class="hidden sm:block text-gold-500 font-bold text-[13px] tracking-[2.5px] uppercase">Shaadi · Party · Function</p>
          <h1 class="font-display font-bold !text-white text-[29px] sm:text-[56px] leading-[1.12] max-w-[900px]">Apne City ke event, photo aur DJ wale, ek hi jagah.</h1>
          <p class="hidden sm:block text-lg leading-relaxed text-brand-200 max-w-[680px]">Services aur photos dekho, price compare karo, aur jo pasand aaye usse seedha baat karo ya online booking karo.</p>

          <form class="mt-2 sm:mt-3.5 w-full max-w-[860px] bg-white rounded-[18px] sm:rounded-[20px] p-2 flex flex-col sm:flex-row sm:items-center shadow-2xl text-left" (submit)="$event.preventDefault(); toList()">
            <div class="flex border-b sm:border-b-0 border-ink-100 sm:contents">
              <label class="flex-1 min-w-0 flex flex-col gap-0.5 px-3 sm:px-4 py-2 border-r border-ink-100">
                <span class="text-[11px] sm:text-xs font-bold text-ink-600 uppercase tracking-wider">City</span>
                <select class="border-0 p-0 h-[26px] text-[15px] sm:text-base font-semibold text-ink-950 bg-transparent focus:outline-none cursor-pointer" [value]="city()" (change)="setCity($any($event.target).value)">
                  <option value="">All City</option>
                  @for (c of cities(); track c.name) { <option [value]="c.name">{{ c.name }} ({{ c.count }})</option> }
                </select>
              </label>
              <label class="flex-[1.2] min-w-0 flex flex-col gap-0.5 px-3 sm:px-4 py-2 sm:border-r border-ink-100">
                <span class="text-[11px] sm:text-xs font-bold text-ink-600 uppercase tracking-wider">Service Type</span>
                <select class="border-0 p-0 h-[26px] text-[15px] sm:text-base font-semibold text-ink-950 bg-transparent focus:outline-none cursor-pointer" [value]="type()" (change)="setType($any($event.target).value)">
                  <option value="">All services</option>
                  @for (t of types(); track t.name) { <option [value]="t.name">{{ t.name }}</option> }
                </select>
              </label>
            </div>
            <label class="hidden sm:flex flex-[1.3] min-w-0 flex-col gap-0.5 px-4 py-2">
              <span class="text-xs font-bold text-ink-600 uppercase tracking-wider">Event Name type</span>
              <input class="border-0 p-0 h-[26px] text-base focus:outline-none" placeholder="Jaise: Sharma Events" [value]="q()" (input)="setQ($any($event.target).value)" />
            </label>
            <button class="mt-2 sm:mt-0 h-[46px] sm:h-[58px] px-[26px] rounded-xl sm:rounded-[14px] bg-brand-900 hover:bg-brand-800 text-white font-bold text-base flex items-center justify-center gap-2">
              <span class="text-gold-500"><app-icon name="search" [size]="18" /></span>Search 
            </button>
          </form>
        </div>
      </header>

      <!-- Business types -->
      @if (types().length > 1) {
        <div class="relative max-w-[1240px] mx-auto px-4 sm:px-8 -mt-6 sm:-mt-12 flex gap-2.5 sm:gap-3 overflow-x-auto sm:flex-wrap sm:justify-center pb-1">
          <button type="button" (click)="setType('')" class="shrink-0 flex items-center gap-3 rounded-2xl bg-white px-4 sm:pl-2.5 sm:pr-[18px] py-2.5 shadow-soft text-left border-2" [ngClass]="type() === '' ? 'border-brand-900' : 'border-transparent'">
            <span class="hidden sm:grid w-12 h-12 rounded-xl bg-brand-50 text-brand-700 place-items-center"><app-icon name="dashboard" [size]="22" /></span>
            <span class="flex flex-col"><b class="text-sm sm:text-[15px]">Sab</b><span class="text-xs text-ink-600">{{ inCity().length }} businesses</span></span>
          </button>
          @for (t of types(); track t.name) {
            <button type="button" (click)="setType(t.name)" class="shrink-0 flex items-center gap-3 rounded-2xl bg-white px-4 sm:pl-2.5 sm:pr-[18px] py-2.5 shadow-soft text-left border-2" [ngClass]="type() === t.name ? 'border-brand-900' : 'border-transparent'">
              <span class="hidden sm:grid w-12 h-12 rounded-xl place-items-center overflow-hidden" [ngClass]="look(t.name).bg">
                <ng-container *ngTemplateOutlet="art; context: { $implicit: look(t.name).art, small: true }" />
              </span>
              <span class="flex flex-col"><b class="text-sm sm:text-[15px] whitespace-nowrap">{{ t.name }}</b><span class="text-xs text-ink-600">{{ t.count }} businesses</span></span>
            </button>
          }
        </div>
      }

      <main id="list" class="max-w-[1240px] mx-auto px-4 sm:px-8 pt-8 sm:pt-11 pb-5 flex flex-col gap-5 sm:gap-[22px] scroll-mt-4">
        <div class="flex flex-wrap justify-between items-end gap-3.5">
          <div>
            <h2 class="font-display text-2xl sm:text-[32px] font-bold !text-brand-900">{{ heading() }}</h2>
            <p class="mt-1.5 text-sm sm:text-[15px] text-ink-600">Sab verified hain. Booking ke liye abhi koi payment nahi.</p>
          </div>
          <div class="flex items-center gap-2">
            <label class="sm:hidden relative">
              <span class="sr-only">Naam se dhoondho</span>
              <input class="h-[42px] w-40 rounded-[11px] border border-ink-200 bg-white px-3 text-sm" placeholder="Naam dhoondho" [value]="q()" (input)="setQ($any($event.target).value)" />
            </label>
            <label class="flex items-center gap-2 text-sm text-ink-700">
              <span class="hidden sm:inline">Sort</span>
              <select class="h-[42px] rounded-[11px] border border-ink-200 bg-white px-3 text-sm" [value]="sort()" (change)="sort.set($any($event.target).value)" aria-label="Sort">
                <option value="price">Kam price pehle</option>
                <option value="services">Zyada services pehle</option>
                <option value="name">Naam (A–Z)</option>
              </select>
            </label>
          </div>
        </div>

        @if (loading()) {
          <div class="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            @for (i of [1, 2, 3]; track i) { <div class="h-[360px] rounded-[20px] bg-white animate-pulse"></div> }
          </div>
        } @else if (error()) {
          <div class="rounded-2xl bg-white p-8 text-center text-ink-600">
            <p>List load nahi ho payi: {{ error() }}</p>
            <button class="btn btn-secondary mt-4" (click)="load()">Dobara try karo</button>
          </div>
        } @else if (!shown().length) {
          <div class="rounded-2xl bg-white p-10 text-center">
            <p class="text-lg font-semibold text-ink-800">Is search mein abhi koi business nahi mila.</p>
            <p class="text-ink-600 mt-1">Doosra shehar ya "Sab services" chun kar dekho.</p>
            @if (city() || type() || q()) { <button class="btn btn-secondary mt-4" (click)="clear()">Sab filters hatao</button> }
          </div>
        } @else {
          <div class="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            @for (b of visible(); track b.slug) {
              <article class="bg-white rounded-[18px] sm:rounded-[20px] overflow-hidden shadow-soft hover:shadow-lift transition flex flex-col">
                <a [routerLink]="['/book', b.slug]" class="relative block h-[130px] sm:h-[170px] bg-cover bg-center" [ngClass]="b.cover_url ? 'bg-ink-100' : look(b.business_type).bg"
                   [style.background-image]="b.cover_url ? 'url(' + b.cover_url + ')' : null" [attr.aria-label]="'Services of ' + b.name">
                  @if (!b.cover_url) { <span class="absolute inset-0 grid place-items-center"><ng-container *ngTemplateOutlet="art; context: { $implicit: look(b.business_type).art }" /></span> }
                  @if (b.business_type) { <span class="absolute left-3 sm:left-3.5 top-3 sm:top-3.5 px-2.5 py-1 rounded-full bg-brand-900 text-white text-[11px] sm:text-xs font-bold">{{ b.business_type }}</span> }
                  <span class="hidden sm:inline absolute right-3.5 top-3.5 px-2.5 py-1 rounded-full bg-ink-950/70 text-white text-xs font-semibold">{{ b.services }} services</span>
                  <span class="absolute left-4 -bottom-6 w-12 h-12 sm:w-[58px] sm:h-[58px] rounded-[13px] sm:rounded-2xl bg-white shadow-lift grid place-items-center overflow-hidden">
                    @if (b.logo_url) { <img [src]="b.logo_url" [alt]="b.name + ' logo'" class="w-full h-full object-contain p-1" loading="lazy" /> }
                    @else { <span class="font-display font-bold text-lg sm:text-[21px] text-brand-900">{{ initials(b.name) }}</span> }
                  </span>
                </a>
                <div class="pt-8 sm:pt-9 px-3.5 sm:px-[18px] pb-3.5 sm:pb-[18px] flex flex-col gap-2 sm:gap-2.5 flex-1">
                  <div class="flex justify-between items-baseline gap-2.5">
                    <h3 class="text-base sm:text-lg font-bold leading-snug">{{ b.name }}</h3>
                    @if (b.min_price) { <span class="text-xs sm:text-[13px] text-ink-600 whitespace-nowrap">From <b class="text-[15px] sm:text-[17px] text-brand-900 money">{{ b.min_price | inr }}</b></span> }
                  </div>
                  @if (b.city) { <span class="flex items-center gap-1 text-xs sm:text-[13px] text-ink-600"><app-icon name="pin" [size]="14" />{{ b.city }}<span class="sm:hidden"> · {{ b.services }} services</span></span> }
                  <div class="hidden sm:flex flex-wrap gap-1.5">
                    @for (h of b.highlights; track $index) { <span class="px-2.5 py-1 rounded-full bg-ink-50 border border-ink-100 text-xs text-ink-700">{{ h }}</span> }
                  </div>
                  <div class="mt-auto pt-1.5 flex gap-2">
                    <a [routerLink]="['/book', b.slug]" class="flex-1 h-[42px] sm:h-[46px] rounded-xl bg-gold-500 hover:bg-gold-600 text-white font-bold text-sm sm:text-[15px] flex items-center justify-center">
                      <span class="sm:hidden">Dekho &amp; book karo</span><span class="hidden sm:inline">Services dekho &amp; book karo</span>
                    </a>
                    @if (digits(b.phone); as d) {
                      <a [href]="'tel:' + d" class="hidden sm:grid w-[46px] h-[46px] rounded-xl border border-ink-200 text-brand-700 hover:bg-ink-50 place-items-center" [attr.aria-label]="'Call ' + b.name"><app-icon name="phone" [size]="17" /></a>
                      <a [href]="waLink(b)" target="_blank" rel="noopener" class="w-[42px] h-[42px] sm:w-[46px] sm:h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white grid place-items-center" [attr.aria-label]="'WhatsApp ' + b.name">
                        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z" /></svg>
                      </a>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
          @if (shown().length > visible().length) {
            <button class="self-center mt-2 h-12 px-[26px] rounded-xl border border-ink-200 bg-white font-semibold text-ink-900 hover:bg-ink-50" (click)="showMore()">Aur dikhao ({{ shown().length - visible().length }})</button>
          }
        }
      </main>

      <section id="how" class="max-w-[1240px] mx-auto px-4 sm:px-8 mt-8 sm:mt-10 scroll-mt-4">
        <div class="bg-white rounded-3xl p-6 sm:p-10 grid gap-7 sm:gap-8 md:grid-cols-3 shadow-soft">
          @for (h of how; track $index) {
            <div class="flex flex-col gap-2.5">
              <span class="w-11 h-11 rounded-xl bg-gold-50 text-gold-600 font-extrabold text-lg grid place-items-center">{{ $index + 1 }}</span>
              <h3 class="text-lg font-bold">{{ h.t }}</h3>
              <p class="text-[15px] leading-relaxed text-ink-600">{{ h.d }}</p>
            </div>
          }
        </div>
      </section>

      <section class="max-w-[1240px] mx-auto px-4 sm:px-8 mt-8 sm:mt-10">
        <div class="bg-brand-900 text-white rounded-3xl px-6 sm:px-11 py-8 sm:py-10 flex flex-wrap items-center gap-6">
          <div class="flex-1 min-w-[260px]">
            <h2 class="font-display text-2xl sm:text-[32px] font-bold !text-white">Event business chalate ho?</h2>
            <p class="mt-2 text-[15px] sm:text-base leading-relaxed text-brand-200">BookMyUtsav par apni services, photos aur price daalo. Naye clients seedha aapse booking karenge, aur aapko PDF ke saath email aayega.</p>
          </div>
          <a routerLink="/signup" class="h-[54px] px-7 rounded-[14px] bg-gold-500 hover:bg-gold-600 text-white font-bold flex items-center">Apna business jodo →</a>
        </div>
      </section>

      <footer class="max-w-[1240px] mx-auto px-4 sm:px-8 py-9 flex flex-wrap justify-between gap-3 text-sm text-ink-500">
        <span>© {{ year }} <b class="text-brand-900">Book<span class="text-gold-600">My</span>Utsav</b> · Plan • Book • Celebrate</span>
        <span class="flex gap-3"><a routerLink="/login" class="hover:underline">Business login</a>·<a routerLink="/signup" class="hover:underline">Apna business jodo</a></span>
      </footer>
    </div>

    <ng-template #art let-kind let-small="small">
      @switch (kind) {
        @case ('photo') {
          <svg aria-hidden="true" [attr.width]="small ? 36 : 130" [attr.height]="small ? 28 : 96" viewBox="0 0 420 300"><rect x="80" y="86" width="260" height="160" rx="22" fill="none" stroke="#2f58a6" stroke-width="10" /><path d="M150 86 l18 -28 h84 l18 28" fill="none" stroke="#2f58a6" stroke-width="10" stroke-linejoin="round" /><circle cx="210" cy="166" r="58" fill="none" stroke="#FF761E" stroke-width="11" /><circle cx="210" cy="166" r="18" fill="#FF761E" /></svg>
        }
        @case ('dj') {
          <svg aria-hidden="true" [attr.width]="small ? 38 : 140" [attr.height]="small ? 28 : 100" viewBox="0 0 420 300"><rect x="20" y="60" width="96" height="220" rx="10" fill="none" stroke="#7c3aed" stroke-width="9" /><circle cx="68" cy="210" r="36" fill="none" stroke="#FF761E" stroke-width="9" /><rect x="304" y="60" width="96" height="220" rx="10" fill="none" stroke="#7c3aed" stroke-width="9" /><circle cx="352" cy="210" r="36" fill="none" stroke="#FF761E" stroke-width="9" /><path d="M160 150 q50 -40 100 0 M180 120 q30 -24 60 0" fill="none" stroke="#7c3aed" stroke-width="8" stroke-linecap="round" /></svg>
        }
        @case ('tent') {
          <svg aria-hidden="true" [attr.width]="small ? 36 : 130" [attr.height]="small ? 28 : 96" viewBox="0 0 120 90"><path d="M10 78 L60 14 L110 78 Z" fill="none" stroke="#15803d" stroke-width="4" stroke-linejoin="round" /><path d="M60 14v64M44 78l16-30 16 30" fill="none" stroke="#15803d" stroke-width="4" stroke-linejoin="round" /></svg>
        }
        @default {
          <svg aria-hidden="true" [attr.width]="small ? 40 : 150" [attr.height]="small ? 30 : 104" viewBox="0 0 420 300"><path d="M40 120 Q210 10 380 120" fill="none" stroke="#FF761E" stroke-width="9" stroke-linecap="round" /><rect x="52" y="118" width="16" height="140" rx="4" fill="none" stroke="#e65f0a" stroke-width="7" /><rect x="352" y="118" width="16" height="140" rx="4" fill="none" stroke="#e65f0a" stroke-width="7" /><rect x="20" y="258" width="380" height="18" rx="4" fill="none" stroke="#e65f0a" stroke-width="7" /></svg>
        }
      }
    </ng-template>
  `,
})
export class HomeComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);

  readonly PAGE = PAGE;
  readonly year = new Date().getFullYear();
  readonly how = [
    { t: 'Shehar aur service chuno', d: 'Event management, photographer, DJ ya decorator: jo chahiye woh chuno.' },
    { t: 'Photos aur price dekho', d: 'Har business ki services, photos, videos aur price ek jagah compare karo.' },
    { t: 'Call karo ya online book karo', d: 'Seedha call ya WhatsApp karo, ya services chun kar booking request bhejo.' },
  ];

  list = signal<Listing[]>([]);
  loading = signal(true);
  error = signal('');
  city = signal('');
  type = signal('');
  q = signal('');
  sort = signal<Sort>('price');
  more = signal(PAGE);

  /** Cities with how many businesses each has, most first. */
  cities = computed(() => countBy(this.list().map((b) => b.city).filter(Boolean)));
  inCity = computed(() => (this.city() ? this.list().filter((b) => b.city === this.city()) : this.list()));
  types = computed(() => countBy(this.inCity().map((b) => b.business_type).filter(Boolean)));
  shown = computed(() => {
    const t = this.type();
    const q = this.q().trim().toLowerCase();
    const rows = this.inCity().filter((b) => (!t || b.business_type === t)
      && (!q || b.name.toLowerCase().includes(q) || b.highlights.some((h) => h.toLowerCase().includes(q))));
    const by: Record<Sort, (a: Listing, b: Listing) => number> = {
      price: (a, b) => (a.min_price || 1e12) - (b.min_price || 1e12),
      services: (a, b) => b.services - a.services,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...rows].sort(by[this.sort()]);
  });
  visible = computed(() => this.shown().slice(0, this.more()));
  heading = computed(() => {
    const n = this.shown().length;
    const what = this.type() ? `${this.type()}` : 'event businesses';
    return this.city() ? `${this.city()} ke ${n} ${what}` : `${n} ${what}`;
  });

  constructor() {
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    this.city.set(qp.get('city') || '');
    this.type.set(qp.get('type') || '');
    document.title = 'BookMyUtsav – Event, photo aur DJ booking';
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.list.set(await this.api.get<Listing[]>('/public/directory'));
    } catch (e) {
      this.error.set(ApiService.message(e));
    } finally {
      this.loading.set(false);
    }
  }

  setCity(v: string): void { this.city.set(v); this.type.set(''); this.more.set(PAGE); }
  setType(v: string): void { this.type.set(v); this.more.set(PAGE); }
  setQ(v: string): void { this.q.set(v); this.more.set(PAGE); }
  showMore(): void { this.more.update((m) => m + PAGE); }
  clear(): void { this.city.set(''); this.type.set(''); this.q.set(''); this.more.set(PAGE); }
  toList(): void { document.getElementById('list')?.scrollIntoView({ behavior: 'smooth' }); }

  look(type: string) { return LOOKS.find((l) => l.test.test(type))!; }
  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  }
  digits(phone: string): string {
    const d = (phone || '').replace(/\D/g, '');
    return d.length >= 10 ? d : '';
  }
  waLink(b: Listing): string {
    const d = this.digits(b.phone);
    const text = `Namaste ${b.name}, maine aapko BookMyUtsav par dekha. Mujhe apne event ke liye baat karni hai.`;
    return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(text)}`;
  }
}

function countBy(values: string[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
