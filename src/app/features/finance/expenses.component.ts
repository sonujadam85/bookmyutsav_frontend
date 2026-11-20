import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { EventItem, Expense } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ExpenseFormComponent } from '../../shared/expense-form.component';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ExpenseFormComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Expenses</h1><p class="page-sub">All event expenses · {{ totals().total | inr }} total · {{ totals().unpaid | inr }} unpaid</p></div>
      <div class="flex gap-2">
        <select class="input !w-auto" [(ngModel)]="newEventId" aria-label="Event for new expense">
          <option [ngValue]="null">Select event to add expense</option>
          @for (e of events(); track e.id) { <option [ngValue]="e.id">{{ e.event_date | dmy }} · {{ e.name }}</option> }
        </select>
        <button class="btn btn-primary" [disabled]="!newEventId" (click)="openNew()"><app-icon name="plus" [size]="16" />Add</button>
      </div>
    </div>

    <div class="card card-pad mb-6">
      <div class="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div class="lg:col-span-2"><label class="label">Search</label><input class="input" placeholder="Description, vendor, event" [ngModel]="q()" (ngModelChange)="q.set($event)" /></div>
        <div>
          <label class="label">Category</label>
          <select class="input" [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="">All</option>
            @for (c of lookups.data().expense_categories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div>
          <label class="label">Status</label>
          <select class="input" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All</option><option value="PAID">Paid</option><option value="PARTIAL">Partially paid</option><option value="UNPAID">Unpaid</option>
          </select>
        </div>
        <div><label class="label">From</label><input type="date" class="input" [ngModel]="from()" (ngModelChange)="from.set($event)" /></div>
        <div><label class="label">To</label><input type="date" class="input" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
      </div>
    </div>

    <div class="card p-2">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Date</th><th>Event</th><th>Category</th><th>Description</th><th>Vendor</th><th class="!text-right">Qty</th><th class="!text-right">Unit Price</th><th class="!text-right">Total</th><th>Status</th><th>Method</th><th></th></tr></thead>
          <tbody>
            @for (x of rows(); track x.id) {
              <tr>
                <td class="whitespace-nowrap">{{ x.expense_date | dmy }}</td>
                <td><a [routerLink]="['/events', x.event_id]" [queryParams]="{ tab: 'expenses' }" class="hover:text-brand-700">{{ x.event_name }}</a></td>
                <td><span class="chip">{{ x.category }}</span></td>
                <td>{{ x.description || '—' }}</td>
                <td>{{ x.vendor_name || '—' }}</td>
                <td class="text-right">{{ x.quantity | num }}</td>
                <td class="text-right money">{{ x.unit_price | inr }}</td>
                <td class="text-right money font-semibold">{{ x.total_amount | inr }}</td>
                <td><span class="badge" [class]="x.payment_status | badge">{{ x.payment_status | label }}</span></td>
                <td>{{ x.payment_method | label }}</td>
                <td class="text-right whitespace-nowrap">
                  <button class="btn-icon" (click)="edit(x)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                  @if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="remove(x)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="11" class="text-center text-ink-400 py-8">No expenses found</td></tr> }
          </tbody>
          @if (rows().length) { <tfoot><tr><td colspan="7">Total</td><td class="text-right money">{{ totals().total | inr }}</td><td colspan="3"></td></tr></tfoot> }
        </table>
      </div>
    </div>

    <app-expense-form #form [open]="open()" [eventId]="formEventId()" [eventName]="formEventName()" (closed)="open.set(false)" (saved)="onSaved()" />
  `,
})
export class ExpensesComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  lookups = inject(LookupService);
  auth = inject(AuthService);
  form = viewChild.required<ExpenseFormComponent>('form');

  rows = signal<Expense[]>([]);
  events = signal<EventItem[]>([]);
  q = signal('');
  category = signal('');
  status = signal('');
  from = signal('');
  to = signal('');
  open = signal(false);
  formEventId = signal<number | null>(null);
  formEventName = signal('');
  newEventId: number | null = null;
  private refresh = signal(0);

  totals = computed(() => {
    const total = this.rows().reduce((s, x) => s + x.total_amount, 0);
    const paid = this.rows().reduce((s, x) => s + x.amount_paid, 0);
    return { total, unpaid: total - paid };
  });

  constructor() {
    this.lookups.load();
    this.api.get<EventItem[]>('/events', { sort: 'date_desc' }).then((e) => this.events.set(e.filter((x) => x.status !== 'CANCELLED'))).catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      this.refresh();
      const params = { q: this.q(), category: this.category(), status: this.status(), from: this.from(), to: this.to() };
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.api.get<Expense[]>('/expenses', params).then((r) => this.rows.set(r)).catch((e) => this.toast.fail(e));
      }, 250);
    });
  }

  openNew(): void {
    const ev = this.events().find((e) => e.id === this.newEventId);
    if (!ev) return;
    this.formEventId.set(ev.id);
    this.formEventName.set(ev.name);
    this.form().reset();
    this.open.set(true);
  }

  edit(x: Expense): void {
    this.formEventId.set(x.event_id);
    this.formEventName.set(x.event_name || '');
    this.form().reset(x);
    this.open.set(true);
  }

  onSaved(): void {
    this.open.set(false);
    this.refresh.update((v) => v + 1);
  }

  async remove(x: Expense): Promise<void> {
    if (!(await this.confirm.delete('this expense'))) return;
    try {
      await this.api.delete(`/expenses/${x.id}`);
      this.toast.success('Expense deleted');
      this.refresh.update((v) => v + 1);
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
