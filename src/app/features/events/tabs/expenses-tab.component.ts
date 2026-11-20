import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ConfirmService } from '../../../core/confirm.service';
import { ToastService } from '../../../core/toast.service';
import { EventItem, Expense } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { ExpenseFormComponent } from '../../../shared/expense-form.component';

@Component({
  selector: 'app-expenses-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, ExpenseFormComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="stat"><span class="stat-label">Total Expenses</span><span class="stat-value money">{{ summary().total | inr }}</span></div>
      <div class="stat"><span class="stat-label">Paid</span><span class="stat-value money text-emerald-700">{{ summary().paid | inr }}</span></div>
      <div class="stat"><span class="stat-label">Unpaid</span><span class="stat-value money text-red-600">{{ summary().unpaid | inr }}</span></div>
    </div>

    <div class="grid lg:grid-cols-4 gap-6">
      <div class="card card-pad lg:col-span-3">
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <h2 class="card-title flex-1">Event Expenses</h2>
          <select class="input !w-auto !py-2" [ngModel]="cat()" (ngModelChange)="cat.set($event)">
            <option value="">All categories</option>
            @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
          <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Expense</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th class="!text-right">Qty</th><th class="!text-right">Unit Price</th><th class="!text-right">Total</th><th>Status</th><th>Method</th><th></th></tr></thead>
            <tbody>
              @for (x of filtered(); track x.id) {
                <tr>
                  <td class="whitespace-nowrap">{{ x.expense_date | dmy }}</td>
                  <td><span class="chip">{{ x.category }}</span></td>
                  <td class="max-w-[220px]">{{ x.description || '—' }}</td>
                  <td>{{ x.vendor_name || '—' }}</td>
                  <td class="text-right">{{ x.quantity | num }}</td>
                  <td class="text-right money">{{ x.unit_price | inr }}</td>
                  <td class="text-right money font-semibold">{{ x.total_amount | inr }}</td>
                  <td>
                    <span class="badge" [class]="x.payment_status | badge">{{ x.payment_status | label }}</span>
                    @if (x.payment_status === 'PARTIAL') { <p class="text-[11px] text-ink-500 mt-0.5">Paid {{ x.amount_paid | inr }}</p> }
                  </td>
                  <td>{{ x.payment_method | label }}</td>
                  <td class="text-right whitespace-nowrap">
                    <button class="btn-icon" (click)="edit(x)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                    @if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="remove(x)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                  </td>
                </tr>
              } @empty { <tr><td colspan="10" class="text-center text-ink-400 py-8">No expenses recorded yet.</td></tr> }
            </tbody>
            @if (filtered().length) {
              <tfoot><tr><td colspan="6">Total</td><td class="text-right money">{{ filteredTotal() | inr }}</td><td colspan="3"></td></tr></tfoot>
            }
          </table>
        </div>
      </div>

      <div class="card card-pad">
        <h2 class="card-title mb-3">By Category</h2>
        @for (c of byCategory(); track c.name) {
          <div class="mb-3">
            <div class="flex justify-between text-sm"><span>{{ c.name }}</span><span class="money font-medium">{{ c.amount | inr }}</span></div>
            <div class="h-1.5 rounded-full bg-ink-100 mt-1"><div class="h-full rounded-full bg-brand-600" [style.width.%]="c.pct"></div></div>
          </div>
        } @empty { <p class="text-sm text-ink-400">No data</p> }
      </div>
    </div>

    <app-expense-form #form [open]="open()" [eventId]="event().id" [eventName]="event().name" (closed)="open.set(false)" (saved)="onSaved()" />
  `,
})
export class ExpensesTabComponent {
  event = input.required<EventItem>();
  changed = output<void>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  form = viewChild.required<ExpenseFormComponent>('form');

  items = signal<Expense[]>([]);
  cat = signal('');
  open = signal(false);

  summary = computed(() => {
    const total = this.items().reduce((s, x) => s + x.total_amount, 0);
    const paid = this.items().reduce((s, x) => s + x.amount_paid, 0);
    return { total, paid, unpaid: total - paid };
  });
  categories = computed(() => [...new Set(this.items().map((x) => x.category))]);
  filtered = computed(() => (this.cat() ? this.items().filter((x) => x.category === this.cat()) : this.items()));
  filteredTotal = computed(() => this.filtered().reduce((s, x) => s + x.total_amount, 0));
  byCategory = computed(() => {
    const map = new Map<string, number>();
    for (const x of this.items()) map.set(x.category, (map.get(x.category) || 0) + x.total_amount);
    const max = Math.max(1, ...map.values());
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount, pct: (amount / max) * 100 }));
  });

  constructor() {
    effect(() => {
      const id = this.event().id;
      if (id) this.load(id);
    });
  }

  async load(id: number): Promise<void> {
    try {
      const r = await this.api.get<{ items: Expense[] }>(`/events/${id}/expenses`);
      this.items.set(r.items);
    } catch (e) {
      this.toast.fail(e);
    }
  }

  openNew(): void {
    this.form().reset();
    this.open.set(true);
  }

  edit(x: Expense): void {
    this.form().reset(x);
    this.open.set(true);
  }

  onSaved(): void {
    this.open.set(false);
    this.changed.emit();
  }

  async remove(x: Expense): Promise<void> {
    if (!(await this.confirm.delete('this expense', `${x.category}${x.description ? ' – ' + x.description : ''}`))) return;
    try {
      await this.api.delete(`/expenses/${x.id}`);
      this.toast.success('Expense deleted');
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
