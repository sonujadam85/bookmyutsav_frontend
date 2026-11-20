import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { Vendor } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

export const SERVICE_CATEGORIES = ['Decoration', 'DJ & Sound', 'LED Screen', 'Lighting', 'Stage', 'Furniture', 'Food & Catering', 'Transportation', 'Labour', 'Band & Dhol', 'Flowers', 'Tent', 'Photography', 'Other'];

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Vendors</h1><p class="page-sub">Pending to vendors: <b class="text-red-600">{{ pendingTotal() | inr }}</b></p></div>
      <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Vendor</button>
    </div>

    <div class="card card-pad">
      <div class="flex flex-wrap gap-3 mb-4">
        <input class="input max-w-xs" placeholder="Search vendors" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        <select class="input !w-auto" [ngModel]="cat()" (ngModelChange)="cat.set($event)">
          <option value="">All services</option>
          @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
        </select>
        <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" class="rounded" [ngModel]="onlyPending()" (ngModelChange)="onlyPending.set($event)" />Only with pending payment</label>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Vendor</th><th>Service</th><th>Contact</th><th class="!text-right">Total Amount</th><th class="!text-right">Paid</th><th class="!text-right">Remaining</th><th></th></tr></thead>
          <tbody>
            @for (v of view(); track v.id) {
              <tr>
                <td><a [routerLink]="['/vendors', v.id]" class="font-semibold hover:text-brand-700">{{ v.name }}</a>@if (v.address) { <p class="text-xs text-ink-500">{{ v.address }}</p> }</td>
                <td>{{ v.service_category || '—' }}</td>
                <td>@if (v.contact) { <a [href]="'tel:' + v.contact" class="hover:underline">{{ v.contact }}</a> } @else { — }</td>
                <td class="text-right money">{{ v.total_amount | inr }}</td>
                <td class="text-right money text-emerald-700">{{ v.amount_paid | inr }}</td>
                <td class="text-right money font-semibold" [class.text-red-600]="v.remaining > 0">{{ v.remaining | inr }}</td>
                <td class="text-right whitespace-nowrap">
                  <a class="btn-icon" [routerLink]="['/vendors', v.id]" title="View"><app-icon name="eye" [size]="16" /></a>
                  <button class="btn-icon" (click)="edit(v)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                  @if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="remove(v)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="7" class="text-center text-ink-400 py-8">No vendors found</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit Vendor' : 'Add Vendor'" (closed)="open.set(false)">
      <form #vf="ngForm" id="vendorForm" (ngSubmit)="save(vf.valid)" class="grid sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="label">Vendor Name *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required #nm="ngModel" />
          @if (nm.invalid && nm.touched) { <p class="err">Name is required</p> }
        </div>
        <div>
          <label class="label">Contact Number</label>
          <input class="input" name="contact" [(ngModel)]="form.contact" pattern="^\\+?[0-9\\s-]{10,18}$" #ct="ngModel" inputmode="tel" />
          @if (ct.invalid && ct.touched) { <p class="err">Enter a valid number</p> }
        </div>
        <div>
          <label class="label">Service Category</label>
          <input class="input" name="service_category" [(ngModel)]="form.service_category" list="svcCats" />
          <datalist id="svcCats">@for (c of categories; track c) { <option [value]="c"></option> }</datalist>
        </div>
        <div class="sm:col-span-2"><label class="label">Address</label><textarea class="input" rows="2" name="address" [(ngModel)]="form.address"></textarea></div>
        <div class="sm:col-span-2"><label class="label">Notes</label><textarea class="input" rows="2" name="notes" [(ngModel)]="form.notes"></textarea></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="vendorForm" [disabled]="saving()">Save Vendor</button>
      </div>
    </app-modal>
  `,
})
export class VendorListComponent {
  /** ?pending=1 */
  pending = input<string>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private lookups = inject(LookupService);
  auth = inject(AuthService);

  categories = SERVICE_CATEGORIES;
  vendors = signal<Vendor[]>([]);
  q = signal('');
  cat = signal('');
  onlyPending = signal(false);
  open = signal(false);
  saving = signal(false);
  form: Partial<Vendor> = {};

  view = computed(() => {
    const q = this.q().toLowerCase();
    return this.vendors().filter(
      (v) =>
        (!q || v.name.toLowerCase().includes(q) || (v.contact || '').includes(q) || (v.service_category || '').toLowerCase().includes(q)) &&
        (!this.cat() || v.service_category === this.cat()) &&
        (!this.onlyPending() || v.remaining > 0)
    );
  });
  pendingTotal = computed(() => this.vendors().reduce((s, v) => s + Math.max(v.remaining, 0), 0));

  constructor() {
    effect(() => {
      if (this.pending() === '1') this.onlyPending.set(true);
    });
    this.load();
  }

  async load(): Promise<void> {
    try {
      this.vendors.set(await this.api.get<Vendor[]>('/vendors'));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  openNew(): void {
    this.form = { name: '', contact: '', service_category: '', address: '', notes: '' };
    this.open.set(true);
  }

  edit(v: Vendor): void {
    this.form = { ...v };
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    this.saving.set(true);
    const { id, name, contact, service_category, address, notes } = this.form;
    try {
      const body = { name, contact: contact || null, service_category, address, notes };
      if (id) await this.api.put(`/vendors/${id}`, body);
      else await this.api.post('/vendors', body);
      this.toast.success('Vendor saved');
      this.open.set(false);
      this.load();
      this.lookups.reload();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(v: Vendor): Promise<void> {
    if (!(await this.confirm.delete(`vendor "${v.name}"`))) return;
    try {
      await this.api.delete(`/vendors/${v.id}`);
      this.toast.success('Vendor deleted');
      this.load();
      this.lookups.reload();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
