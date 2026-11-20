import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { ConfirmService } from '../../../core/confirm.service';
import { LookupService } from '../../../core/lookup.service';
import { ToastService } from '../../../core/toast.service';
import { ChecklistItem, EventItem, InventoryItem, Material } from '../../../core/models';
import { FORMAT_PIPES, inr } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { ModalComponent } from '../../../shared/modal.component';

@Component({
  selector: 'app-materials-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div class="stat"><span class="stat-label">Total Material Cost</span><span class="stat-value money">{{ summary().total | inr }}</span></div>
      <div class="stat"><span class="stat-label">Purchased</span><span class="stat-value money">{{ summary().purchase | inr }}</span></div>
      <div class="stat"><span class="stat-label">Rental</span><span class="stat-value money">{{ summary().rental | inr }}</span></div>
      <div class="stat"><span class="stat-label">Not Available</span><span class="stat-value" [class.text-red-600]="summary().missing > 0">{{ summary().missing }}</span></div>
    </div>

    <div class="card card-pad">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="card-title flex-1">Materials &amp; Inventory</h2>
        <select class="input !w-auto !py-2" [ngModel]="itemFilter()" (ngModelChange)="itemFilter.set($event)">
          <option [ngValue]="0">All checklist items</option>
          <option [ngValue]="-1">Not linked to an item</option>
          @for (c of checklist(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
        <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Material</button>
      </div>
      <p class="text-xs text-ink-500 mb-4">Total Cost = Quantity × Unit Price (rental or purchase price, as selected). Planned material cost is shown in Profit &amp; Loss for reference; record actual bills under Expenses.</p>

      @for (g of grouped(); track g.key) {
        <div class="mb-6 last:mb-0">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-brand-800">{{ g.title }}</p>
            <p class="text-sm font-semibold money">{{ g.total | inr }}</p>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Material</th><th>Qty</th><th>Type</th><th class="!text-right">Unit Price</th><th class="!text-right">Total</th><th>Vendor</th><th>Required</th><th>Availability</th><th></th></tr></thead>
              <tbody>
                @for (m of g.items; track m.id) {
                  <tr>
                    <td><p class="font-medium">{{ m.name }}</p><p class="text-xs text-ink-500">{{ m.category || '' }}@if (m.inventory_name) { · Stock: {{ m.inventory_name }} }</p>@if (m.notes) { <p class="text-xs text-ink-400">{{ m.notes }}</p> }</td>
                    <td class="whitespace-nowrap">{{ m.quantity | num }} {{ m.unit }}</td>
                    <td><span class="chip">{{ m.price_type | label }}</span></td>
                    <td class="text-right money">{{ (m.price_type === 'PURCHASE' ? m.purchase_price : m.rental_price) | inr }}</td>
                    <td class="text-right money font-semibold">{{ m.total_cost | inr }}</td>
                    <td>{{ m.vendor_name || '—' }}</td>
                    <td class="whitespace-nowrap">{{ m.required_date | dmy }}</td>
                    <td><span class="badge" [class]="m.availability | badge">{{ m.availability | label }}</span></td>
                    <td class="text-right whitespace-nowrap">
                      <button class="btn-icon" (click)="edit(m)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                      <button class="btn-icon hover:!text-red-600" (click)="remove(m)" title="Delete"><app-icon name="trash" [size]="16" /></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @empty {
        <div class="text-center py-10 text-ink-400">
          <p>No materials yet.</p>
          <p class="text-xs mt-1">Example: DJ Setup → Bass 4, Top 4, DJ Truss, LED Screen, Cables, Lighting.</p>
        </div>
      }
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit Material' : 'Add Material'" size="lg" (closed)="open.set(false)">
      <form #mf="ngForm" id="matForm" (ngSubmit)="save(mf.valid)" class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="label">For Checklist Item</label>
          <select class="input" name="checklist_item_id" [(ngModel)]="form.checklist_item_id">
            <option [ngValue]="null">— Not linked —</option>
            @for (c of checklist(); track c.id) { <option [ngValue]="c.id">{{ c.name }}{{ c.included === 0 ? ' (not included)' : '' }}</option> }
          </select>
        </div>
        <div>
          <label class="label">From Stock (optional)</label>
          <select class="input" name="inventory_item_id" [ngModel]="form.inventory_item_id" (ngModelChange)="pickStock($event)">
            <option [ngValue]="null">— Not from stock —</option>
            @for (i of inventory(); track i.id) { <option [ngValue]="i.id">{{ i.name }} ({{ i.remaining_stock | num }} {{ i.unit }} left)</option> }
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="label">Material Name *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required #nm="ngModel" />
          @if (nm.invalid && nm.touched) { <p class="err">Name is required</p> }
        </div>
        <div>
          <label class="label">Category</label>
          <input class="input" name="category" [(ngModel)]="form.category" list="matCats" />
          <datalist id="matCats">@for (c of lookups.data().material_categories; track c) { <option [value]="c"></option> }</datalist>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Quantity *</label>
            <input type="number" min="0" step="any" class="input" name="quantity" [(ngModel)]="form.quantity" required #qt="ngModel" (ngModelChange)="recalc()" />
            @if (qt.invalid && qt.touched) { <p class="err">Required</p> }
          </div>
          <div>
            <label class="label">Unit</label>
            <select class="input" name="unit" [(ngModel)]="form.unit">
              @for (u of lookups.data().units; track u) { <option [value]="u">{{ u }}</option> }
            </select>
          </div>
        </div>
        @if (stockWarning()) { <p class="err sm:col-span-2 -mt-2">{{ stockWarning() }}</p> }
        <div>
          <label class="label">Pricing</label>
          <select class="input" name="price_type" [(ngModel)]="form.price_type" (ngModelChange)="recalc()">
            <option value="RENTAL">Rental</option><option value="PURCHASE">Purchase</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Purchase Price</label><input type="number" min="0" step="0.01" class="input" name="purchase_price" [(ngModel)]="form.purchase_price" (ngModelChange)="recalc()" /></div>
          <div><label class="label">Rental Price</label><input type="number" min="0" step="0.01" class="input" name="rental_price" [(ngModel)]="form.rental_price" (ngModelChange)="recalc()" /></div>
        </div>
        <div>
          <label class="label">Vendor</label>
          <select class="input" name="vendor_id" [(ngModel)]="form.vendor_id">
            <option [ngValue]="null">— None —</option>
            @for (v of lookups.data().vendors; track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }
          </select>
        </div>
        <div><label class="label">Required Date</label><input type="date" class="input" name="required_date" [(ngModel)]="form.required_date" /></div>
        <div>
          <label class="label">Availability</label>
          <select class="input" name="availability" [(ngModel)]="form.availability">
            <option value="AVAILABLE">Available</option><option value="PARTIAL">Partial</option><option value="ORDERED">Ordered</option><option value="NOT_AVAILABLE">Not Available</option>
          </select>
        </div>
        <div class="rounded-xl bg-brand-50 p-4 flex items-center justify-between">
          <span class="text-sm text-brand-800">Total Material Cost</span><span class="font-bold text-lg money text-brand-900">{{ total() }}</span>
        </div>
        <div class="sm:col-span-2"><label class="label">Notes</label><textarea class="input" rows="2" name="notes" [(ngModel)]="form.notes"></textarea></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="matForm" [disabled]="saving()">Save Material</button>
      </div>
    </app-modal>
  `,
})
export class MaterialsTabComponent {
  event = input.required<EventItem>();
  changed = output<void>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  lookups = inject(LookupService);

  materials = signal<Material[]>([]);
  checklist = signal<ChecklistItem[]>([]);
  inventory = signal<InventoryItem[]>([]);
  itemFilter = signal<number>(0);
  open = signal(false);
  saving = signal(false);
  total = signal('₹0');
  stockWarning = signal('');
  form: Partial<Material> = {};

  summary = computed(() => {
    const l = this.materials();
    return {
      total: l.reduce((s, m) => s + m.total_cost, 0),
      purchase: l.filter((m) => m.price_type === 'PURCHASE').reduce((s, m) => s + m.total_cost, 0),
      rental: l.filter((m) => m.price_type === 'RENTAL').reduce((s, m) => s + m.total_cost, 0),
      missing: l.filter((m) => m.availability === 'NOT_AVAILABLE').length,
    };
  });

  grouped = computed(() => {
    const f = this.itemFilter();
    const list = this.materials().filter((m) => (f === 0 ? true : f === -1 ? !m.checklist_item_id : m.checklist_item_id === f));
    const map = new Map<string, { key: string; title: string; items: Material[]; total: number }>();
    for (const m of list) {
      const key = String(m.checklist_item_id || 0);
      const g = map.get(key) || { key, title: m.checklist_item_name || 'General materials', items: [], total: 0 };
      g.items.push(m);
      g.total += m.total_cost;
      map.set(key, g);
    }
    return [...map.values()];
  });

  constructor() {
    effect(() => {
      const id = this.event().id;
      if (id) this.load(id);
    });
  }

  async load(id: number): Promise<void> {
    try {
      const [m, c, i] = await Promise.all([
        this.api.get<Material[]>(`/events/${id}/materials`),
        this.api.get<ChecklistItem[]>(`/events/${id}/checklist`),
        this.api.get<InventoryItem[]>('/inventory'),
      ]);
      this.materials.set(m);
      this.checklist.set(c);
      this.inventory.set(i);
    } catch (e) {
      this.toast.fail(e);
    }
  }

  openNew(): void {
    const f = this.itemFilter();
    this.form = {
      checklist_item_id: f > 0 ? f : null, inventory_item_id: null, name: '', category: '', quantity: 1, unit: 'Piece',
      price_type: 'RENTAL', purchase_price: 0, rental_price: 0, vendor_id: null, required_date: this.event().event_date, availability: 'AVAILABLE', notes: '',
    };
    this.recalc();
    this.open.set(true);
  }

  edit(m: Material): void {
    this.form = { ...m };
    this.recalc();
    this.open.set(true);
  }

  pickStock(id: number | null): void {
    this.form.inventory_item_id = id;
    const i = this.inventory().find((x) => x.id === id);
    if (i) {
      this.form.name = this.form.name || i.name;
      this.form.category = this.form.category || i.category;
      this.form.unit = i.unit;
      this.form.purchase_price = i.purchase_price;
      this.form.rental_price = i.rental_price;
      this.form.price_type = i.ownership === 'RENTAL' ? 'RENTAL' : this.form.price_type;
      this.form.vendor_id = this.form.vendor_id || i.vendor_id;
    }
    this.recalc();
  }

  recalc(): void {
    const f = this.form;
    const price = f.price_type === 'PURCHASE' ? f.purchase_price : f.rental_price;
    this.total.set(inr(Number(f.quantity || 0) * Number(price || 0)));
    const stock = this.inventory().find((x) => x.id === f.inventory_item_id);
    if (stock) {
      // Remaining stock already excludes this material's saved quantity when editing, so add it back.
      const original = f.id ? this.materials().find((m) => m.id === f.id) : undefined;
      const already = original && original.inventory_item_id === stock.id ? original.quantity : 0;
      const available = stock.remaining_stock + already;
      this.stockWarning.set(Number(f.quantity || 0) > available ? `Only ${available} ${stock.unit} of ${stock.name} remaining in stock.` : '');
    } else {
      this.stockWarning.set('');
    }
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    this.saving.set(true);
    const f = this.form;
    const body = {
      checklist_item_id: f.checklist_item_id, inventory_item_id: f.inventory_item_id, name: f.name, category: f.category, quantity: f.quantity, unit: f.unit,
      price_type: f.price_type, purchase_price: f.purchase_price || 0, rental_price: f.rental_price || 0, vendor_id: f.vendor_id,
      required_date: f.required_date || null, availability: f.availability, notes: f.notes,
    };
    try {
      if (f.id) await this.api.put(`/materials/${f.id}`, body);
      else await this.api.post(`/events/${this.event().id}/materials`, body);
      this.toast.success('Material saved');
      this.open.set(false);
      await this.load(this.event().id);
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(m: Material): Promise<void> {
    if (!(await this.confirm.delete(`"${m.name}"`))) return;
    try {
      await this.api.delete(`/materials/${m.id}`);
      this.materials.update((l) => l.filter((x) => x.id !== m.id));
      this.toast.success('Material deleted');
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
