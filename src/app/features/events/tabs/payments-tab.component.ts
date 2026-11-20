import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { LookupService } from '../../../core/lookup.service';
import { ToastService } from '../../../core/toast.service';
import { ClientPayment, EventItem, Installment, PaymentMode, PaymentSummary } from '../../../core/models';
import { FORMAT_PIPES, inr, today } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { ModalComponent } from '../../../shared/modal.component';

interface Draft { id?: number; payment_date: string; amount: number | null; mode: PaymentMode; installment: Installment; transaction_id: string; notes: string; }

@Component({
  selector: 'app-payments-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary(); as s) {
      <div class="grid lg:grid-cols-3 gap-6">
        <div class="card card-pad">
          <h2 class="card-title mb-4">Payment Summary</h2>
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between"><dt class="text-ink-500">Total Booking Amount</dt><dd class="font-semibold money">{{ s.booking_amount | inr }}</dd></div>
            <div class="border-t border-dashed border-ink-200"></div>
            <div class="flex justify-between"><dt class="text-ink-500">Advance Received</dt><dd class="money">{{ s.advance_received | inr }}</dd></div>
            <div class="flex justify-between"><dt class="text-ink-500">Second Installment</dt><dd class="money">{{ s.second_installment | inr }}</dd></div>
            <div class="flex justify-between"><dt class="text-ink-500">Third Installment</dt><dd class="money">{{ s.third_installment | inr }}</dd></div>
            <div class="flex justify-between"><dt class="text-ink-500">Final Payment</dt><dd class="money">{{ s.final_payment | inr }}</dd></div>
            @if (s.other_payments) { <div class="flex justify-between"><dt class="text-ink-500">Other Payments</dt><dd class="money">{{ s.other_payments | inr }}</dd></div> }
            <div class="border-t border-ink-200"></div>
            <div class="flex justify-between"><dt class="font-semibold">Total Received</dt><dd class="font-bold money text-emerald-700">{{ s.total_received | inr }}</dd></div>
            <div class="flex justify-between items-center rounded-xl p-3" [class]="s.remaining_balance > 0 ? 'bg-red-50' : 'bg-emerald-50'">
              <dt class="font-semibold">Remaining Balance</dt><dd class="font-bold text-lg money" [class]="s.remaining_balance > 0 ? 'text-red-600' : 'text-emerald-700'">{{ s.remaining_balance | inr }}</dd>
            </div>
          </dl>
          <div class="h-2.5 rounded-full bg-ink-100 mt-5 overflow-hidden"><div class="h-full bg-emerald-500" [style.width.%]="paidPct()"></div></div>
          <p class="text-xs text-ink-500 mt-1">{{ paidPct() }}% collected</p>
          @if (s.remaining_balance < 0) { <p class="err mt-2">Received amount is more than the booking amount ({{ s.remaining_balance * -1 | inr }} extra).</p> }
        </div>

        <div class="card card-pad lg:col-span-2">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <h2 class="card-title flex-1">Payment Entries</h2>
            <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Payment</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Date</th><th>Receipt</th><th>Installment</th><th>Mode</th><th>Txn ID</th><th class="!text-right">Amount</th><th></th></tr></thead>
              <tbody>
                @for (p of payments(); track p.id) {
                  <tr>
                    <td class="whitespace-nowrap">{{ p.payment_date | dmy }}</td>
                    <td class="font-mono text-xs">{{ p.receipt_no }}</td>
                    <td>{{ p.installment | label }}</td>
                    <td><span class="chip">{{ p.mode | label }}</span></td>
                    <td class="text-xs">{{ p.transaction_id || '—' }}@if (p.notes) { <p class="text-ink-400">{{ p.notes }}</p> }</td>
                    <td class="text-right money font-semibold text-emerald-700">{{ p.amount | inr }}</td>
                    <td class="text-right whitespace-nowrap">
                      <a class="btn-icon" [href]="'/receipt/' + p.id" target="_blank" rel="noopener" title="Receipt"><app-icon name="print" [size]="16" /></a>
                      @if (auth.isAdmin()) {
                        <button class="btn-icon" (click)="edit(p)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                        <button class="btn-icon hover:!text-red-600" (click)="remove(p)" title="Delete"><app-icon name="trash" [size]="16" /></button>
                      }
                    </td>
                  </tr>
                } @empty { <tr><td colspan="7" class="text-center text-ink-400 py-8">No payments received yet.</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }

    <app-modal [open]="open()" [title]="d.id ? 'Edit Payment' : 'Add Client Payment'" [subtitle]="event().name + ' · Balance ' + balanceText()" (closed)="open.set(false)">
      <form #pf="ngForm" id="payForm" (ngSubmit)="save(pf.valid)" class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Installment</label>
          <select class="input" name="installment" [(ngModel)]="d.installment">
            <option value="ADVANCE">Advance</option><option value="SECOND">Second Installment</option><option value="THIRD">Third Installment</option>
            <option value="FINAL">Final Payment</option><option value="OTHER">Other</option>
          </select>
        </div>
        <div><label class="label">Payment Date *</label><input type="date" class="input" name="payment_date" [(ngModel)]="d.payment_date" required /></div>
        <div>
          <label class="label">Amount (₹) *</label>
          <input type="number" min="0.01" step="0.01" class="input text-lg font-semibold" name="amount" [(ngModel)]="d.amount" required #am="ngModel" />
          @if (am.invalid && am.touched) { <p class="err">Enter an amount greater than 0</p> }
        </div>
        <div>
          <label class="label">Payment Mode *</label>
          <select class="input" name="mode" [(ngModel)]="d.mode">
            @for (m of lookups.data().payment_modes; track m) { <option [value]="m">{{ m | label }}</option> }
          </select>
        </div>
        <div class="sm:col-span-2"><label class="label">Transaction ID</label><input class="input" name="transaction_id" [(ngModel)]="d.transaction_id" [placeholder]="d.mode === 'CASH' ? 'Optional for cash' : 'UPI / bank reference'" /></div>
        <div class="sm:col-span-2"><label class="label">Payment Notes</label><textarea class="input" rows="2" name="notes" [(ngModel)]="d.notes"></textarea></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="payForm" [disabled]="saving()">Save Payment</button>
      </div>
    </app-modal>
  `,
})
export class PaymentsTabComponent {
  event = input.required<EventItem>();
  changed = output<void>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  lookups = inject(LookupService);

  summary = signal<PaymentSummary | null>(null);
  payments = signal<ClientPayment[]>([]);
  open = signal(false);
  saving = signal(false);
  d: Draft = this.blank();

  paidPct = computed(() => {
    const s = this.summary();
    return s && s.booking_amount > 0 ? Math.min(100, Math.round((s.total_received / s.booking_amount) * 100)) : 0;
  });
  balanceText = computed(() => inr(this.summary()?.remaining_balance));

  constructor() {
    effect(() => {
      const id = this.event().id;
      if (id) this.load(id);
    });
  }

  blank(): Draft {
    return { payment_date: today(), amount: null, mode: 'CASH', installment: 'ADVANCE', transaction_id: '', notes: '' };
  }

  async load(id: number): Promise<void> {
    try {
      const r = await this.api.get<{ summary: PaymentSummary; payments: ClientPayment[] }>(`/events/${id}/payments`);
      this.summary.set(r.summary);
      this.payments.set(r.payments);
    } catch (e) {
      this.toast.fail(e);
    }
  }

  private nextInstallment(): Installment {
    const used = new Set(this.payments().map((p) => p.installment));
    for (const i of ['ADVANCE', 'SECOND', 'THIRD'] as Installment[]) if (!used.has(i)) return i;
    return 'FINAL';
  }

  openNew(): void {
    this.d = { ...this.blank(), installment: this.nextInstallment() };
    const bal = this.summary()?.remaining_balance || 0;
    if (this.d.installment === 'FINAL' && bal > 0) this.d.amount = bal;
    this.open.set(true);
  }

  edit(p: ClientPayment): void {
    this.d = { id: p.id, payment_date: p.payment_date, amount: p.amount, mode: p.mode, installment: p.installment, transaction_id: p.transaction_id || '', notes: p.notes || '' };
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid || !(Number(this.d.amount) > 0)) return;
    const s = this.summary();
    const prev = this.d.id ? this.payments().find((p) => p.id === this.d.id)?.amount || 0 : 0;
    if (s && s.booking_amount > 0 && Number(this.d.amount) - prev > s.remaining_balance) {
      const ok = await this.confirm.ask({
        title: 'Amount exceeds the balance',
        message: `The remaining balance is ${inr(s.remaining_balance)}. Saving ${inr(this.d.amount)} will make total received more than the booking amount.`,
        confirmText: 'Save anyway',
      });
      if (!ok) return;
    }
    this.saving.set(true);
    try {
      const { id, ...body } = this.d;
      const r = id
        ? await this.api.put<{ summary: PaymentSummary }>(`/payments/${id}`, body)
        : await this.api.post<{ summary: PaymentSummary; payment: ClientPayment }>(`/events/${this.event().id}/payments`, body);
      this.toast.success(id ? 'Payment updated' : 'Payment recorded');
      this.open.set(false);
      this.summary.set(r.summary);
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(p: ClientPayment): Promise<void> {
    if (!(await this.confirm.delete(`payment ${p.receipt_no}`, `${inr(p.amount)} received on ${p.payment_date}. The balance will be recalculated.`))) return;
    try {
      await this.api.delete(`/payments/${p.id}`);
      this.toast.success('Payment deleted');
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
