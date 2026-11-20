import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { EventType, Settings } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="page-title mb-6">Settings</h1>
    <div class="grid xl:grid-cols-2 gap-6">
      <form class="card card-pad" #pf="ngForm" (ngSubmit)="changePassword(pf.valid)">
        <h2 class="card-title mb-4">Change My Password</h2>
        <div class="space-y-4">
          <div><label class="label">Current Password</label><input type="password" class="input" name="cur" [(ngModel)]="pw.current" required autocomplete="current-password" /></div>
          <div><label class="label">New Password</label><input type="password" class="input" name="new" [(ngModel)]="pw.next" required minlength="8" autocomplete="new-password" #np="ngModel" />
            @if (np.invalid && np.touched) { <p class="err">Minimum 8 characters</p> }</div>
          <div><label class="label">Confirm New Password</label><input type="password" class="input" name="confirm" [(ngModel)]="pw.confirm" required autocomplete="new-password" />
            @if (pw.confirm && pw.confirm !== pw.next) { <p class="err">Passwords do not match</p> }</div>
        </div>
        <button class="btn btn-primary mt-5" [disabled]="busy()">Update Password</button>
      </form>

      @if (auth.isAdmin()) {
        <form class="card card-pad" (ngSubmit)="saveBusiness()">
          <h2 class="card-title mb-1">Business Details</h2>
          <p class="text-sm text-ink-500 mb-4">Shown on payment receipts and PDF reports.</p>
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2"><label class="label">Business Name</label><input class="input" name="bn" [(ngModel)]="biz.business_name" /></div>
            <div class="sm:col-span-2"><label class="label">Address</label><textarea class="input" rows="2" name="ba" [(ngModel)]="biz.business_address"></textarea></div>
            <div><label class="label">Phone</label><input class="input" name="bp" [(ngModel)]="biz.business_phone" /></div>
            <div><label class="label">Email</label><input class="input" name="be" [(ngModel)]="biz.business_email" /></div>
            <div><label class="label">GSTIN</label><input class="input" name="gst" [(ngModel)]="biz.gstin" /></div>
            <div class="sm:col-span-2"><label class="label">Receipt Footer</label><input class="input" name="rf" [(ngModel)]="biz.receipt_footer" placeholder="Thank you for your payment." /></div>
          </div>
          <button class="btn btn-primary mt-5" [disabled]="busy()">Save Business Details</button>
        </form>

        <form class="card card-pad xl:col-span-2" (ngSubmit)="saveAlertEmail()">
          <h2 class="card-title mb-1">Online Booking Email</h2>
          <p class="text-sm text-ink-500 mb-4">When a client books on the booking page, an email with the booking PDF is sent here. Separate several addresses with commas.</p>
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex-1 min-w-[240px]"><label class="label">Send booking emails to</label>
              <input class="input" name="bne" [(ngModel)]="biz.booking_notify_email" [placeholder]="biz.business_email || 'owner@example.com'" /></div>
            <button class="btn btn-primary" [disabled]="busy()">Save</button>
            <button type="button" class="btn btn-secondary" (click)="testEmail()" [disabled]="testing()"><app-icon name="check" [size]="16" />{{ testing() ? 'Sending...' : 'Send test email' }}</button>
          </div>
          @if (mail(); as m) {
            @if (m.configured) { <p class="hint !text-emerald-700 mt-2">Email sending is set up on the server.@if (m.to) { Booking emails go to <b>{{ m.to }}</b>. }</p> }
            @else {
              <div class="mt-3 rounded-xl bg-gold-50 text-gold-700 text-sm p-3">
                Email sending is not set up yet. Add these lines to <code>server/.env</code> and restart the server (Gmail: use an <b>App password</b>):
                <pre class="mt-2 text-xs bg-white rounded-lg p-2 overflow-x-auto text-ink-800">SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=yourname&#64;gmail.com
SMTP_PASS=your-16-letter-app-password
SMTP_FROM=BookMyUtsav &lt;yourname&#64;gmail.com&gt;</pre>
              </div>
            }
          }
        </form>

        <section class="card card-pad xl:col-span-2">
          <h2 class="card-title mb-1">Event Types &amp; Calendar Colours</h2>
          <p class="text-sm text-ink-500 mb-4">Each type gets its own colour on the calendar.</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (t of types(); track t.id) {
              <div class="flex items-center gap-2 rounded-xl border border-ink-100 p-2">
                <input type="color" class="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" [value]="t.color" (change)="updateType(t, { color: $any($event.target).value })" [attr.aria-label]="t.name + ' colour'" />
                <input class="input !py-2 flex-1" [value]="t.name" (change)="updateType(t, { name: $any($event.target).value })" />
                <span class="text-xs text-ink-400 w-14 text-right">{{ t.event_count }} ev.</span>
                <button class="btn-icon hover:!text-red-600" (click)="removeType(t)" [disabled]="!!t.event_count" title="Delete"><app-icon name="trash" [size]="16" /></button>
              </div>
            }
            <form class="flex items-center gap-2 rounded-xl border-2 border-dashed border-ink-200 p-2" (ngSubmit)="addType()">
              <input type="color" class="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" name="nc" [(ngModel)]="newType.color" />
              <input class="input !py-2 flex-1" name="nn" [(ngModel)]="newType.name" placeholder="New type name" />
              <button class="btn btn-secondary btn-sm" [disabled]="!newType.name.trim()">Add</button>
            </form>
          </div>
        </section>
      }
    </div>
  `,
})
export class SettingsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private lookups = inject(LookupService);
  auth = inject(AuthService);
  busy = signal(false);
  testing = signal(false);
  mail = signal<{ configured: boolean; to: string } | null>(null);
  types = signal<EventType[]>([]);
  biz: Partial<Settings> = {};
  pw = { current: '', next: '', confirm: '' };
  newType = { name: '', color: '#7c3aed' };

  constructor() {
    if (this.auth.isAdmin()) {
      this.api.get<Settings>('/settings').then((s) => { this.biz = s; this.loadTypes(); }).catch((e) => this.toast.fail(e));
      this.loadMail();
    }
  }

  async loadTypes(): Promise<void> {
    this.types.set(await this.api.get<EventType[]>('/event-types'));
  }

  async changePassword(valid: boolean | null): Promise<void> {
    if (!valid || this.pw.next !== this.pw.confirm) return;
    this.busy.set(true);
    try {
      await this.api.put('/auth/password', { current_password: this.pw.current, new_password: this.pw.next });
      this.toast.success('Password updated');
      this.pw = { current: '', next: '', confirm: '' };
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async saveBusiness(): Promise<void> {
    this.busy.set(true);
    try {
      this.biz = await this.api.put<Settings>('/settings', this.biz);
      this.toast.success('Business details saved');
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  loadMail(): void {
    this.api.get<{ configured: boolean; to: string }>('/settings/email-status').then((m) => this.mail.set(m)).catch(() => {});
  }

  async saveAlertEmail(): Promise<void> {
    this.busy.set(true);
    try {
      this.biz = await this.api.put<Settings>('/settings', { booking_notify_email: this.biz.booking_notify_email || '' });
      this.toast.success('Booking email saved');
      this.loadMail();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async testEmail(): Promise<void> {
    this.testing.set(true);
    try {
      const r = await this.api.post<{ sent_to: string }>('/settings/test-email');
      this.toast.success(`Test email sent to ${r.sent_to}. Check your inbox (and spam).`);
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.testing.set(false);
    }
  }

  async updateType(t: EventType, patch: Partial<EventType>): Promise<void> {
    try {
      await this.api.put(`/event-types/${t.id}`, patch);
      this.toast.success('Event type updated');
      await this.loadTypes();
      this.lookups.reload();
    } catch (e) {
      this.toast.fail(e);
      this.loadTypes();
    }
  }

  async addType(): Promise<void> {
    if (!this.newType.name.trim()) return;
    try {
      await this.api.post('/event-types', this.newType);
      this.newType = { name: '', color: '#7c3aed' };
      await this.loadTypes();
      this.lookups.reload();
      this.toast.success('Event type added');
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async removeType(t: EventType): Promise<void> {
    if (!(await this.confirm.delete(`event type "${t.name}"`))) return;
    try {
      await this.api.delete(`/event-types/${t.id}`);
      await this.loadTypes();
      this.lookups.reload();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
