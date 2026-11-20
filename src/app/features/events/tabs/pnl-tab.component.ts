import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ApiService } from '../../../core/api.service';
import { ToastService } from '../../../core/toast.service';
import { Pnl } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';

@Component({
  selector: 'app-pnl-tab',
  standalone: true,
  imports: [...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as p) {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div class="stat"><span class="stat-label">Total Revenue</span><span class="stat-value money">{{ p.total_revenue | inr }}</span><span class="text-xs text-ink-400">Client booking amount</span></div>
        <div class="stat"><span class="stat-label">Total Expenses</span><span class="stat-value money">{{ p.total_expenses | inr }}</span><span class="text-xs text-ink-400">All event expenses</span></div>
        <div class="stat !border-0 text-white" [class]="p.net_profit >= 0 ? 'bg-gradient-to-br from-emerald-700 to-emerald-500' : 'bg-gradient-to-br from-red-700 to-red-500'">
          <span class="stat-label !text-white/80">Net {{ p.net_profit >= 0 ? 'Profit' : 'Loss' }}</span><span class="stat-value money !text-white">{{ p.net_profit | inr }}</span>
          <span class="text-xs text-white/80">Revenue − Expenses</span>
        </div>
        <div class="stat"><span class="stat-label">Profit %</span><span class="stat-value" [class]="p.profit_percentage >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ p.profit_percentage | num }}%</span><span class="text-xs text-ink-400">Net profit ÷ revenue</span></div>
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <div class="card card-pad">
          <h2 class="card-title mb-4">Statement</h2>
          <dl class="text-sm space-y-3">
            <div class="flex justify-between"><dt>Total Revenue (booking)</dt><dd class="money font-semibold">{{ p.total_revenue | inr }}</dd></div>
            @for (c of p.expenses_by_category; track c.category) {
              <div class="flex justify-between text-ink-600 pl-4"><dt>− {{ c.category }} <span class="text-ink-400">({{ c.count }})</span></dt><dd class="money">{{ c.amount | inr }}</dd></div>
            }
            <div class="flex justify-between border-t border-ink-200 pt-3"><dt>Total Expenses</dt><dd class="money font-semibold">{{ p.total_expenses | inr }}</dd></div>
            <div class="flex justify-between text-base font-bold" [class]="p.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'"><dt>Net Profit</dt><dd class="money">{{ p.net_profit | inr }}</dd></div>
          </dl>
          <div class="mt-6 h-3 rounded-full bg-ink-100 overflow-hidden flex">
            <div class="h-full bg-red-400" [style.width.%]="expensePct()"></div>
            <div class="h-full bg-emerald-500" [style.width.%]="100 - expensePct()"></div>
          </div>
          <div class="flex justify-between text-xs text-ink-500 mt-1"><span>Expenses {{ expensePct() }}%</span><span>Profit {{ 100 - expensePct() }}%</span></div>
        </div>

        <div class="card card-pad">
          <h2 class="card-title mb-4">Outstanding &amp; Cash</h2>
          <dl class="text-sm space-y-3">
            <div class="flex justify-between"><dt>Received from client</dt><dd class="money text-emerald-700 font-semibold">{{ p.total_received | inr }}</dd></div>
            <div class="flex justify-between"><dt>Client Pending Payment</dt><dd class="money text-red-600 font-semibold">{{ p.client_pending | inr }}</dd></div>
            <div class="border-t border-dashed border-ink-200"></div>
            <div class="flex justify-between"><dt>Vendor billed</dt><dd class="money">{{ p.vendor_billed | inr }}</dd></div>
            <div class="flex justify-between"><dt>Vendor paid</dt><dd class="money">{{ p.vendor_paid | inr }}</dd></div>
            <div class="flex justify-between"><dt>Vendor Pending Payment</dt><dd class="money text-gold-600 font-semibold">{{ p.vendor_pending | inr }}</dd></div>
            <div class="flex justify-between"><dt>All unpaid expenses</dt><dd class="money">{{ p.unpaid_expenses | inr }}</dd></div>
            <div class="border-t border-dashed border-ink-200"></div>
            <div class="flex justify-between"><dt>Cash in hand for this event <span class="text-ink-400">(received − paid out)</span></dt><dd class="money font-semibold">{{ p.cash_position | inr }}</dd></div>
            <div class="flex justify-between text-ink-500"><dt>Planned material cost (reference)</dt><dd class="money">{{ p.planned_material_cost | inr }}</dd></div>
          </dl>
        </div>
      </div>
    } @else { <div class="card card-pad text-ink-400">Calculating...</div> }
  `,
})
export class PnlTabComponent {
  eventId = input.required<number>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  data = signal<Pnl | null>(null);
  expensePct = computed(() => {
    const p = this.data();
    if (!p || p.total_revenue <= 0) return 0;
    return Math.min(100, Math.round((p.total_expenses / p.total_revenue) * 100));
  });

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (id) this.api.get<Pnl>(`/events/${id}/pnl`).then((p) => this.data.set(p)).catch((e) => this.toast.fail(e));
    });
  }
}
