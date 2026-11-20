import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { ClientPayment } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Client Payments</h1><p class="page-sub">{{ rows().length }} payments · {{ total() | inr }} received</p></div>
      <a routerLink="/events" [queryParams]="{ pending: 1 }" class="btn btn-secondary"><app-icon name="alert" [size]="16" />Pending payments</a>
    </div>
    <div class="card card-pad mb-6">
      <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="lg:col-span-2"><label class="label">Search</label><input class="input" placeholder="Client, event, receipt no, txn id" [ngModel]="q()" (ngModelChange)="q.set($event)" /></div>
        <div><label class="label">From</label><input type="date" class="input" [ngModel]="from()" (ngModelChange)="from.set($event)" /></div>
        <div><label class="label">To</label><input type="date" class="input" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
        <div>
          <label class="label">Mode</label>
          <select class="input" [ngModel]="mode()" (ngModelChange)="mode.set($event)">
            <option value="">All</option><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        @for (m of byMode(); track m.mode) { <span class="chip">{{ m.mode | label }}: {{ m.amount | inr }}</span> }
      </div>
    </div>
    <div class="card p-2">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Receipt</th><th>Client</th><th>Event</th><th>Installment</th><th>Mode</th><th>Txn ID</th><th class="!text-right">Amount</th><th></th></tr></thead>
          <tbody>
            @for (p of rows(); track p.id) {
              <tr>
                <td class="whitespace-nowrap">{{ p.payment_date | dmy }}</td>
                <td class="font-mono text-xs">{{ p.receipt_no }}</td>
                <td><p class="font-medium">{{ p.client_name }}</p><p class="text-xs text-ink-500">{{ p.client_mobile }}</p></td>
                <td><a [routerLink]="['/events', p.event_id]" [queryParams]="{ tab: 'payments' }" class="hover:text-brand-700">{{ p.event_name }}</a></td>
                <td>{{ p.installment | label }}</td>
                <td><span class="chip">{{ p.mode | label }}</span></td>
                <td class="text-xs">{{ p.transaction_id || '—' }}</td>
                <td class="text-right money font-semibold text-emerald-700">{{ p.amount | inr }}</td>
                <td><a class="btn-icon" [href]="'/receipt/' + p.id" target="_blank" rel="noopener" title="Print receipt"><app-icon name="print" [size]="16" /></a></td>
              </tr>
            } @empty { <tr><td colspan="9" class="text-center text-ink-400 py-8">No payments found</td></tr> }
          </tbody>
          @if (rows().length) { <tfoot><tr><td colspan="7">Total</td><td class="text-right money">{{ total() | inr }}</td><td></td></tr></tfoot> }
        </table>
      </div>
    </div>
  `,
})
export class PaymentsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  rows = signal<ClientPayment[]>([]);
  q = signal('');
  from = signal('');
  to = signal('');
  mode = signal('');
  total = computed(() => this.rows().reduce((s, p) => s + p.amount, 0));
  byMode = computed(() => {
    const m = new Map<string, number>();
    for (const p of this.rows()) m.set(p.mode, (m.get(p.mode) || 0) + p.amount);
    return [...m.entries()].map(([mode, amount]) => ({ mode, amount }));
  });

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const params = { q: this.q(), from: this.from(), to: this.to(), mode: this.mode() };
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.api.get<ClientPayment[]>('/payments', params).then((r) => this.rows.set(r)).catch((e) => this.toast.fail(e));
      }, 250);
    });
  }
}
