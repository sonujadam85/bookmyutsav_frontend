import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { Client, EventItem, EventStatus } from '../../core/models';
import { FORMAT_PIPES, fmtDate, fmtTime, inr, today } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

const MOBILE = /^\+?[\d\s-]{10,18}$/;

function timeOrder(g: AbstractControl): ValidationErrors | null {
  const s = g.get('start_time')?.value;
  const e = g.get('end_time')?.value;
  return s && e && e <= s ? { timeOrder: true } : null;
}

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <a [routerLink]="isEdit() ? ['/events', id()] : ['/events']" class="text-sm text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"><app-icon name="chevronLeft" [size]="16" />Back</a>
        <h1 class="page-title mt-1">{{ isEdit() ? 'Edit Event' : 'New Event' }}</h1>
        @if (isEdit()) { <p class="page-sub">Changes here only update event details. Checklist, materials, expenses and payments stay untouched.</p> }
      </div>
    </div>

    @if (loadingEvent()) { <div class="card card-pad text-ink-400">Loading...</div> }
    @else {
    <form [formGroup]="form" (ngSubmit)="save()" novalidate class="grid xl:grid-cols-3 gap-6">
      <div class="xl:col-span-2 space-y-6">
        <!-- Event details -->
        <section class="card card-pad">
          <h2 class="card-title mb-4">Event Details</h2>
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="label">Event Name *</label>
              <input class="input" formControlName="name" placeholder="e.g. Sharma – Verma Wedding" [class.input-error]="err('name')" />
              @if (err('name')) { <p class="err">{{ err('name') }}</p> }
            </div>
            <div>
              <label class="label">Event Type</label>
              <select class="input" formControlName="event_type_id">
                <option [ngValue]="null">Select type</option>
                @for (t of lookups.data().event_types; track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
              </select>
            </div>
            <div>
              <label class="label">Status</label>
              <select class="input" formControlName="status">
                @for (s of statuses; track s) { <option [value]="s">{{ s | label }}</option> }
              </select>
            </div>
            <div>
              <label class="label">Event Date *</label>
              <input type="date" class="input" formControlName="event_date" [class.input-error]="err('event_date')" />
              @if (err('event_date')) { <p class="err">{{ err('event_date') }}</p> }
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Start Time</label>
                <input type="time" class="input" formControlName="start_time" />
              </div>
              <div>
                <label class="label">End Time</label>
                <input type="time" class="input" formControlName="end_time" [class.input-error]="form.hasError('timeOrder') || err('end_time')" />
              </div>
              @if (form.hasError('timeOrder') || err('end_time')) { <p class="err col-span-2">End time must be after start time</p> }
            </div>
            <div>
              <label class="label">Venue / Location</label>
              <input class="input" formControlName="venue" placeholder="Hall, farmhouse, home..." />
            </div>
            <div>
              <label class="label">Number of Guests</label>
              <input type="number" min="0" class="input" formControlName="guests" />
              @if (err('guests')) { <p class="err">{{ err('guests') }}</p> }
            </div>
            <div class="sm:col-span-2">
              <label class="label">Event Address</label>
              <textarea rows="2" class="input" formControlName="address"></textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="label">Event Description</label>
              <textarea rows="3" class="input" formControlName="description"></textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="label">Special Instructions</label>
              <textarea rows="3" class="input" formControlName="special_instructions" placeholder="Client requests, timing constraints, access notes..."></textarea>
            </div>
            <label class="sm:col-span-2 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" class="rounded text-brand-700" formControlName="is_tentative" /> Tentative booking (date not yet confirmed)
            </label>
          </div>
        </section>

        <!-- Client -->
        <section class="card card-pad" formGroupName="client">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 class="card-title">Client / Party</h2>
            <select class="input !w-auto min-w-[240px]" [formControl]="clientPicker">
              <option [ngValue]="null">+ New client</option>
              @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }} · {{ c.mobile }}</option> }
            </select>
          </div>
          @if (clientPicker.value) {
            <p class="hint -mt-2 mb-3">Editing these fields updates this client's record for all of their events. One client can have many events.</p>
          }
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="label">Client / Party Name *</label>
              <input class="input" formControlName="name" [class.input-error]="clientErr('name')" />
              @if (clientErr('name')) { <p class="err">{{ clientErr('name') }}</p> }
            </div>
            <div>
              <label class="label">Mobile Number *</label>
              <input class="input" formControlName="mobile" inputmode="tel" placeholder="10-digit mobile" [class.input-error]="clientErr('mobile')" />
              @if (clientErr('mobile')) { <p class="err">{{ clientErr('mobile') }}</p> }
            </div>
            <div>
              <label class="label">Email</label>
              <input class="input" type="email" formControlName="email" [class.input-error]="clientErr('email')" />
              @if (clientErr('email')) { <p class="err">{{ clientErr('email') }}</p> }
            </div>
            <div>
              <label class="label">Client Address</label>
              <input class="input" formControlName="address" />
            </div>
          </div>
        </section>
      </div>

      <!-- Money -->
      <aside class="space-y-6">
        <section class="card card-pad xl:sticky xl:top-24">
          <h2 class="card-title mb-4">Booking &amp; Payment</h2>
          <label class="label">Total Booking Amount (₹)</label>
          <input type="number" min="0" step="0.01" class="input text-lg font-semibold" formControlName="booking_amount" [class.input-error]="err('booking_amount')" />
          @if (err('booking_amount')) { <p class="err">{{ err('booking_amount') }}</p> }

          @if (!isEdit()) {
            <div class="mt-5 pt-5 border-t border-ink-100" formGroupName="advance">
              <p class="text-sm font-semibold mb-3">Advance Payment</p>
              <label class="label">Amount (₹)</label>
              <input type="number" min="0" step="0.01" class="input" formControlName="amount" />
              <div class="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label class="label">Date</label>
                  <input type="date" class="input" formControlName="payment_date" />
                </div>
                <div>
                  <label class="label">Mode</label>
                  <select class="input" formControlName="mode">
                    @for (m of lookups.data().payment_modes; track m) { <option [value]="m">{{ m | label }}</option> }
                  </select>
                </div>
              </div>
              <label class="label mt-3">Transaction ID</label>
              <input class="input" formControlName="transaction_id" placeholder="UPI / bank reference" />
            </div>
          } @else {
            <div class="mt-5 pt-5 border-t border-ink-100 text-sm space-y-2">
              <div class="flex justify-between"><span class="text-ink-500">Advance received</span><span class="money font-medium">{{ existing()?.advance_received | inr }}</span></div>
              <div class="flex justify-between"><span class="text-ink-500">Total received</span><span class="money font-medium text-emerald-700">{{ existing()?.total_received | inr }}</span></div>
              <a [routerLink]="['/events', id()]" [queryParams]="{ tab: 'payments' }" class="text-xs font-semibold text-brand-700 hover:underline">Manage payments &amp; installments →</a>
            </div>
          }

          <div class="mt-5 rounded-xl bg-brand-50 p-4">
            <div class="flex justify-between text-sm"><span class="text-brand-800">Remaining Payment</span><span class="money font-bold text-brand-900 text-lg">{{ remaining() }}</span></div>
            <p class="text-xs text-brand-700/70 mt-1">Booking amount − payments received</p>
          </div>
          @if (overpaid()) { <p class="err mt-2">Advance is more than the booking amount.</p> }

          <button type="submit" class="btn btn-primary w-full mt-6 !py-3" [disabled]="saving()">
            {{ saving() ? 'Saving...' : isEdit() ? 'Save Changes' : 'Create Event' }}
          </button>
          @if (!isEdit()) { <p class="hint text-center mt-2">The default 29-item setup checklist is added automatically.</p> }
        </section>
      </aside>
    </form>
    }
  `,
})
export class EventFormComponent implements OnInit {
  /** Route params / query params via component input binding */
  id = input<string>();
  date = input<string>();
  clientId = input<string>();

  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  lookups = inject(LookupService);

  statuses: EventStatus[] = ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  clients = signal<Client[]>([]);
  existing = signal<EventItem | null>(null);
  saving = signal(false);
  loadingEvent = signal(false);
  serverErrors = signal<Record<string, string>>({});
  submitted = signal(false);
  isEdit = computed(() => !!this.id());

  clientPicker = this.fb.control<number | null>(null);

  form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(200)]],
      event_type_id: this.fb.control<number | null>(null),
      status: this.fb.control<EventStatus>('UPCOMING'),
      event_date: [today(), Validators.required],
      start_time: [''],
      end_time: [''],
      venue: [''],
      address: [''],
      guests: this.fb.control<number | null>(null, Validators.min(0)),
      booking_amount: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
      description: [''],
      special_instructions: [''],
      is_tentative: [false],
      client: this.fb.group({
        name: ['', Validators.required],
        mobile: ['', [Validators.required, Validators.pattern(MOBILE)]],
        email: ['', Validators.email],
        address: [''],
      }),
      advance: this.fb.group({
        amount: this.fb.control<number | null>(null, Validators.min(0)),
        payment_date: [today()],
        mode: ['CASH'],
        transaction_id: [''],
      }),
    },
    { validators: timeOrder }
  );

  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  remaining = computed(() => {
    const v = this.formValue();
    const booking = Number(v.booking_amount || 0);
    const received = this.isEdit() ? this.existing()?.total_received || 0 : Number(v.advance?.amount || 0);
    return inr(booking - received);
  });
  overpaid = computed(() => !this.isEdit() && Number(this.formValue().advance?.amount || 0) > Number(this.formValue().booking_amount || 0));

  constructor() {
    this.clientPicker.valueChanges.subscribe((cid) => {
      const c = this.clients().find((x) => x.id === cid);
      this.form.controls.client.reset({ name: c?.name || '', mobile: c?.mobile || '', email: c?.email || '', address: c?.address || '' });
    });
  }

  async ngOnInit(): Promise<void> {
    this.lookups.load();
    try {
      this.clients.set(await this.api.get<Client[]>('/clients'));
    } catch (e) {
      this.toast.fail(e);
    }
    if (this.date()) this.form.patchValue({ event_date: this.date()! });
    if (!this.id() && this.clientId()) this.clientPicker.setValue(Number(this.clientId()));
    if (this.id()) await this.loadEvent();
  }

  private async loadEvent(): Promise<void> {
    this.loadingEvent.set(true);
    try {
      const ev = await this.api.get<EventItem>(`/events/${this.id()}`);
      this.existing.set(ev);
      this.clientPicker.setValue(ev.client_id, { emitEvent: false });
      if (!this.clients().some((c) => c.id === ev.client_id) && ev.client) this.clients.update((l) => [...l, ev.client!]);
      this.form.patchValue({
        name: ev.name, event_type_id: ev.event_type_id, status: ev.status, event_date: ev.event_date,
        start_time: ev.start_time || '', end_time: ev.end_time || '', venue: ev.venue || '', address: ev.address || '',
        guests: ev.guests, booking_amount: ev.booking_amount, description: ev.description || '', special_instructions: ev.special_instructions || '',
        is_tentative: !!ev.is_tentative,
        client: { name: ev.client?.name || '', mobile: ev.client?.mobile || '', email: ev.client?.email || '', address: ev.client?.address || '' },
      });
    } catch (e) {
      this.toast.fail(e);
      this.router.navigate(['/events']);
    } finally {
      this.loadingEvent.set(false);
    }
  }

  err(name: string): string {
    const c = this.form.get(name);
    const server = this.serverErrors()[name];
    if (server) return server;
    if (!c || !c.invalid || !(c.touched || this.submitted())) return '';
    if (c.hasError('required')) return 'This field is required';
    if (c.hasError('min')) return 'Cannot be negative';
    if (c.hasError('maxlength')) return 'Too long';
    return 'Invalid value';
  }

  clientErr(name: string): string {
    const c = this.form.get(['client', name]);
    const server = this.serverErrors()[name] && name !== 'name' ? this.serverErrors()[name] : '';
    if (server) return server;
    if (!c || !c.invalid || !(c.touched || this.submitted())) return '';
    if (c.hasError('required')) return 'This field is required';
    if (c.hasError('pattern')) return 'Enter a valid mobile number (10+ digits)';
    if (c.hasError('email')) return 'Enter a valid email';
    return 'Invalid value';
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.serverErrors.set({});
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.error('Please fill the required fields correctly');
      return;
    }
    const v = this.form.getRawValue();

    // Warn about other bookings on the same date (allowed after confirmation).
    const dateChanged = !this.isEdit() || v.event_date !== this.existing()?.event_date;
    if (dateChanged) {
      try {
        const clashes = await this.api.get<{ name: string; client_name: string; start_time: string | null; venue: string | null }[]>('/events/check-date', {
          date: v.event_date, excludeId: this.id() || '',
        });
        if (clashes.length) {
          const ok = await this.confirm.ask({
            title: `${clashes.length} booking${clashes.length > 1 ? 's' : ''} already on ${fmtDate(v.event_date)}`,
            message: 'Multiple events on the same date are allowed. Do you want to continue?',
            details: clashes.map((c) => `${c.name} — ${c.client_name}${c.start_time ? ' · ' + fmtTime(c.start_time) : ''}${c.venue ? ' · ' + c.venue : ''}`),
            confirmText: 'Yes, save anyway',
          });
          if (!ok) return;
        }
      } catch {
        /* non-blocking check */
      }
    }

    const body: Record<string, unknown> = {
      name: v.name, event_type_id: v.event_type_id, status: v.status, event_date: v.event_date,
      start_time: v.start_time || null, end_time: v.end_time || null, venue: v.venue, address: v.address,
      guests: v.guests, booking_amount: v.booking_amount ?? 0, description: v.description, special_instructions: v.special_instructions,
      is_tentative: v.is_tentative,
      client_id: this.clientPicker.value,
      client: { name: v.client.name, mobile: v.client.mobile, email: v.client.email || null, address: v.client.address },
    };
    if (!this.isEdit() && Number(v.advance.amount) > 0) body['advance_payment'] = v.advance;

    this.saving.set(true);
    try {
      const saved = this.isEdit()
        ? await this.api.put<EventItem>(`/events/${this.id()}`, body)
        : await this.api.post<EventItem>('/events', body);
      this.toast.success(this.isEdit() ? 'Event updated' : 'Event created');
      this.router.navigate(['/events', saved.id]);
    } catch (e) {
      this.serverErrors.set(ApiService.fieldErrors(e));
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
}
