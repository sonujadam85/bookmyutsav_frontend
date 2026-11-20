import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { LookupService } from '../core/lookup.service';
import { ToastService } from '../core/toast.service';
import { Expense, PaymentMode } from '../core/models';
import { FORMAT_PIPES, today } from '../core/format';
import { ModalComponent } from './modal.component';

/** Record a payment to a vendor, optionally against one of their unpaid bills. */
@Component({
  selector: 'app-vendor-payment-form',
  standalone: true,
  imports: [FormsModule, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Record Vendor Payment" (closed)="closed.emit()">
      <form #vf="ngForm" id="vpForm" (ngSubmit)="save(vf.valid)" class="grid sm:grid-cols-2 gap-4">
        @if (!fixedVendorId()) {
          <div class="sm:col-span-2">
            <label class="label">Vendor *</label>
            <select class="input" name="vendor" [ngModel]="vendorId()" (ngModelChange)="vendorId.set($event); expenseId = null" required>
              <option [ngValue]="null" disabled>Select vendor</option>
              @for (v of vendorOptions(); track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }
            </select>
          </div>
        }
        <div class="sm:col-span-2">
          <label class="label">Against Bill (optional)</label>
          <select class="input" name="expense" [(ngModel)]="expenseId">
            <option [ngValue]="null">General / advance payment</option>
            @for (x of openBills(); track x.id) { <option [ngValue]="x.id">{{ x.expense_date | dmy }} · {{ x.category }} {{ x.description ? '– ' + x.description : '' }} · balance {{ x.balance | inr }}</option> }
          </select>
        </div>
        <div><label class="label">Payment Date *</label><input type="date" class="input" name="date" [(ngModel)]="date" required /></div>
        <div><label class="label">Amount (₹) *</label><input type="number" min="0.01" step="0.01" class="input" name="amount" [(ngModel)]="amount" required /></div>
        <div>
          <label class="label">Mode *</label>
          <select class="input" name="mode" [(ngModel)]="mode">
            @for (m of lookups.data().payment_modes; track m) { <option [value]="m">{{ m | label }}</option> }
          </select>
        </div>
        <div><label class="label">Transaction ID</label><input class="input" name="txn" [(ngModel)]="txn" /></div>
        <div class="sm:col-span-2"><label class="label">Notes</label><input class="input" name="notes" [(ngModel)]="notes" /></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="vpForm" [disabled]="saving() || !vendorId()">Save Payment</button>
      </div>
    </app-modal>
  `,
})
export class VendorPaymentFormComponent {
  open = input(false);
  /** Set when used from a vendor page. */
  fixedVendorId = input<number | null>(null);
  /** Restrict vendor list (event tab) */
  vendors = input<{ id: number; name: string }[] | null>(null);
  /** Bills to choose from */
  bills = input<Expense[]>([]);
  eventId = input<number | null>(null);
  closed = output<void>();
  saved = output<void>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  lookups = inject(LookupService);
  saving = signal(false);
  vendorId = signal<number | null>(null);
  expenseId: number | null = null;
  date = today();
  amount: number | null = null;
  mode: PaymentMode = 'CASH';
  txn = '';
  notes = '';

  vendorOptions = computed(() => this.vendors() || this.lookups.data().vendors);
  openBills = computed(() => this.bills().filter((b) => b.vendor_id === (this.fixedVendorId() || this.vendorId()) && b.balance > 0));

  reset(vendorId: number | null = null, expenseId: number | null = null): void {
    this.vendorId.set(this.fixedVendorId() || vendorId);
    this.expenseId = expenseId;
    this.date = today();
    const bill = this.bills().find((b) => b.id === expenseId);
    this.amount = bill ? bill.balance : null;
    this.mode = 'CASH';
    this.txn = '';
    this.notes = '';
  }

  async save(valid: boolean | null): Promise<void> {
    const vid = this.fixedVendorId() || this.vendorId();
    if (!valid || !vid) return;
    this.saving.set(true);
    try {
      await this.api.post(`/vendors/${vid}/payments`, {
        expense_id: this.expenseId, event_id: this.expenseId ? null : this.eventId(), payment_date: this.date, amount: this.amount, mode: this.mode,
        transaction_id: this.txn, notes: this.notes,
      });
      this.toast.success('Vendor payment recorded');
      this.saved.emit();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
}
