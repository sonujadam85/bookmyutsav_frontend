import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { InventoryItem } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Materials &amp; Stock</h1><p class="page-sub">Stock register. "Used" = quantity allocated to upcoming or in-progress events.</p></div>
      <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Stock Item</button>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="stat"><span class="stat-label">Stock Items</span><span class="stat-value">{{ items().length }}</span></div>
      <div class="stat"><span class="stat-label">Purchased Items</span><span class="stat-value">{{ counts().purchased }}</span></div>
      <div class="stat"><span class="stat-label">Rental Items</span><span class="stat-value">{{ counts().rental }}</span></div>
      <div class="stat"><span class="stat-label">Low / Out of Stock</span><span class="stat-value" [class.text-red-600]="counts().low > 0">{{ counts().low }}</span></div>
    </div>

    <div class="card card-pad">
      <div class="flex flex-wrap gap-3 mb-4">
        <input class="input max-w-xs" placeholder="Search items" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        <select class="input !w-auto" [ngModel]="own()" (ngModelChange)="own.set($event)">
          <option value="">Purchased &amp; rental</option><option value="PURCHASED">Purchased items</option><option value="RENTAL">Rental items</option>
        </select>
        <select class="input !w-auto" [ngModel]="cat()" (ngModelChange)="cat.set($event)">
          <option value="">All categories</option>
          @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
        </select>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Item</th><th>Category</th><th>Type</th><th class="!text-right">Available Stock</th><th class="!text-right">Used</th><th class="!text-right">Remaining</th><th class="!text-right">Purchase</th><th class="!text-right">Rental</th><th>Vendor</th><th></th></tr></thead>
          <tbody>
            @for (i of view(); track i.id) {
              <tr>
                <td><button class="font-semibold hover:text-brand-700 text-left" (click)="showAlloc(i)">{{ i.name }}</button>@if (i.notes) { <p class="text-xs text-ink-500">{{ i.notes }}</p> }</td>
                <td>{{ i.category || '—' }}</td>
                <td><span class="chip">{{ i.ownership | label }}</span></td>
                <td class="text-right">{{ i.total_stock | num }} {{ i.unit }}</td>
                <td class="text-right">{{ i.used_stock | num }}</td>
                <td class="text-right font-semibold" [class.text-red-600]="i.remaining_stock <= 0" [class.text-emerald-700]="i.remaining_stock > 0">{{ i.remaining_stock | num }}</td>
                <td class="text-right money">{{ i.purchase_price | inr }}</td>
                <td class="text-right money">{{ i.rental_price | inr }}</td>
                <td>{{ i.vendor_name || '—' }}</td>
                <td class="text-right whitespace-nowrap">
                  <button class="btn-icon" (click)="showAlloc(i)" title="Where used"><app-icon name="eye" [size]="16" /></button>
                  <button class="btn-icon" (click)="edit(i)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                  @if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="remove(i)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="10" class="text-center text-ink-400 py-8">No stock items</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit Stock Item' : 'Add Stock Item'" size="lg" (closed)="open.set(false)">
      <form #sf="ngForm" id="stockForm" (ngSubmit)="save(sf.valid)" class="grid sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="label">Material Name *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required #nm="ngModel" />
          @if (nm.invalid && nm.touched) { <p class="err">Name is required</p> }
        </div>
        <div>
          <label class="label">Category</label>
          <input class="input" name="category" [(ngModel)]="form.category" list="invCats" />
          <datalist id="invCats">@for (c of lookups.data().material_categories; track c) { <option [value]="c"></option> }</datalist>
        </div>
        <div>
          <label class="label">Type</label>
          <select class="input" name="ownership" [(ngModel)]="form.ownership"><option value="PURCHASED">Purchased (own stock)</option><option value="RENTAL">Rental (hired from vendor)</option></select>
        </div>
        <div><label class="label">Available Stock</label><input type="number" min="0" step="any" class="input" name="total_stock" [(ngModel)]="form.total_stock" /></div>
        <div>
          <label class="label">Unit</label>
          <select class="input" name="unit" [(ngModel)]="form.unit">@for (u of lookups.data().units; track u) { <option [value]="u">{{ u }}</option> }</select>
        </div>
        <div><label class="label">Purchase Price (per unit)</label><input type="number" min="0" step="0.01" class="input" name="purchase_price" [(ngModel)]="form.purchase_price" /></div>
        <div><label class="label">Rental Price (per unit)</label><input type="number" min="0" step="0.01" class="input" name="rental_price" [(ngModel)]="form.rental_price" /></div>
        <div class="sm:col-span-2">
          <label class="label">Vendor</label>
          <select class="input" name="vendor_id" [(ngModel)]="form.vendor_id">
            <option [ngValue]="null">— None —</option>
            @for (v of lookups.data().vendors; track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }
          </select>
        </div>
        <div class="sm:col-span-2"><label class="label">Notes</label><textarea class="input" rows="2" name="notes" [(ngModel)]="form.notes"></textarea></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="stockForm" [disabled]="saving()">Save</button>
      </div>
    </app-modal>

    <app-modal [open]="!!alloc()" [title]="alloc()?.name || ''" subtitle="Allocated to events" size="lg" (closed)="alloc.set(null)">
      @if (alloc(); as a) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Event</th><th>Date</th><th>Status</th><th class="!text-right">Qty</th><th class="!text-right">Cost</th></tr></thead>
            <tbody>
              @for (m of a.allocations || []; track m.id) {
                <tr>
                  <td><a [routerLink]="['/events', m.event_id]" [queryParams]="{ tab: 'materials' }" class="font-medium hover:text-brand-700" (click)="alloc.set(null)">{{ m.event_name }}</a></td>
                  <td>{{ m.event_date | dmy }}</td>
                  <td><span class="badge" [class]="m.event_status | badge">{{ m.event_status | label }}</span></td>
                  <td class="text-right">{{ m.quantity | num }} {{ m.unit }}</td>
                  <td class="text-right money">{{ m.total_cost | inr }}</td>
                </tr>
              } @empty { <tr><td colspan="5" class="text-center text-ink-400 py-6">Not used in any event yet</td></tr> }
            </tbody>
          </table>
        </div>
      }
      <div footer><button class="btn btn-secondary" (click)="alloc.set(null)">Close</button></div>
    </app-modal>
  `,
})
export class InventoryComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  lookups = inject(LookupService);
  auth = inject(AuthService);

  items = signal<InventoryItem[]>([]);
  q = signal('');
  own = signal('');
  cat = signal('');
  open = signal(false);
  saving = signal(false);
  alloc = signal<InventoryItem | null>(null);
  form: Partial<InventoryItem> = {};

  categories = computed(() => [...new Set(this.items().map((i) => i.category).filter((c): c is string => !!c))].sort());
  counts = computed(() => ({
    purchased: this.items().filter((i) => i.ownership === 'PURCHASED').length,
    rental: this.items().filter((i) => i.ownership === 'RENTAL').length,
    low: this.items().filter((i) => i.remaining_stock <= 0).length,
  }));
  view = computed(() => {
    const q = this.q().toLowerCase();
    return this.items().filter((i) => (!q || i.name.toLowerCase().includes(q)) && (!this.own() || i.ownership === this.own()) && (!this.cat() || i.category === this.cat()));
  });

  constructor() {
    this.lookups.load();
    this.load();
  }

  async load(): Promise<void> {
    try {
      this.items.set(await this.api.get<InventoryItem[]>('/inventory'));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  openNew(): void {
    this.form = { name: '', category: '', unit: 'Piece', total_stock: 0, purchase_price: 0, rental_price: 0, ownership: 'PURCHASED', vendor_id: null, notes: '' };
    this.open.set(true);
  }

  edit(i: InventoryItem): void {
    this.form = { ...i };
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    this.saving.set(true);
    const { id, name, category, unit, total_stock, purchase_price, rental_price, ownership, vendor_id, notes } = this.form;
    const body = { name, category, unit, total_stock: total_stock || 0, purchase_price: purchase_price || 0, rental_price: rental_price || 0, ownership, vendor_id, notes };
    try {
      if (id) await this.api.put(`/inventory/${id}`, body);
      else await this.api.post('/inventory', body);
      this.toast.success('Stock item saved');
      this.open.set(false);
      this.load();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async showAlloc(i: InventoryItem): Promise<void> {
    try {
      this.alloc.set(await this.api.get<InventoryItem>(`/inventory/${i.id}`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async remove(i: InventoryItem): Promise<void> {
    if (!(await this.confirm.delete(`"${i.name}"`, 'Event materials that used this item keep their own copy of name and price.'))) return;
    try {
      await this.api.delete(`/inventory/${i.id}`);
      this.toast.success('Stock item deleted');
      this.load();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
