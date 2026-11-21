import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject, signal } from '@angular/core';

/** Navy banner on the login and sign-up pages: three slides that change on their own. */
@Component({
  selector: 'app-auth-banner',
  standalone: true,
  imports: [NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  styles: [`
    @keyframes bmuFade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes bmuFill { from { width: 0; } to { width: 100%; } }
    .slide-in { animation: bmuFade .6s ease both; }
    .dot-fill { animation: bmuFill var(--secs) linear both; }
    @media (prefers-reduced-motion: reduce) { .slide-in, .dot-fill { animation: none; } .dot-fill { width: 100%; } }
  `],
  template: `
    <section aria-label="BookMyUtsav highlights" class="relative overflow-hidden bg-brand-900 text-white px-6 pt-6 pb-12 flex flex-col justify-between gap-5 lg:min-h-screen" [ngClass]="details ? 'lg:p-14' : 'lg:px-14 lg:py-12 lg:sticky lg:top-0 lg:h-screen'">
      <svg aria-hidden="true" class="absolute inset-0 w-full h-full opacity-50 pointer-events-none" viewBox="0 0 720 900" preserveAspectRatio="xMidYMid slice">
        <circle cx="640" cy="80" r="220" fill="none" stroke="#0b2c61" stroke-width="1.5" />
        <circle cx="640" cy="80" r="160" fill="none" stroke="#0b2c61" stroke-width="1.5" />
        <circle cx="40" cy="860" r="200" fill="none" stroke="#0b2c61" stroke-width="1.5" />
      </svg>

      <div class="relative flex items-center gap-3">
        <img src="/brand/logo-icon.png" alt="" class="w-9 h-9 lg:w-11 lg:h-11 rounded-xl bg-white object-contain p-1" />
        <div class="flex flex-col">
          <span class="font-bold text-lg lg:text-xl">Book<span class="text-gold-500">My</span>Utsav</span>
          <span class="hidden lg:block text-xs text-brand-200 tracking-[2px] uppercase">Plan • Book • Celebrate</span>
        </div>
      </div>

      @let s = slides[i()];
      <div class="relative">
        @for (x of [i()]; track x) {
          <div class="slide-in flex items-center lg:items-start gap-4 lg:flex-col lg:gap-7">
            <svg [attr.aria-label]="s.art" role="img" class="w-24 h-auto shrink-0 order-2 lg:order-none" [ngClass]="details ? 'lg:w-[420px]' : 'lg:w-[336px]'" viewBox="0 0 420 300">
              @switch (x) {
                @case (0) {
                  <path d="M40 120 Q210 10 380 120" fill="none" stroke="#FF761E" stroke-width="4" stroke-linecap="round" />
                  <path d="M70 120 Q210 40 350 120" fill="none" stroke="#ffa466" stroke-width="2" stroke-linecap="round" />
                  <rect x="52" y="118" width="16" height="140" rx="4" fill="none" stroke="#fff" stroke-width="3" />
                  <rect x="352" y="118" width="16" height="140" rx="4" fill="none" stroke="#fff" stroke-width="3" />
                  <rect x="122" y="128" width="12" height="130" rx="3" fill="none" stroke="#86a5db" stroke-width="2" />
                  <rect x="286" y="128" width="12" height="130" rx="3" fill="none" stroke="#86a5db" stroke-width="2" />
                  <g fill="#FF761E">
                    @for (d of garland; track $index) { <circle [attr.cx]="d[0]" [attr.cy]="d[1]" r="5" /> }
                  </g>
                  <path d="M160 230 h100 v-26 q-50 -30 -100 0 z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" />
                  <rect x="20" y="258" width="380" height="18" rx="4" fill="none" stroke="#fff" stroke-width="3" />
                  <rect x="0" y="276" width="420" height="14" rx="4" fill="none" stroke="#86a5db" stroke-width="2" />
                }
                @case (1) {
                  <path d="M30 40 v-24 h24 M366 16 h24 v24 M390 260 v24 h-24 M54 284 h-24 v-24" fill="none" stroke="#86a5db" stroke-width="3" stroke-linecap="round" />
                  <rect x="80" y="86" width="260" height="160" rx="22" fill="none" stroke="#fff" stroke-width="4" />
                  <path d="M150 86 l18 -28 h84 l18 28" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" />
                  <circle cx="210" cy="166" r="58" fill="none" stroke="#FF761E" stroke-width="5" />
                  <circle cx="210" cy="166" r="38" fill="none" stroke="#ffa466" stroke-width="3" />
                  <circle cx="210" cy="166" r="16" fill="#FF761E" />
                  <rect x="100" y="104" width="34" height="18" rx="5" fill="none" stroke="#86a5db" stroke-width="3" />
                  <circle cx="308" cy="112" r="8" fill="#FF761E" />
                }
                @default {
                  <rect x="20" y="60" width="96" height="220" rx="10" fill="none" stroke="#fff" stroke-width="4" />
                  <circle cx="68" cy="120" r="30" fill="none" stroke="#FF761E" stroke-width="4" /><circle cx="68" cy="120" r="10" fill="#FF761E" />
                  <circle cx="68" cy="220" r="38" fill="none" stroke="#FF761E" stroke-width="4" /><circle cx="68" cy="220" r="13" fill="#FF761E" />
                  <rect x="304" y="60" width="96" height="220" rx="10" fill="none" stroke="#fff" stroke-width="4" />
                  <circle cx="352" cy="120" r="30" fill="none" stroke="#FF761E" stroke-width="4" /><circle cx="352" cy="120" r="10" fill="#FF761E" />
                  <circle cx="352" cy="220" r="38" fill="none" stroke="#FF761E" stroke-width="4" /><circle cx="352" cy="220" r="13" fill="#FF761E" />
                  <rect x="136" y="196" width="148" height="84" rx="10" fill="none" stroke="#86a5db" stroke-width="3" />
                  <circle cx="172" cy="236" r="18" fill="none" stroke="#fff" stroke-width="3" />
                  <circle cx="248" cy="236" r="18" fill="none" stroke="#fff" stroke-width="3" />
                  <path d="M160 150 q50 -40 100 0 M176 126 q34 -26 68 0 M192 104 q18 -14 36 0" fill="none" stroke="#ffa466" stroke-width="3" stroke-linecap="round" />
                }
              }
            </svg>
            <div class="flex-1 flex flex-col gap-2 lg:gap-3.5 max-w-[520px]">
              <span class="text-gold-500 font-semibold text-xs lg:text-sm tracking-[2px] uppercase">{{ s.tag }}</span>
              <h1 class="font-display font-bold text-[26px] leading-tight text-white" [ngClass]="details ? 'lg:text-[46px]' : 'lg:text-[38px]'">{{ s.title }}</h1>
              @if (details) { <p class="hidden lg:block text-[17px] leading-relaxed text-brand-200">{{ s.text }}</p> }
            </div>
          </div>
        }
      </div>

      <div class="relative flex items-center justify-between gap-6">
        <div class="flex items-center gap-2.5">
          @for (d of slides; track $index) {
            <button type="button" (click)="go($index)" [attr.aria-label]="'Show ' + d.tag" [attr.aria-current]="$index === i()"
              class="relative h-1.5 rounded-full bg-brand-700 overflow-hidden transition-all duration-300" [class.w-14]="$index === i()" [class.w-7]="$index !== i()">
              @if ($index === i()) { <span class="dot-fill absolute inset-y-0 left-0 bg-gold-500 rounded-full" [style.--secs]="seconds + 's'"></span> }
            </button>
          }
        </div>
        <div class="hidden items-center gap-3" [ngClass]="{ 'lg:flex': details }">
          <span class="text-sm text-brand-200 tabular-nums">0{{ i() + 1 }} / 0{{ slides.length }}</span>
          <button type="button" (click)="go(i() - 1)" aria-label="Previous slide" class="w-11 h-11 rounded-full border border-brand-500 text-white grid place-items-center hover:bg-brand-800">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button type="button" (click)="go(i() + 1)" aria-label="Next slide" class="w-11 h-11 rounded-full bg-gold-500 text-white grid place-items-center hover:bg-gold-600">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>
    </section>

  `,
})
export class AuthBannerComponent {
  /** Login shows the small text and arrows; sign-up shows a slimmer banner. */
  @Input() details = true;

  // Left banner: slides change on their own every few seconds.
  readonly seconds = 5;
  readonly slides = [
    { tag: 'Decoration & Setup', art: 'Decorated mandap stage', title: 'Har function ki sajawat, ek click mein book.', text: 'Mandap, stage, sofa aur lighting – photo aur price ke saath apne clients ko dikhao.' },
    { tag: 'Photography', art: 'Camera', title: 'Haldi se Reception tak, har pal yaadgaar.', text: 'Photo, video aur pre-wedding shoot ke packages – sab ek hi booking link par.' },
    { tag: 'DJ & Sound', art: 'DJ speakers and console', title: 'Baraat ho ya Sangeet, dhamaal pakka.', text: 'Client package chune, aur booking seedha aapke email par – PDF aur total ke saath.' },
  ];
  // Marigold strings hanging from the mandap.
  readonly garland = ([[100, 98, 4], [160, 76, 5], [210, 68, 6], [260, 76, 5], [320, 98, 4]] as const).flatMap(
    ([x, top, n]) => Array.from({ length: n }, (_, k) => [x, top + k * 16]),
  );
  i = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.startTimer();
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  go(n: number): void {
    this.i.set((n + this.slides.length) % this.slides.length);
    this.startTimer();
  }

  private startTimer(): void {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.i.update((v) => (v + 1) % this.slides.length), this.seconds * 1000);
  }
}
