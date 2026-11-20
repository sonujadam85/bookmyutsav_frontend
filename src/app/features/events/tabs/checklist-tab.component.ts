import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { ConfirmService } from '../../../core/confirm.service';
import { LookupService } from '../../../core/lookup.service';
import { ToastService } from '../../../core/toast.service';
import { ChecklistItem } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { ModalComponent } from '../../../shared/modal.component';

type Filter = 'all' | 'included' | 'excluded' | 'unconfirmed' | 'pending' | 'completed';

@Component({
  selector: 'app-checklist-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
      @for (c of cards(); track c.key) {
        <button class="stat text-left transition" [class.ring-2]="filter() === c.key" [class.ring-brand-400]="filter() === c.key" (click)="filter.set(c.key)">
          <span class="stat-label">{{ c.label }}</span><span class="stat-value" [class]="c.cls">{{ c.value }}</span>
        </button>
      }
    </div>

    <div class="card card-pad">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="card-title flex-1">Setup &amp; Decoration Checklist</h2>
        <input class="input !w-56 !py-2" placeholder="Search items" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        <select class="input !w-auto !py-2" [ngModel]="filter()" (ngModelChange)="filter.set($event)">
          <option value="all">All items</option><option value="included">Included</option><option value="excluded">Not included</option>
          <option value="unconfirmed">To confirm</option><option value="pending">Pending setup</option><option value="completed">Completed</option>
        </select>
        <button class="btn btn-secondary" (click)="restore()" title="Add any default items that were deleted"><app-icon name="refresh" [size]="16" />Restore defaults</button>
        <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Custom Item</button>
      </div>
      <p class="text-xs text-ink-500 mb-4 flex items-start gap-1.5">
        <app-icon name="alert" [size]="14" class="text-gold-600 mt-0.5" />
        Items start as <b class="mx-1">To confirm</b>. Mark each one Included or Not included after checking with the client — nothing is excluded automatically.
      </p>

      @for (g of grouped(); track g.category) {
        <div class="mb-6 last:mb-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{{ g.category }}</p>
          <div class="divide-y divide-ink-100 rounded-xl border border-ink-100">
            @for (it of g.items; track it.id) {
              <div class="flex flex-wrap items-center gap-3 px-3 sm:px-4 py-3" [class.bg-ink-50]="it.included === 0">
                <label class="inline-flex items-center" [title]="it.included === 1 ? 'Mark setup complete' : 'Include the item first'">
                  <input type="checkbox" class="w-5 h-5 rounded text-emerald-600 disabled:opacity-30" [checked]="!!it.done" [disabled]="it.included !== 1" (change)="toggleDone(it)" />
                </label>
                <div class="flex-1 min-w-[160px]">
                  <p class="font-medium text-sm" [class.line-through]="it.included === 0" [class.text-ink-400]="it.included === 0">
                    <span class="text-ink-400 mr-1">{{ it.sort_order }}.</span>{{ it.name }}
                    @if (it.needs_verification) { <span class="badge bg-gold-50 text-gold-700 ml-1">Verify name</span> }
                    @if (it.done && it.included === 1) { <span class="badge bg-emerald-50 text-emerald-700 ml-1">Done</span> }
                  </p>
                  @if (it.notes) { <p class="text-xs text-ink-500 mt-0.5">{{ it.notes }}</p> }
                  @if (it.material_count) { <p class="text-xs text-brand-700 mt-0.5">{{ it.material_count }} materials · {{ it.material_cost | inr }}</p> }
                </div>
                <div class="inline-flex rounded-lg border border-ink-200 p-0.5 text-xs font-semibold" role="group" [attr.aria-label]="'Include ' + it.name">
                  <button class="px-2.5 py-1.5 rounded-md transition" [class]="it.included === 1 ? 'bg-emerald-600 text-white' : 'text-ink-600 hover:bg-ink-100'" (click)="setIncluded(it, 1)">Included</button>
                  <button class="px-2.5 py-1.5 rounded-md transition" [class]="it.included === 0 ? 'bg-ink-700 text-white' : 'text-ink-600 hover:bg-ink-100'" (click)="setIncluded(it, 0)">Not included</button>
                </div>
                @if (it.included === null) { <span class="badge bg-gold-50 text-gold-700">To confirm</span> }
                <div class="flex">
                  <button class="btn-icon" (click)="edit(it)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                  <button class="btn-icon hover:!text-red-600" (click)="remove(it)" title="Delete"><app-icon name="trash" [size]="16" /></button>
                </div>
              </div>
            }
          </div>
        </div>
      } @empty { <p class="text-center text-ink-400 py-8">No items match this filter.</p> }
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit Checklist Item' : 'Add Custom Item'" (closed)="open.set(false)">
      <form #cf="ngForm" id="clForm" (ngSubmit)="save(cf.valid)" class="space-y-4">
        <div>
          <label class="label">Item Name *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required #nm="ngModel" />
          @if (nm.invalid && nm.touched) { <p class="err">Name is required</p> }
        </div>
        <div>
          <label class="label">Category</label>
          <input class="input" name="category" [(ngModel)]="form.category" list="clCats" />
          <datalist id="clCats">@for (c of lookups.data().checklist_categories; track c) { <option [value]="c"></option> }</datalist>
        </div>
        <div>
          <label class="label">Included?</label>
          <select class="input" name="included" [(ngModel)]="form.included">
            <option [ngValue]="null">To confirm</option><option [ngValue]="1">Included</option><option [ngValue]="0">Not included</option>
          </select>
        </div>
        <div><label class="label">Notes</label><textarea class="input" rows="3" name="notes" [(ngModel)]="form.notes"></textarea></div>
        <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" class="rounded" name="nv" [(ngModel)]="nv" />Item name needs verification</label>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="clForm" [disabled]="saving()">Save</button>
      </div>
    </app-modal>
  `,
})
export class ChecklistTabComponent {
  eventId = input.required<number>();
  changed = output<void>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  lookups = inject(LookupService);

  items = signal<ChecklistItem[]>([]);
  filter = signal<Filter>('all');
  q = signal('');
  open = signal(false);
  saving = signal(false);
  form: Partial<ChecklistItem> = {};
  nv = false;

  cards = computed(() => {
    const l = this.items();
    return [
      { key: 'all' as Filter, label: 'Total items', value: l.length, cls: '' },
      { key: 'included' as Filter, label: 'Included', value: l.filter((i) => i.included === 1).length, cls: 'text-emerald-700' },
      { key: 'unconfirmed' as Filter, label: 'To confirm', value: l.filter((i) => i.included === null).length, cls: 'text-gold-600' },
      { key: 'pending' as Filter, label: 'Pending setup', value: l.filter((i) => i.included === 1 && !i.done).length, cls: 'text-red-600' },
      { key: 'completed' as Filter, label: 'Completed', value: l.filter((i) => i.included === 1 && i.done).length, cls: 'text-brand-700' },
    ];
  });

  grouped = computed(() => {
    const f = this.filter();
    const q = this.q().toLowerCase();
    const list = this.items().filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      switch (f) {
        case 'included': return i.included === 1;
        case 'excluded': return i.included === 0;
        case 'unconfirmed': return i.included === null;
        case 'pending': return i.included === 1 && !i.done;
        case 'completed': return i.included === 1 && !!i.done;
        default: return true;
      }
    });
    const map = new Map<string, ChecklistItem[]>();
    for (const i of list) {
      const k = i.category || 'Other';
      map.set(k, [...(map.get(k) || []), i]);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }));
  });

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (id) this.load();
    });
  }

  async load(): Promise<void> {
    try {
      this.items.set(await this.api.get<ChecklistItem[]>(`/events/${this.eventId()}/checklist`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  private patchLocal(id: number, patch: Partial<ChecklistItem>): void {
    this.items.update((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async setIncluded(it: ChecklistItem, v: 0 | 1): Promise<void> {
    const included = it.included === v ? null : v; // clicking the active option returns the item to "To confirm"
    const patch: Partial<ChecklistItem> = { included, ...(included !== 1 ? { done: 0 } : {}) };
    const prev = { included: it.included, done: it.done };
    this.patchLocal(it.id, patch);
    try {
      await this.api.put(`/checklist/${it.id}`, patch);
      this.changed.emit();
    } catch (e) {
      this.patchLocal(it.id, prev);
      this.toast.fail(e);
    }
  }

  async toggleDone(it: ChecklistItem): Promise<void> {
    const done = it.done ? 0 : 1;
    this.patchLocal(it.id, { done });
    try {
      await this.api.put(`/checklist/${it.id}`, { done });
      this.changed.emit();
    } catch (e) {
      this.patchLocal(it.id, { done: it.done });
      this.toast.fail(e);
    }
  }

  openNew(): void {
    this.form = { name: '', category: '', included: 1, notes: '' };
    this.nv = false;
    this.open.set(true);
  }

  edit(it: ChecklistItem): void {
    this.form = { ...it };
    this.nv = !!it.needs_verification;
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    this.saving.set(true);
    const body = { name: this.form.name, category: this.form.category, included: this.form.included, notes: this.form.notes, needs_verification: this.nv };
    try {
      if (this.form.id) await this.api.put(`/checklist/${this.form.id}`, body);
      else await this.api.post(`/events/${this.eventId()}/checklist`, body);
      this.toast.success('Checklist item saved');
      this.open.set(false);
      await this.load();
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(it: ChecklistItem): Promise<void> {
    const extra = it.material_count ? `${it.material_count} linked material(s) will stay in the materials list without this item.` : 'You can bring default items back with "Restore defaults".';
    if (!(await this.confirm.delete(`"${it.name}"`, extra))) return;
    try {
      await this.api.delete(`/checklist/${it.id}`);
      this.items.update((l) => l.filter((i) => i.id !== it.id));
      this.toast.success('Item deleted');
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async restore(): Promise<void> {
    try {
      const r = await this.api.post<{ added: number; items: ChecklistItem[] }>(`/events/${this.eventId()}/checklist/restore-defaults`);
      this.items.set(r.items);
      this.toast.success(r.added ? `${r.added} default item(s) restored` : 'All default items are already present');
      if (r.added) this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
