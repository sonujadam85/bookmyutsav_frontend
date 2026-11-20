import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { ToastService } from '../../../core/toast.service';
import { DocumentItem } from '../../../core/models';
import { FORMAT_PIPES, fileSize } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';

const MAX = 10 * 1024 * 1024;

@Component({
  selector: 'app-documents-tab',
  standalone: true,
  imports: [IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card card-pad">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="card-title flex-1">Documents &amp; Images</h2>
        <label class="btn btn-primary cursor-pointer" [class.opacity-50]="uploading()">
          <app-icon name="upload" [size]="16" />{{ uploading() ? 'Uploading...' : 'Upload Files' }}
          <input type="file" class="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" (change)="upload($event)" [disabled]="uploading()" />
        </label>
      </div>
      <div class="border-2 border-dashed rounded-2xl p-6 text-center text-sm text-ink-500 mb-6 transition"
           [class]="drag() ? 'border-brand-400 bg-brand-50' : 'border-ink-200'"
           (dragover)="$event.preventDefault(); drag.set(true)" (dragleave)="drag.set(false)" (drop)="drop($event)">
        Drag &amp; drop decoration photos, quotations, contracts or ID copies here · up to 10 MB each
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        @for (d of docs(); track d.id) {
          <div class="group rounded-xl border border-ink-100 overflow-hidden bg-white">
            <a [href]="url(d)" target="_blank" rel="noopener" class="block aspect-[4/3] bg-ink-50 flex items-center justify-center overflow-hidden">
              @if (d.mime_type.startsWith('image/')) { <img [src]="url(d)" [alt]="d.caption || d.file_name" class="w-full h-full object-cover" loading="lazy" /> }
              @else { <span class="text-ink-400 flex flex-col items-center gap-1"><app-icon name="file" [size]="32" /><span class="text-xs uppercase">{{ ext(d.file_name) }}</span></span> }
            </a>
            <div class="p-2.5">
              <p class="text-xs font-medium truncate" [title]="d.file_name">{{ d.caption || d.file_name }}</p>
              <p class="text-[11px] text-ink-400">{{ size(d.size) }} · {{ d.created_at.slice(0, 10) | dmy }}</p>
              <div class="flex gap-1 mt-1.5">
                <a class="btn-icon !w-7 !h-7" [href]="url(d, true)" title="Download"><app-icon name="download" [size]="14" /></a>
                <button class="btn-icon !w-7 !h-7" (click)="caption(d)" title="Edit caption"><app-icon name="edit" [size]="14" /></button>
                <button class="btn-icon !w-7 !h-7 hover:!text-red-600" (click)="remove(d)" title="Delete"><app-icon name="trash" [size]="14" /></button>
              </div>
            </div>
          </div>
        } @empty { <p class="col-span-full text-center text-ink-400 py-6">No documents yet.</p> }
      </div>
    </div>
  `,
})
export class DocumentsTabComponent {
  eventId = input.required<number>();
  changed = output<void>();
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  docs = signal<DocumentItem[]>([]);
  uploading = signal(false);
  drag = signal(false);
  size = fileSize;

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (id) this.load();
    });
  }

  url(d: DocumentItem, download = false): string {
    return `/api/documents/${d.id}/file?token=${encodeURIComponent(this.auth.token || '')}${download ? '&download=1' : ''}`;
  }

  ext(name: string): string {
    return name.split('.').pop() || 'file';
  }

  async load(): Promise<void> {
    try {
      this.docs.set(await this.api.get<DocumentItem[]>(`/events/${this.eventId()}/documents`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  upload(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.send(Array.from(input.files || []));
    input.value = '';
  }

  drop(ev: DragEvent): void {
    ev.preventDefault();
    this.drag.set(false);
    this.send(Array.from(ev.dataTransfer?.files || []));
  }

  private read(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  private async send(files: File[]): Promise<void> {
    if (!files.length) return;
    this.uploading.set(true);
    let ok = 0;
    for (const f of files) {
      if (f.size > MAX) {
        this.toast.error(`${f.name} is larger than 10 MB`);
        continue;
      }
      try {
        const data = await this.read(f);
        await this.api.post(`/events/${this.eventId()}/documents`, { file_name: f.name, mime_type: f.type || 'application/octet-stream', data_base64: data });
        ok++;
      } catch (e) {
        this.toast.error(`${f.name}: ${ApiService.message(e)}`);
      }
    }
    this.uploading.set(false);
    if (ok) {
      this.toast.success(`${ok} file(s) uploaded`);
      this.load();
      this.changed.emit();
    }
  }

  async caption(d: DocumentItem): Promise<void> {
    const c = window.prompt('Caption', d.caption || '');
    if (c === null) return;
    try {
      await this.api.put(`/documents/${d.id}`, { caption: c });
      this.load();
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async remove(d: DocumentItem): Promise<void> {
    if (!(await this.confirm.delete(`"${d.file_name}"`))) return;
    try {
      await this.api.delete(`/documents/${d.id}`);
      this.toast.success('Document deleted');
      this.load();
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
