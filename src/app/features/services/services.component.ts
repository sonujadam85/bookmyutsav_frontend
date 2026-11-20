import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { Service, ServicePhoto, ServiceVideo } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { groupByCategory, photoUrl, resizeImage, videoFileUrl, videoThumb } from '../../core/service-images';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { IconComponent } from '../../shared/icon.component';
import { LightboxComponent, LightboxItem } from '../../shared/lightbox.component';
import { CategoryTab, CategoryTabsComponent } from '../../shared/category-tabs.component';

/** Services & Prices: master price list. Each service can have many photos, each with its own label and price. */
@Component({
  selector: 'app-services',
  standalone: true,
  imports: [IconComponent, LightboxComponent, CategoryTabsComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end gap-3 mb-6">
      <div class="flex-1 min-w-[220px]">
        <h1 class="page-title">Services &amp; Prices</h1>
        <p class="page-sub">
          {{ services().length }} services.
          @if (auth.isAdmin()) { Services are grouped under headings (click a heading to rename it). Edit a name or price and it saves on its own. Use <b>+ Photos</b> to add several setups, each with its own price. }
          @else { Prices are managed by an admin. }
        </p>
      </div>
      <label class="relative block w-full sm:w-64">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><app-icon name="search" [size]="16" /></span>
        <input class="input pl-9" placeholder="Search service..." [value]="q()" (input)="q.set($any($event.target).value)" />
      </label>
      <a [href]="auth.bookingPath()" target="_blank" rel="noopener" class="btn btn-secondary" title="Page where clients choose services and send a booking"><app-icon name="eye" [size]="16" />Client booking page</a>
      <button class="btn btn-secondary" (click)="copyLink()" title="Copy the booking page link to send to clients"><app-icon name="copy" [size]="16" />Copy link</button>
      @if (auth.isAdmin()) { <button class="btn btn-primary" (click)="addHeading()" [disabled]="busy()"><app-icon name="plus" [size]="16" />New heading</button> }
    </div>

    @if (loading()) { <div class="card card-pad text-ink-400">Loading services...</div> }
    @if (!q().trim() && tabs().length) { <div class="mb-5"><app-category-tabs [tabs]="tabs()" [active]="currentTab()" (activeChange)="tab.set($event)" /></div> }
    @for (g of shownGroups(); track g.name) {
      <section class="mb-8">
        <div class="flex flex-wrap items-center gap-3 mb-3 pb-2 border-b-2 border-brand-100">
          @if (auth.isAdmin()) {
            <input class="input !w-auto min-w-[220px] !py-1.5 font-display !text-xl font-bold !border-transparent hover:!border-ink-200 focus:!border-brand-500 !bg-transparent"
                   [value]="g.name" (change)="renameHeading(g.name, $any($event.target))" aria-label="Heading name" title="Click to rename this heading" />
          } @else { <h2 class="font-display text-xl font-bold">{{ g.name }}</h2> }
          <span class="text-sm text-ink-500">{{ g.items.length }} service{{ g.items.length > 1 ? 's' : '' }}</span>
          <span class="flex-1"></span>
          @if (auth.isAdmin()) { <button class="btn btn-secondary btn-sm" (click)="add(g.name)" [disabled]="busy()"><app-icon name="plus" [size]="14" />Add service here</button> }
        </div>
        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          @for (s of g.items; track s.id) {
            <div class="card overflow-hidden flex flex-col">
              <button type="button" class="relative h-40 bg-ink-100 bg-cover bg-center flex items-center justify-center text-ink-400 text-sm"
                      [style.background-image]="s.photos.length ? 'url(' + url(s.photos[0].id) + ')' : null"
                      (click)="s.photos.length ? view(s, 0) : null" [class.cursor-zoom-in]="s.photos.length" [class.cursor-default]="!s.photos.length">
                @if (!s.photos.length) { <span class="flex flex-col items-center gap-1"><app-icon name="image" [size]="28" />No photos yet</span> }
                @else { <span class="absolute right-2 bottom-2 rounded-md bg-ink-950/60 text-white text-[11px] px-2 py-1">{{ s.photos.length }} photo{{ s.photos.length > 1 ? 's' : '' }} · tap to view</span> }
              </button>

              <div class="p-4 flex flex-col gap-3 flex-1">
                @if (auth.isAdmin()) {
                  <input class="input !py-1.5 font-semibold" [value]="s.name" (change)="rename(s, $any($event.target))" aria-label="Service name" />
                } @else { <p class="font-semibold">{{ s.name }}</p> }

                @if (!s.photos.length) {
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-ink-500">Price ₹</span>
                    @if (auth.isAdmin()) { <input type="number" min="0" class="input !py-1.5 money" [value]="s.price" (change)="setPrice(s, $any($event.target))" aria-label="Price" /> }
                    @else { <span class="font-bold text-brand-700 money">{{ s.price | inr }}</span> }
                  </div>
                } @else {
                  <p class="text-sm text-ink-500">Price: <b class="text-brand-700 money">{{ s.min_price | inr }}@if (s.max_price !== s.min_price) { – {{ s.max_price | inr }} }</b></p>
                  <div class="space-y-1.5">
                    <div class="grid grid-cols-[44px_1fr_96px_28px] gap-2 text-[11px] uppercase tracking-wide text-ink-400 font-semibold">
                      <span>Photo</span><span>Label</span><span>Price ₹</span><span></span>
                    </div>
                    @for (p of s.photos; track p.id; let i = $index) {
                      <div class="grid grid-cols-[44px_1fr_96px_28px] gap-2 items-center">
                        <button type="button" class="w-11 h-11 rounded-lg bg-ink-100 bg-cover bg-center cursor-zoom-in" [style.background-image]="'url(' + url(p.id) + ')'" (click)="view(s, i)" title="View large"></button>
                        @if (auth.isAdmin()) {
                          <input class="input !px-2 !py-1.5 text-xs" [value]="p.label || ''" placeholder="e.g. Yellow" (change)="setPhoto(s, p, { label: $any($event.target).value })" aria-label="Photo label" />
                          <input type="number" min="0" class="input !px-2 !py-1.5 text-xs money" [value]="p.price" (change)="setPhotoPrice(s, p, $any($event.target))" aria-label="Photo price" />
                          <button type="button" class="btn-icon !w-7 !h-7 hover:!text-red-600" (click)="removePhoto(s, p)" title="Remove photo"><app-icon name="x" [size]="15" /></button>
                        } @else {
                          <span class="text-xs truncate">{{ p.label || '—' }}</span><span class="text-xs font-semibold money">{{ p.price | inr }}</span><span></span>
                        }
                      </div>
                    }
                  </div>
                }

                @if (s.videos.length) {
                  <div class="space-y-1.5">
                    <p class="text-[11px] uppercase tracking-wide text-ink-400 font-semibold">Videos</p>
                    @for (v of s.videos; track v.id; let i = $index) {
                      <div class="grid grid-cols-[44px_1fr_28px] gap-2 items-center">
                        <button type="button" class="w-11 h-11 rounded-lg bg-ink-800 bg-cover bg-center text-white flex items-center justify-center text-sm"
                                [style.background-image]="vthumb(v)" (click)="viewVideos(s, i)" [attr.aria-label]="'Play ' + (v.label || 'video')">▶</button>
                        @if (auth.isAdmin()) {
                          <input class="input !px-2 !py-1.5 text-xs" [value]="v.label || ''" [placeholder]="kind(v)" (change)="setVideoLabel(v, $any($event.target).value)" aria-label="Video label" />
                          <button type="button" class="btn-icon !w-7 !h-7 hover:!text-red-600" (click)="removeVideo(s, v)" title="Remove video"><app-icon name="x" [size]="15" /></button>
                        } @else { <span class="text-xs truncate col-span-2">{{ v.label || kind(v) }}</span> }
                      </div>
                    }
                  </div>
                }
                @if (videoUp()?.sid === s.id) {
                  <div class="rounded-lg bg-ink-50 p-2 text-xs">
                    <div class="flex justify-between mb-1"><span>Uploading video...</span><b>{{ videoUp()!.pct }}%</b></div>
                    <div class="h-1.5 rounded-full bg-ink-200 overflow-hidden"><div class="h-full bg-brand-600 transition-all" [style.width.%]="videoUp()!.pct"></div></div>
                  </div>
                }

                @if (auth.isAdmin()) {
                  <div class="flex flex-wrap gap-2 justify-end mt-auto pt-1">
                    <label class="btn btn-secondary btn-sm cursor-pointer" [class.opacity-50]="uploading() === s.id">
                      <app-icon name="upload" [size]="14" />{{ uploading() === s.id ? 'Uploading...' : '+ Photos' }}
                      <input type="file" class="hidden" accept="image/*" multiple (change)="upload(s, $event)" [disabled]="uploading() === s.id" />
                    </label>
                    <label class="btn btn-secondary btn-sm cursor-pointer" [class.opacity-50]="!!videoUp()" title="Upload a video file (MP4, MOV) up to {{ maxVideoMb }} MB">
                      ▶ + Video
                      <input type="file" class="hidden" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/*" (change)="uploadVideo(s, $event)" [disabled]="!!videoUp()" />
                    </label>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="addVideoLink(s)" title="Add a YouTube or Instagram video link">+ Link</button>
                    <button class="btn btn-sm btn-ghost hover:!text-red-600" (click)="remove(s)"><app-icon name="trash" [size]="14" />Delete</button>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </section>
    } @empty {
      @if (!loading()) {
        @if (!services().length) {
          <div class="card card-pad text-center py-12">
            <p class="text-lg font-semibold">No services yet</p>
            <p class="text-sm text-ink-500 mt-1 max-w-md mx-auto">Start with a heading such as <b>Decoration &amp; Setup</b>, <b>Photography</b> or <b>DJ &amp; Sound</b>, then add your services, prices and photos under it.</p>
            @if (auth.isAdmin()) { <button class="btn btn-primary mt-5" (click)="addHeading()" [disabled]="busy()"><app-icon name="plus" [size]="16" />Add your first heading</button> }
          </div>
        } @else { <p class="card card-pad text-center text-ink-400">No service found.</p> }
      }
    }

    <input #replaceInput type="file" class="hidden" accept="image/*" (change)="replace($event)" />
    <app-lightbox [open]="!!lb()" [title]="lb()?.name || ''" [items]="lbItems()" [(index)]="lbIndex"
                  [actionText]="auth.isAdmin() && lbMode() === 'photos' ? replaceText : null" (action)="replaceInput.click()" (closed)="lb.set(null)" />
  `,
})
export class ServicesComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);

  services = signal<Service[]>([]);
  loading = signal(true);
  busy = signal(false);
  uploading = signal<number | null>(null);
  q = signal('');
  filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.services().filter((s) => s.name.toLowerCase().includes(q)) : this.services();
  });

  groups = computed(() => groupByCategory(this.filtered()));
  /** One tab per heading; while searching, every heading is shown. */
  tab = signal('');
  tabs = computed<CategoryTab[]>(() => groupByCategory(this.services()).map((g) => ({ name: g.name, count: g.items.length })));
  currentTab = computed(() => {
    const names = this.tabs().map((t) => t.name);
    return names.includes(this.tab()) ? this.tab() : names[0] ?? '';
  });
  shownGroups = computed(() => (this.q().trim() ? this.groups() : this.groups().filter((g) => g.name === this.currentTab())));


  lb = signal<Service | null>(null);
  lbIndex = signal(0);
  /** The viewer shows either the photos or the videos of a service. */
  lbMode = signal<'photos' | 'videos'>('photos');
  lbItems = computed<LightboxItem[]>(() => {
    const s = this.lb();
    if (!s) return [];
    if (this.lbMode() === 'videos') {
      return s.videos.map((v) => ({ src: v.provider === 'file' ? videoFileUrl(v.id, this.auth.token) : '', label: v.label, video: v }));
    }
    return s.photos.map((p) => ({ src: this.url(p.id), label: p.label, price: p.price }));
  });
  videoUp = signal<{ sid: number; pct: number } | null>(null);
  maxVideoMb = 100;
  private http = inject(HttpClient);
  replaceText = () => 'Replace this photo';

  constructor() {
    this.load();
  }

  url(id: number): string {
    return photoUrl(id, this.auth.token);
  }

  async copyLink(): Promise<void> {
    const link = `${location.origin}${this.auth.bookingPath()}`;
    try {
      await navigator.clipboard.writeText(link);
      this.toast.success(`Link copied: ${link}`);
    } catch {
      this.toast.info(link);
    }
  }

  async load(): Promise<void> {
    try {
      this.services.set(await this.api.get<Service[]>('/services'));
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  /** Swap one service in the list with the copy the server returned. */
  private put(s: Service): void {
    this.services.update((list) => list.map((x) => (x.id === s.id ? s : x)));
    if (this.lb()?.id === s.id) {
      this.lb.set(s);
      const n = this.lbMode() === 'videos' ? s.videos.length : s.photos.length;
      if (this.lbIndex() >= n) this.lbIndex.set(Math.max(0, n - 1));
      if (!n) this.lb.set(null);
    }
  }

  view(s: Service, i: number): void {
    this.lbMode.set('photos');
    this.lbIndex.set(i);
    this.lb.set(s);
  }

  viewVideos(s: Service, i: number): void {
    this.lbMode.set('videos');
    this.lbIndex.set(i);
    this.lb.set(s);
  }

  vthumb(v: ServiceVideo): string | null {
    const t = videoThumb(v);
    return t ? `url(${t})` : null;
  }

  kind(v: ServiceVideo): string {
    return v.provider === 'youtube' ? 'YouTube video' : v.provider === 'instagram' ? 'Instagram video' : v.url || 'Video';
  }

  async addVideoLink(s: Service): Promise<void> {
    const url = window.prompt(`Paste a YouTube or Instagram video link for "${s.name}"`)?.trim();
    if (!url) return;
    try {
      this.put(await this.api.post<Service>(`/services/${s.id}/videos`, { url }));
      this.toast.success('Video added. You can give it a label.');
    } catch (e) {
      this.toast.fail(e);
    }
  }

  /** Upload the file as it is (no resizing), with a progress bar. */
  uploadVideo(s: Service, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > this.maxVideoMb * 1048576) {
      this.toast.error(`This video is ${Math.round(file.size / 1048576)} MB. The limit is ${this.maxVideoMb} MB – upload it to YouTube and use "+ Link".`);
      return;
    }
    const type = file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : 'video/mp4');
    const label = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
    this.videoUp.set({ sid: s.id, pct: 0 });
    this.http.post<Service>(`/api/services/${s.id}/videos/upload`, file, {
      headers: { 'Content-Type': type }, params: { name: file.name, label }, reportProgress: true, observe: 'events',
    }).subscribe({
      next: (e: HttpEvent<Service>) => {
        if (e.type === HttpEventType.UploadProgress) this.videoUp.set({ sid: s.id, pct: Math.round((100 * e.loaded) / (e.total || file.size)) });
        if (e.type === HttpEventType.Response && e.body) { this.put(e.body); this.toast.success('Video uploaded'); }
      },
      error: (e: unknown) => { this.videoUp.set(null); this.toast.fail(e); },
      complete: () => this.videoUp.set(null),
    });
  }

  async setVideoLabel(v: ServiceVideo, label: string): Promise<void> {
    try {
      this.put(await this.api.put<Service>(`/service-videos/${v.id}`, { label: label.trim() }));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async removeVideo(s: Service, v: ServiceVideo): Promise<void> {
    if (!(await this.confirm.delete('this video'))) return;
    try {
      await this.api.delete(`/service-videos/${v.id}`);
      this.put(await this.api.get<Service>(`/services/${s.id}`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async add(category: string): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post<Service>('/services', { name: 'New Service', price: 0, category });
      this.q.set('');
      this.services.set(await this.api.get<Service[]>('/services'));
      this.toast.success(`Service added under ${category}. Change its name and price.`);
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async addHeading(): Promise<void> {
    const name = window.prompt('Name of the new heading (e.g. Catering, Lighting)')?.trim();
    if (!name) return;
    if (this.services().some((s) => (s.category || '').toLowerCase() === name.toLowerCase())) {
      this.toast.info(`"${name}" already exists. Use "Add service here" under it.`);
      return;
    }
    await this.add(name);
  }

  async renameHeading(from: string, el: HTMLInputElement): Promise<void> {
    const to = el.value.trim();
    if (!to || to === from) { el.value = from; return; }
    try {
      this.services.set(await this.api.put<Service[]>('/service-categories', { from, to }));
      this.toast.success(`Heading renamed to ${to}`);
    } catch (e) {
      el.value = from;
      this.toast.fail(e);
    }
  }

  async rename(s: Service, el: HTMLInputElement): Promise<void> {
    const name = el.value.trim();
    if (!name || name === s.name) { el.value = s.name; return; }
    try {
      this.put(await this.api.put<Service>(`/services/${s.id}`, { name }));
      this.toast.success('Name updated');
    } catch (e) {
      el.value = s.name;
      this.toast.fail(e);
    }
  }

  async setPrice(s: Service, el: HTMLInputElement): Promise<void> {
    const price = Math.max(0, Number(el.value) || 0);
    try {
      this.put(await this.api.put<Service>(`/services/${s.id}`, { price }));
      this.toast.success('Price updated');
    } catch (e) {
      el.value = String(s.price);
      this.toast.fail(e);
    }
  }

  setPhotoPrice(s: Service, p: ServicePhoto, el: HTMLInputElement): void {
    this.setPhoto(s, p, { price: Math.max(0, Number(el.value) || 0) }, 'Photo price updated');
  }

  async setPhoto(s: Service, p: ServicePhoto, change: Partial<Pick<ServicePhoto, 'label' | 'price'>>, msg?: string): Promise<void> {
    try {
      this.put(await this.api.put<Service>(`/service-photos/${p.id}`, change));
      if (msg) this.toast.success(msg);
    } catch (e) {
      this.toast.fail(e);
      this.load();
    }
  }

  async upload(s: Service, ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    this.uploading.set(s.id);
    let ok = 0;
    let latest: Service | null = null;
    for (const f of files) {
      try {
        latest = await this.api.post<Service>(`/services/${s.id}/photos`, await resizeImage(f));
        ok++;
      } catch (e) {
        this.toast.error(`${f.name}: ${ApiService.message(e)}`);
      }
    }
    this.uploading.set(null);
    if (latest) this.put(latest);
    if (ok) this.toast.success(`${ok} photo(s) uploaded. Check the price of each photo.`);
  }

  async replace(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const s = this.lb();
    const p = s?.photos[this.lbIndex()];
    if (!file || !s || !p) return;
    try {
      this.put(await this.api.post<Service>(`/service-photos/${p.id}/image`, await resizeImage(file)));
      this.toast.success('Photo replaced');
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async removePhoto(s: Service, p: ServicePhoto): Promise<void> {
    if (!(await this.confirm.delete('this photo', 'Events that already use it keep showing it.'))) return;
    try {
      await this.api.delete(`/service-photos/${p.id}`);
      this.put(await this.api.get<Service>(`/services/${s.id}`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async remove(s: Service): Promise<void> {
    if (!(await this.confirm.delete(`"${s.name}"`, 'It is removed from the price list. Events that already include it keep it.'))) return;
    try {
      await this.api.delete(`/services/${s.id}`);
      this.services.update((l) => l.filter((x) => x.id !== s.id));
      this.toast.success('Service deleted');
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
