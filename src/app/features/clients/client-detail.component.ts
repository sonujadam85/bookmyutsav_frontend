import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Client } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/clients" class="text-sm text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"><app-icon name="chevronLeft" [size]="16" />Clients</a>
    @if (client(); as c) {
      <div class="flex flex-wrap items-end justify-between gap-4 mt-1 mb-6">
        <div>
          <h1 class="page-title">{{ c.name }}</h1>
          <p class="page-sub"><a [href]="'tel:' + c.mobile">{{ c.mobile }}</a>@if (c.email) { · {{ c.email }} }@if (c.address) { · {{ c.address }} }</p>
        </div>
        <a [routerLink]="['/events/new']" [queryParams]="{ clientId: c.id }" class="btn btn-primary"><app-icon name="plus" [size]="16" />New Event for Client</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="stat"><span class="stat-label">Events</span><span class="stat-value">{{ c.events?.length }}</span></div>
        <div class="stat"><span class="stat-label">Total Booking</span><span class="stat-value money">{{ totals().booking | inr }}</span></div>
        <div class="stat"><span class="stat-label">Received</span><span class="stat-value money text-emerald-700">{{ totals().received | inr }}</span></div>
        <div class="stat"><span class="stat-label">Pending</span><span class="stat-value money text-red-600">{{ totals().pending | inr }}</span></div>
      </div>
      <div class="card card-pad">
        <h2 class="card-title mb-4">Events</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Event</th><th>Venue</th><th>Status</th><th class="!text-right">Booking</th><th class="!text-right">Received</th><th class="!text-right">Balance</th></tr></thead>
            <tbody>
              @for (e of c.events; track e.id) {
                <tr class="cursor-pointer" [routerLink]="['/events', e.id]">
                  <td class="whitespace-nowrap">{{ e.event_date | dmy }}</td>
                  <td class="font-semibold">{{ e.name }}</td>
                  <td>{{ e.venue || '—' }}</td>
                  <td><span class="badge" [class]="e.status | badge">{{ e.status | label }}</span></td>
                  <td class="text-right money">{{ e.booking_amount | inr }}</td>
                  <td class="text-right money text-emerald-700">{{ e.total_received | inr }}</td>
                  <td class="text-right money font-semibold">{{ e.remaining_balance | inr }}</td>
                </tr>
              } @empty { <tr><td colspan="7" class="text-center text-ink-400 py-6">No events</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
      @if (c.notes) { <div class="card card-pad mt-6"><h2 class="card-title mb-2">Notes</h2><p class="text-sm whitespace-pre-line">{{ c.notes }}</p></div> }
    }
  `,
})
export class ClientDetailComponent {
  id = input.required<string>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  client = signal<Client | null>(null);
  totals = computed(() => {
    const ev = (this.client()?.events || []).filter((e) => e.status !== 'CANCELLED');
    return {
      booking: ev.reduce((s, e) => s + e.booking_amount, 0),
      received: ev.reduce((s, e) => s + e.total_received, 0),
      pending: ev.reduce((s, e) => s + Math.max(e.remaining_balance, 0), 0),
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.api.get<Client>(`/clients/${id}`).then((c) => this.client.set(c)).catch((e) => this.toast.fail(e));
    });
  }
}
