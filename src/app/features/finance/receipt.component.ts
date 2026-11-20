import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { ClientPayment, Settings } from '../../core/models';
import { FORMAT_PIPES, inr } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

interface Receipt {
  business: Settings;
  payment: ClientPayment;
  event: { id: number; name: string; event_date: string; venue: string | null; client_name: string; client_mobile: string; client_address: string | null; client_email: string | null };
  booking_amount: number;
  received_to_date: number;
  balance_after: number;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

/** Indian numbering system: crore, lakh, thousand, hundred. */
export function amountInWords(amount: number): string {
  let n = Math.floor(amount);
  const paise = Math.round((amount - n) * 100);
  if (n === 0 && !paise) return 'Zero Rupees Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${crore >= 100 ? amountInWords(crore).replace(' Rupees Only', '') : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return `${parts.join(' ')} Rupees${paise ? ' and ' + twoDigits(paise) + ' Paise' : ''} Only`;
}

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-ink-100 py-8 px-4 print:bg-white print:p-0">
      <div class="no-print max-w-3xl mx-auto flex justify-end gap-2 mb-4">
        <button class="btn btn-secondary" (click)="close()">Close</button>
        <button class="btn btn-primary" (click)="print()"><app-icon name="print" [size]="16" />Print / Save PDF</button>
      </div>
      @if (error()) { <div class="max-w-3xl mx-auto card card-pad text-red-600">{{ error() }}</div> }
      @if (receipt(); as r) {
        <div class="max-w-3xl mx-auto bg-white shadow-lift print:shadow-none rounded-2xl print:rounded-none overflow-hidden">
          <div class="bg-brand-950 text-white px-8 py-6 flex justify-between items-start print:bg-brand-950" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <div>
              <p class="font-display text-2xl">{{ r.business.business_name }}</p>
              @if (r.business.business_address) { <p class="text-sm text-brand-200 whitespace-pre-line mt-1">{{ r.business.business_address }}</p> }
              <p class="text-sm text-brand-200">{{ r.business.business_phone }}@if (r.business.business_email) { · {{ r.business.business_email }} }</p>
              @if (r.business.gstin) { <p class="text-xs text-brand-300 mt-1">GSTIN: {{ r.business.gstin }}</p> }
            </div>
            <div class="text-right">
              <p class="text-xs uppercase tracking-[0.2em] text-gold-300">Payment Receipt</p>
              <p class="font-mono text-lg mt-1">{{ r.payment.receipt_no }}</p>
              <p class="text-sm text-brand-200">{{ r.payment.payment_date | dmy }}</p>
            </div>
          </div>
          <div class="px-8 py-6">
            <div class="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p class="label">Received from</p>
                <p class="font-semibold text-base">{{ r.event.client_name }}</p>
                <p>{{ r.event.client_mobile }}</p>
                @if (r.event.client_address) { <p class="text-ink-500">{{ r.event.client_address }}</p> }
              </div>
              <div>
                <p class="label">For event</p>
                <p class="font-semibold text-base">{{ r.event.name }}</p>
                <p>{{ r.event.event_date | dmy: true }}</p>
                @if (r.event.venue) { <p class="text-ink-500">{{ r.event.venue }}</p> }
              </div>
            </div>

            <div class="mt-8 rounded-2xl border-2 border-brand-100 p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="label">Amount received</p>
                <p class="text-3xl font-bold text-brand-900 money">{{ r.payment.amount | inr }}</p>
                <p class="text-sm text-ink-600 mt-1 italic">{{ words() }}</p>
              </div>
              <div class="text-sm text-right">
                <p><span class="text-ink-500">Installment:</span> {{ r.payment.installment | label }}</p>
                <p><span class="text-ink-500">Mode:</span> {{ r.payment.mode | label }}</p>
                @if (r.payment.transaction_id) { <p><span class="text-ink-500">Txn ID:</span> {{ r.payment.transaction_id }}</p> }
              </div>
            </div>
            @if (r.payment.notes) { <p class="text-sm text-ink-600 mt-3">Note: {{ r.payment.notes }}</p> }

            <table class="w-full text-sm mt-8">
              <tr class="border-b border-ink-100"><td class="py-2 text-ink-500">Total booking amount</td><td class="py-2 text-right money">{{ r.booking_amount | inr }}</td></tr>
              <tr class="border-b border-ink-100"><td class="py-2 text-ink-500">Total received (including this receipt)</td><td class="py-2 text-right money text-emerald-700">{{ r.received_to_date | inr }}</td></tr>
              <tr><td class="py-3 font-semibold">Balance due</td><td class="py-3 text-right money font-bold text-lg">{{ r.balance_after | inr }}</td></tr>
            </table>

            <div class="flex justify-between items-end mt-16 text-sm">
              <p class="text-ink-500 max-w-sm">{{ r.business.receipt_footer || 'Thank you for your payment. This is a computer generated receipt.' }}</p>
              <div class="text-center">
                <div class="w-48 border-t border-ink-400 mb-1"></div>
                <p class="text-ink-600">Authorised Signatory</p>
                @if (r.payment.received_by_name) { <p class="text-xs text-ink-400">Received by {{ r.payment.received_by_name }}</p> }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ReceiptComponent {
  paymentId = input.required<string>();
  private api = inject(ApiService);
  receipt = signal<Receipt | null>(null);
  error = signal('');
  words = signal('');

  constructor() {
    effect(() => {
      const id = this.paymentId();
      this.api
        .get<Receipt>(`/payments/${id}/receipt`)
        .then((r) => {
          this.words.set(amountInWords(r.payment.amount));
          this.receipt.set(r);
          document.title = `Receipt ${r.payment.receipt_no} - ${inr(r.payment.amount)}`;
        })
        .catch((e) => this.error.set(ApiService.message(e)));
    });
  }

  print(): void {
    window.print();
  }

  close(): void {
    if (window.opener) window.close();
    else history.back();
  }
}
