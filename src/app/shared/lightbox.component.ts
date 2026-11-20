import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, model, output } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from './icon.component';
import { inr } from '../core/format';
import { VideoRef, videoEmbedUrl, videoThumb } from '../core/service-images';

/** A photo (src), an uploaded video (video.provider 'file', src = file address) or a YouTube / Instagram video. */
export interface LightboxItem { src: string; label?: string | null; price?: number | null; video?: VideoRef; }

/**
 * Full-size photo viewer. Browse with ‹ ›, arrow keys, swipe or the thumbnail strip.
 * Usage: <app-lightbox [open]="lb()" [items]="pics" [(index)]="i" [title]="name" (closed)="lb.set(false)"
 *          [actionText]="fn" (action)="onPick($event)" />
 */
@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open() && current(); as it) {
      <div class="fixed inset-0 z-[65] bg-ink-950/95 flex flex-col items-center justify-center px-3 sm:px-16 py-14 no-print" role="dialog" aria-modal="true"
           (click)="$event.target === $event.currentTarget && closed.emit()">
        <button type="button" class="absolute top-3 right-3 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10" (click)="closed.emit()" aria-label="Close"><app-icon name="x" [size]="28" /></button>
        @if (items().length > 1) {
          <button type="button" class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center" (click)="step(-1)" aria-label="Previous photo"><app-icon name="chevronLeft" [size]="26" /></button>
          <button type="button" class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center" (click)="step(1)" aria-label="Next photo"><app-icon name="chevronRight" [size]="26" /></button>
        }
        @if (it.video?.provider === 'file') {
          <video [src]="it.src" controls autoplay playsinline preload="metadata" class="max-w-full max-h-[70vh] rounded-xl shadow-2xl bg-black"></video>
        } @else if (it.video) {
          @if (player(); as url) {
            <div class="w-full flex justify-center" [class]="it.video.provider === 'instagram' ? '' : 'max-w-4xl'">
              <iframe [src]="url" [title]="title()" class="rounded-xl shadow-2xl bg-black border-0"
                      [class]="it.video.provider === 'instagram' ? 'w-[min(400px,92vw)] h-[70vh]' : 'w-full aspect-video max-h-[70vh]'"
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>
          } @else { <p class="text-white/70">This video link cannot be played.</p> }
        } @else {
          <img [src]="it.src" [alt]="title()" class="max-w-full max-h-[70vh] rounded-xl object-contain shadow-2xl select-none"
               (touchstart)="touchStart($event)" (touchend)="touchEnd($event)" />
        }
        <div class="mt-4 text-center text-white flex flex-col items-center gap-3">
          <div>
            <p class="font-semibold">{{ title() }}@if (it.label) { – {{ it.label }} }</p>
            @if (it.price != null) { <p class="text-gold-300 font-bold text-xl">{{ money(it.price) }}</p> }
            @if (items().length > 1) { <p class="text-xs text-white/60">{{ index() + 1 }} / {{ items().length }}</p> }
          </div>
          @if (items().length > 1) {
            <div class="flex flex-wrap justify-center gap-1.5 max-w-xl">
              @for (x of items(); track $index) {
                <button type="button" class="relative w-11 h-11 rounded-md bg-cover bg-center border-2 transition bg-ink-800 text-white flex items-center justify-center"
                        [style.background-image]="thumbOf(x) ? 'url(' + thumbOf(x) + ')' : null"
                        [class]="$index === index() ? 'border-gold-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'"
                        (click)="index.set($index)" [attr.aria-label]="(x.video ? 'Video ' : 'Photo ') + ($index + 1)">@if (x.video) { <span class="text-xs drop-shadow">▶</span> }</button>
              }
            </div>
          }
          @if (actionText(); as fn) {
            @if (fn(index()); as txt) { <button type="button" class="btn btn-gold" (click)="action.emit(index())">{{ txt }}</button> }
          }
        </div>
      </div>
    }
  `,
})
export class LightboxComponent {
  open = input(false);
  title = input('');
  items = input<LightboxItem[]>([]);
  index = model(0);
  /** Optional button under the photo. Return null to hide it for a photo. */
  actionText = input<((i: number) => string | null) | null>(null);
  action = output<number>();
  closed = output<void>();

  current = computed(() => this.items()[Math.min(this.index(), this.items().length - 1)] ?? null);
  private sanitizer = inject(DomSanitizer);
  /** Player address for the current video. Built from a checked id only (see videoEmbedUrl). */
  player = computed<SafeResourceUrl | null>(() => {
    const v = this.current()?.video;
    const url = v ? videoEmbedUrl(v) : null;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  thumbOf(x: LightboxItem): string | null {
    return x.video ? videoThumb(x.video) : x.src;
  }
  money = inr;
  private tx: number | null = null;

  step(d: number): void {
    const n = this.items().length;
    if (n) this.index.set((this.index() + d + n) % n);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.open()) return;
    if (e.key === 'ArrowLeft') this.step(-1);
    else if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'Escape') { e.stopPropagation(); this.closed.emit(); }
  }

  touchStart(e: TouchEvent): void { this.tx = e.touches[0]?.clientX ?? null; }
  touchEnd(e: TouchEvent): void {
    if (this.tx == null) return;
    const d = (e.changedTouches[0]?.clientX ?? this.tx) - this.tx;
    if (Math.abs(d) > 40) this.step(d < 0 ? 1 : -1);
    this.tx = null;
  }
}
