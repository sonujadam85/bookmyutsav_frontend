import { ChangeDetectionStrategy, Component, effect, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { Vendor, VendorPayment } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { VendorPaymentFormComponent } from '../../shared/vendor-payment-form.component';

@Component({
  selector: 'app-vendor-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, VendorPaymentFormComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/vendors" class="text-sm text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"><app-icon name="chevronLeft" [size]="16" />Vendors</a>
    @if (vendor(); as v) {
      <div class="flex flex-wrap items-end justify-between gap-4 mt-1 mb-6">
        <div>
          <h1 class="page-title">{{ v.name }}</h1>
          <p class="page-sub">{{ v.service_category || 'Vendor' }}@if (v.contact) { · <a [href]="'tel:' + v.contact">{{ v.contact }}</a> }@if (v.address) { · {{ v.address }} }</p>
        </div>
        <button class="btn btn-primary" (click)="pay()"><app-icon name="plus" [size]="16" />Record Payment</button>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="stat"><span class="stat-label">Total Amount</span><span class="stat-value money">{{ v.total_amount | inr }}</span></div>
        <div class="stat"><span class="stat-label">Advance / Paid</span><span class="stat-value money text-emerald-700">{{ v.amount_paid | inr }}</span></div>
        <div class="stat"><span class="stat-label">Remaining</span><span class="stat-value money text-red-600">{{ v.remaining | inr }}</span></div>
      </div>

      <div class="grid xl:grid-cols-2 gap-6">
        <div class="card card-pad">
          <h2 class="card-title mb-4">Bills (Expenses)</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Date</th><th>Event</th><th>Details</th><th class="!text-right">Total</th><th class="!text-right">Balance</th><th></th></tr></thead>
              <tbody>
                @for (x of v.expenses; track x.id) {
                  <tr>
                    <td class="whitespace-nowrap">{{ x.expense_date | dmy }}</td>
                    <td><a [routerLink]="['/events', x.event_id]" [queryParams]="{ tab: 'expenses' }" class="hover:text-brand-700">{{ x.event_name }}</a></td>
                    <td>{{ x.category }}@if (x.description) { <p class="text-xs text-ink-500">{{ x.description }}</p> }</td>
                    <td class="text-right money">{{ x.total_amount | inr }}</td>
                    <td class="text-right"><span class="money font-semibold" [class.text-red-600]="x.balance > 0">{{ x.balance | inr }}</span><br /><span class="badge" [class]="x.payment_status | badge">{{ x.payment_status | label }}</span></td>
                    <td>@if (x.balance > 0) { <button class="btn btn-secondary btn-sm" (click)="pay(x.id)">Pay</button> }</td>
                  </tr>
                } @empty { <tr><td colspan="6" class="text-center text-ink-400 py-6">No bills yet. Add expenses with this vendor from an event.</td></tr> }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card card-pad">
          <h2 class="card-title mb-4">Payment History</h2>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Date</th><th>Event / Bill</th><th>Mode</th><th class="!text-right">Amount</th><th></th></tr></thead>
              <tbody>
                @for (p of v.payments; track p.id) {
                  <tr>
                    <td class="whitespace-nowrap">{{ p.payment_date | dmy }}</td>
                    <td>{{ p.event_name || 'General' }}@if (p.expense_description) { <p class="text-xs text-ink-500">{{ p.expense_description }}</p> }@if (p.notes) { <p class="text-xs text-ink-400">{{ p.notes }}</p> }</td>
                    <td><span class="chip">{{ p.mode | label }}</span>@if (p.transaction_id) { <p class="text-[11px] text-ink-400">{{ p.transaction_id }}</p> }</td>
                    <td class="text-right money font-semibold">{{ p.amount | inr }}</td>
                    <td class="text-right">@if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="removePayment(p)" title="Delete"><app-icon name="trash" [size]="16" /></button> }</td>
                  </tr>
                } @empty { <tr><td colspan="5" class="text-center text-ink-400 py-6">No separate payments recorded. Amounts paid when a bill was entered are counted in "Paid".</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <app-vendor-payment-form #pf [open]="open()" [fixedVendorId]="v.id" [bills]="v.expenses || []" (closed)="open.set(false)" (saved)="onSaved()" />
    }
  `,
})
export class VendorDetailComponent {
  id = input.required<string>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  pf = viewChild<VendorPaymentFormComponent>('pf');
  vendor = signal<Vendor | null>(null);
  open = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.load();
    });
  }

  async load(): Promise<void> {
    try {
      this.vendor.set(await this.api.get<Vendor>(`/vendors/${this.id()}`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  pay(expenseId: number | null = null): void {
    this.pf()?.reset(null, expenseId);
    this.open.set(true);
  }

  onSaved(): void {
    this.open.set(false);
    this.load();
  }

  async removePayment(p: VendorPayment): Promise<void> {
    if (!(await this.confirm.delete('this payment'))) return;
    try {
      await this.api.delete(`/vendor-payments/${p.id}`);
      this.toast.success('Payment deleted');
      this.load();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
