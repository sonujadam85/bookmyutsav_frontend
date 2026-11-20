import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { LookupService } from '../core/lookup.service';
import { ToastService } from '../core/toast.service';
import { Expense, ExpenseStatus } from '../core/models';
import { FORMAT_PIPES, inr, today } from '../core/format';
import { ModalComponent } from './modal.component';

interface ExpenseDraft {
  id?: number; expense_date: string; category: string; description: string; vendor_id: number | null;
  quantity: number | null; unit_price: number | null; payment_status: ExpenseStatus; amount_paid: number | null; payment_method: string;
}

/** Add / edit expense modal, reused by the event Expenses tab and the global Expenses page. */
@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [FormsModule, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="d().id ? 'Edit Expense' : 'Add Expense'" [subtitle]="eventName()" size="lg" (closed)="closed.emit()">
      <form #xf="ngForm" id="expForm" (ngSubmit)="save(xf.valid)" class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="label">Expense Date *</label>
          <input type="date" class="input" name="expense_date" [(ngModel)]="d().expense_date" required />
        </div>
        <div>
          <label class="label">Category *</label>
          <select class="input" name="category" [(ngModel)]="d().category" required #cat="ngModel">
            <option value="" disabled>Select category</option>
            @for (c of lookups.data().expense_categories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
          @if (cat.invalid && cat.touched) { <p class="err">Category is required</p> }
        </div>
        <div class="sm:col-span-2"><label class="label">Description</label><input class="input" name="description" [(ngModel)]="d().description" /></div>
        <div>
          <label class="label">Vendor</label>
          <select class="input" name="vendor_id" [(ngModel)]="d().vendor_id">
            <option [ngValue]="null">— No vendor —</option>
            @for (v of lookups.data().vendors; track v.id) { <option [ngValue]="v.id">{{ v.name }}{{ v.service_category ? ' · ' + v.service_category : '' }}</option> }
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Quantity</label><input type="number" min="0" step="any" class="input" name="quantity" [(ngModel)]="d().quantity" (ngModelChange)="tick()" /></div>
          <div><label class="label">Unit Price</label><input type="number" min="0" step="0.01" class="input" name="unit_price" [(ngModel)]="d().unit_price" (ngModelChange)="tick()" /></div>
        </div>
        <div>
          <label class="label">Payment Status</label>
          <select class="input" name="payment_status" [(ngModel)]="d().payment_status" (ngModelChange)="tick()">
            <option value="UNPAID">Unpaid</option><option value="PARTIAL">Partially paid</option><option value="PAID">Paid</option>
          </select>
        </div>
        <div>
          <label class="label">Payment Method</label>
          <select class="input" name="payment_method" [(ngModel)]="d().payment_method">
            <option value="">—</option><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option>
          </select>
        </div>
        @if (d().payment_status === 'PARTIAL') {
          <div>
            <label class="label">Amount Already Paid *</label>
            <input type="number" min="0" step="0.01" class="input" name="amount_paid" [(ngModel)]="d().amount_paid" required (ngModelChange)="tick()" />
            @if (partialError()) { <p class="err">{{ partialError() }}</p> }
          </div>
        }
        <div class="rounded-xl bg-brand-50 p-4 flex items-center justify-between" [class]="d().payment_status !== 'PARTIAL' ? 'sm:col-span-2' : ''">
          <span class="text-sm text-brand-800">Total Amount</span><span class="font-bold text-lg money text-brand-900">{{ total() }}</span>
        </div>
        @if (d().vendor_id) { <p class="hint sm:col-span-2">Later payments to the vendor against this bill can be recorded in the Vendors section.</p> }
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="expForm" [disabled]="saving()">Save Expense</button>
      </div>
    </app-modal>
  `,
})
export class ExpenseFormComponent {
  open = input(false);
  eventId = input<number | null>(null);
  eventName = input('');
  closed = output<void>();
  saved = output<Expense>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  lookups = inject(LookupService);
  saving = signal(false);
  d = signal<ExpenseDraft>(this.blank());
  private version = signal(0);

  total = computed(() => {
    this.version();
    const d = this.d();
    return inr(Number(d.quantity || 0) * Number(d.unit_price || 0));
  });
  partialError = computed(() => {
    this.version();
    const d = this.d();
    const t = Number(d.quantity || 0) * Number(d.unit_price || 0);
    if (d.payment_status !== 'PARTIAL') return '';
    if (!(Number(d.amount_paid) > 0)) return 'Enter the amount already paid';
    if (Number(d.amount_paid) >= t) return 'Must be less than the total (choose Paid instead)';
    return '';
  });

  blank(): ExpenseDraft {
    return { expense_date: today(), category: '', description: '', vendor_id: null, quantity: 1, unit_price: null, payment_status: 'UNPAID', amount_paid: null, payment_method: '' };
  }

  /** Call before opening. */
  reset(x?: Expense): void {
    this.d.set(
      x
        ? { id: x.id, expense_date: x.expense_date, category: x.category, description: x.description || '', vendor_id: x.vendor_id, quantity: x.quantity, unit_price: x.unit_price,
            payment_status: x.payment_status, amount_paid: x.amount_paid, payment_method: x.payment_method || '' }
        : this.blank()
    );
    this.tick();
  }

  tick(): void {
    this.version.update((v) => v + 1);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid || this.partialError()) return;
    const d = this.d();
    this.saving.set(true);
    const body = { ...d, quantity: d.quantity ?? 0, unit_price: d.unit_price ?? 0, payment_method: d.payment_method || null };
    try {
      const res = d.id ? await this.api.put<Expense>(`/expenses/${d.id}`, body) : await this.api.post<Expense>(`/events/${this.eventId()}/expenses`, body);
      this.toast.success('Expense saved');
      this.saved.emit(res);
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
}
