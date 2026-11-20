import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EventItem } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let e = event();
    <div class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <section class="card card-pad">
          <h2 class="card-title mb-4">Event Information</h2>
          <dl class="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div><dt class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Event Type</dt><dd class="mt-1">{{ e.type_name || '—' }}</dd></div>
            <div><dt class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Guests</dt><dd class="mt-1">{{ e.guests ?? '—' }}</dd></div>
            <div><dt class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Date</dt><dd class="mt-1">{{ e.event_date | dmy: true }}</dd></div>
            <div><dt class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Time</dt><dd class="mt-1">{{ (e.start_time | time12) || '—' }}@if (e.end_time) { – {{ e.end_time | time12 }} }</dd></div>
            <div><dt class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Venue</dt><dd class="mt-1">{{ e.venue || '—' }}</dd></div>
            <div><dt class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Address</dt><dd class="mt-1 whitespace-pre-line">{{ e.address || '—' }}</dd></div>
          </dl>
          @if (e.description) {
            <div class="mt-6"><p class="text-ink-400 text-xs uppercase tracking-wide font-semibold">Description</p><p class="mt-1 text-sm whitespace-pre-line">{{ e.description }}</p></div>
          }
          @if (e.special_instructions) {
            <div class="mt-4 rounded-xl bg-gold-50 border border-gold-200 p-4">
              <p class="text-gold-700 text-xs uppercase tracking-wide font-semibold flex items-center gap-1.5"><app-icon name="alert" [size]="14" />Special Instructions</p>
              <p class="mt-1 text-sm whitespace-pre-line text-ink-800">{{ e.special_instructions }}</p>
            </div>
          }
        </section>

        <section class="card card-pad">
          <div class="flex justify-between items-center mb-3">
            <h2 class="card-title">Functions &amp; Schedule</h2>
            <button class="text-xs font-semibold text-brand-700 hover:underline" (click)="goTab.emit('schedule')">Manage</button>
          </div>
          @for (f of e.functions || []; track f.id) {
            <div class="flex items-center gap-3 py-2 border-b border-ink-100 last:border-0">
              <span class="chip">{{ f.function_date | dmy }}</span>
              <span class="font-medium text-sm flex-1">{{ f.name }}</span>
              <span class="text-xs text-ink-500">{{ f.start_time | time12 }}</span>
            </div>
          } @empty { <p class="text-sm text-ink-400">No functions added yet. Add Haldi, Mehndi, Sangeet etc. as separate functions on their own dates.</p> }
        </section>
      </div>

      <div class="space-y-6">
        <section class="card card-pad">
          <h2 class="card-title mb-3">Client</h2>
          <p class="font-semibold">{{ e.client?.name }}</p>
          <p class="text-sm text-ink-600 mt-1 flex items-center gap-1.5"><app-icon name="phone" [size]="14" /><a [href]="'tel:' + e.client?.mobile" class="hover:underline">{{ e.client?.mobile }}</a></p>
          @if (e.client?.email) { <p class="text-sm text-ink-600 mt-1">{{ e.client?.email }}</p> }
          @if (e.client?.address) { <p class="text-sm text-ink-500 mt-1">{{ e.client?.address }}</p> }
        </section>

        <section class="card card-pad">
          <div class="flex justify-between items-center mb-3">
            <h2 class="card-title">Setup Progress</h2>
            <button class="text-xs font-semibold text-brand-700 hover:underline" (click)="goTab.emit('checklist')">Open checklist</button>
          </div>
          <div class="h-2.5 rounded-full bg-ink-100 overflow-hidden"><div class="h-full bg-emerald-500 rounded-full transition-all" [style.width.%]="progress()"></div></div>
          <p class="text-xs text-ink-500 mt-2">{{ cs().completed }} of {{ cs().included }} included items completed</p>
          <div class="grid grid-cols-3 gap-2 mt-4 text-center">
            <div class="rounded-xl bg-emerald-50 p-2"><p class="text-lg font-bold text-emerald-700">{{ cs().included }}</p><p class="text-[11px] text-emerald-700">Included</p></div>
            <div class="rounded-xl bg-ink-100 p-2"><p class="text-lg font-bold text-ink-700">{{ cs().excluded }}</p><p class="text-[11px] text-ink-600">Not incl.</p></div>
            <div class="rounded-xl bg-gold-50 p-2"><p class="text-lg font-bold text-gold-700">{{ cs().unconfirmed }}</p><p class="text-[11px] text-gold-700">To confirm</p></div>
          </div>
        </section>

        <section class="card card-pad">
          <h2 class="card-title mb-3">Records</h2>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <button class="rounded-xl border border-ink-100 p-3 text-left hover:bg-ink-50" (click)="goTab.emit('materials')"><p class="font-bold text-lg">{{ e.counts?.materials }}</p><p class="text-ink-500 text-xs">Materials</p></button>
            <button class="rounded-xl border border-ink-100 p-3 text-left hover:bg-ink-50" (click)="goTab.emit('expenses')"><p class="font-bold text-lg">{{ e.counts?.expenses }}</p><p class="text-ink-500 text-xs">Expenses</p></button>
            <button class="rounded-xl border border-ink-100 p-3 text-left hover:bg-ink-50" (click)="goTab.emit('payments')"><p class="font-bold text-lg">{{ e.counts?.payments }}</p><p class="text-ink-500 text-xs">Payments</p></button>
            <button class="rounded-xl border border-ink-100 p-3 text-left hover:bg-ink-50" (click)="goTab.emit('documents')"><p class="font-bold text-lg">{{ e.counts?.documents }}</p><p class="text-ink-500 text-xs">Documents</p></button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class OverviewTabComponent {
  event = input.required<EventItem>();
  goTab = output<string>();
  cs = computed(() => this.event().checklist_summary || { total: 0, included: 0, excluded: 0, unconfirmed: 0, completed: 0 });
  progress = computed(() => (this.cs().included ? Math.round((this.cs().completed / this.cs().included) * 100) : 0));
}
