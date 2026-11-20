import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { ToastService } from '../../../core/toast.service';
import { EventItem, Expense, VendorPayment } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { VendorPaymentFormComponent } from '../../../shared/vendor-payment-form.component';

interface EventVendor { id: number; name: string; contact: string | null; service_category: string | null; billed: number; paid: number; pending: number; material_count: number; }

@Component({
  selector: 'app-vendors-tab',
  standalone: true,
  imports: [RouterLink, IconComponent, VendorPaymentFormComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="stat"><span class="stat-label">Vendor Billed</span><span class="stat-value money">{{ totals().billed | inr }}</span></div>
      <div class="stat"><span class="stat-label">Paid to Vendors</span><span class="stat-value money text-emerald-700">{{ totals().paid | inr }}</span></div>
      <div class="stat"><span class="stat-label">Vendor Pending</span><span class="stat-value money text-red-600">{{ totals().pending | inr }}</span></div>
    </div>

    <div class="card card-pad mb-6">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <h2 class="card-title flex-1">Vendors for this Event</h2>
        <button class="btn btn-primary" (click)="pay(null)" [disabled]="!vendors().length"><app-icon name="plus" [size]="16" />Record Vendor Payment</button>
      </div>
      <p class="text-xs text-ink-500 mb-4">Vendors appear here when you assign them to an expense or material of this event.</p>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Vendor</th><th>Service</th><th>Contact</th><th class="!text-right">Billed</th><th class="!text-right">Paid</th><th class="!text-right">Pending</th><th></th></tr></thead>
          <tbody>
            @for (v of vendors(); track v.id) {
              <tr>
                <td><a [routerLink]="['/vendors', v.id]" class="font-semibold hover:text-brand-700">{{ v.name }}</a>@if (v.material_count) { <p class="text-xs text-ink-500">{{ v.material_count }} materials</p> }</td>
                <td>{{ v.service_category || '—' }}</td>
                <td>{{ v.contact || '—' }}</td>
                <td class="text-right money">{{ v.billed | inr }}</td>
                <td class="text-right money text-emerald-700">{{ v.paid | inr }}</td>
                <td class="text-right money font-semibold" [class.text-red-600]="v.pending > 0">{{ v.pending | inr }}</td>
                <td class="text-right">@if (v.pending > 0) { <button class="btn btn-secondary btn-sm" (click)="pay(v.id)">Pay</button> }</td>
              </tr>
            } @empty { <tr><td colspan="7" class="text-center text-ink-400 py-8">No vendors linked yet.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <div class="card card-pad">
      <h2 class="card-title mb-4">Vendor Payment History</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Vendor</th><th>Bill</th><th>Mode</th><th>Txn ID</th><th class="!text-right">Amount</th><th></th></tr></thead>
          <tbody>
            @for (p of payments(); track p.id) {
              <tr>
                <td class="whitespace-nowrap">{{ p.payment_date | dmy }}</td>
                <td>{{ p.vendor_name }}</td>
                <td>{{ p.expense_description || (p.expense_id ? 'Bill #' + p.expense_id : 'General') }}</td>
                <td><span class="chip">{{ p.mode | label }}</span></td>
                <td>{{ p.transaction_id || '—' }}</td>
                <td class="text-right money font-semibold">{{ p.amount | inr }}</td>
                <td class="text-right">@if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="removePayment(p)" title="Delete"><app-icon name="trash" [size]="16" /></button> }</td>
              </tr>
            } @empty { <tr><td colspan="7" class="text-center text-ink-400 py-6">No vendor payments recorded for this event. Payments made when adding an expense are included in "Paid" above.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <app-vendor-payment-form #pf [open]="open()" [vendors]="vendors()" [bills]="bills()" [eventId]="event().id" (closed)="open.set(false)" (saved)="onSaved()" />
  `,
})
export class VendorsTabComponent {
  event = input.required<EventItem>();
  changed = output<void>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  pf = viewChild.required<VendorPaymentFormComponent>('pf');

  vendors = signal<EventVendor[]>([]);
  payments = signal<VendorPayment[]>([]);
  bills = signal<Expense[]>([]);
  open = signal(false);
  totals = computed(() => ({
    billed: this.vendors().reduce((s, v) => s + v.billed, 0),
    paid: this.vendors().reduce((s, v) => s + v.paid, 0),
    pending: this.vendors().reduce((s, v) => s + Math.max(v.pending, 0), 0),
  }));

  constructor() {
    effect(() => {
      const id = this.event().id;
      if (id) this.load(id);
    });
  }

  async load(id: number): Promise<void> {
    try {
      const [v, x] = await Promise.all([
        this.api.get<{ vendors: EventVendor[]; payments: VendorPayment[] }>(`/events/${id}/vendors`),
        this.api.get<{ items: Expense[] }>(`/events/${id}/expenses`),
      ]);
      this.vendors.set(v.vendors);
      this.payments.set(v.payments);
      this.bills.set(x.items);
    } catch (e) {
      this.toast.fail(e);
    }
  }

  pay(vendorId: number | null): void {
    const bill = vendorId ? this.bills().find((b) => b.vendor_id === vendorId && b.balance > 0) : undefined;
    this.pf().reset(vendorId, bill?.id ?? null);
    this.open.set(true);
  }

  onSaved(): void {
    this.open.set(false);
    this.load(this.event().id);
    this.changed.emit();
  }

  async removePayment(p: VendorPayment): Promise<void> {
    if (!(await this.confirm.delete('this vendor payment'))) return;
    try {
      await this.api.delete(`/vendor-payments/${p.id}`);
      this.toast.success('Payment deleted');
      this.load(this.event().id);
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
