import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Company, CompanyStatus } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

const STATUS: Record<CompanyStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Waiting for approval', cls: 'bg-gold-50 text-gold-700' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
  SUSPENDED: { label: 'ID stopped', cls: 'bg-red-50 text-red-700' },
};

/** Super Admin: businesses that signed up. Check their details and KYC, then approve, reject or suspend. */
@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end gap-3 mb-6">
      <div class="flex-1">
        <h1 class="page-title">Companies</h1>
        <p class="page-sub">Businesses using your panel. New sign-ups can log in only after you approve them. Each company sees only its own data.</p>
      </div>
      <button class="btn btn-secondary" (click)="load()"><app-icon name="refresh" [size]="16" />Refresh</button>
    </div>

    <div class="flex gap-1.5 overflow-x-auto mb-5" role="tablist">
      @for (t of tabs; track t.key) {
        <button type="button" role="tab" class="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition"
                [class]="tab() === t.key ? 'bg-brand-800 text-white border-brand-800' : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'" (click)="tab.set(t.key)">
          {{ t.label }}
          <span class="rounded-full px-2 py-0.5 text-[11px] font-bold" [class]="t.key === 'PENDING' && count(t.key) ? 'bg-gold-400 text-brand-950' : tab() === t.key ? 'bg-white/20' : 'bg-ink-100 text-ink-500'">{{ count(t.key) }}</span>
        </button>
      }
    </div>

    @if (loading()) { <div class="card card-pad text-ink-400">Loading...</div> }
    <div class="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
      @for (c of shown(); track c.id) {
        <article class="card card-pad flex flex-col gap-3">
          <div class="flex items-start gap-3">
            <div class="w-11 h-11 rounded-xl bg-brand-100 text-brand-800 flex items-center justify-center font-bold">{{ c.company_name.slice(0, 1).toUpperCase() }}</div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">{{ c.company_name }}@if (c.is_main) { <span class="badge bg-brand-50 text-brand-700 ml-1">Your company</span> }</p>
              <p class="text-xs text-ink-500">{{ c.business_type }} · Signed up {{ c.created_at.slice(0, 10) | dmy }}</p>
            </div>
            <span class="badge" [class]="st(c.status).cls">{{ st(c.status).label }}</span>
          </div>
          <div class="text-sm text-ink-600 space-y-1">
            <p class="flex items-center gap-2"><app-icon name="client" [size]="14" />{{ c.owner_name }}</p>
            <p class="flex items-center gap-2"><app-icon name="phone" [size]="14" /><a [href]="'tel:' + c.phone" class="hover:text-brand-700">{{ c.phone }}</a> · <a [href]="'mailto:' + c.email" class="hover:text-brand-700 truncate">{{ c.email }}</a></p>
            <p class="flex items-center gap-2"><app-icon name="event" [size]="14" />/book/{{ c.slug }}</p>
            @if (c.status_note) { <p class="text-xs rounded-lg bg-ink-50 px-2 py-1">Note: {{ c.status_note }}</p> }
          </div>
          <div class="mt-auto flex flex-wrap gap-2 pt-2 border-t border-ink-100">
            <button class="btn btn-secondary btn-sm" (click)="open(c)"><app-icon name="eye" [size]="14" />View details &amp; KYC</button>
            @if (waLink(c); as wa) {
              <a class="btn btn-secondary btn-sm !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50" [href]="wa" target="_blank" rel="noopener" [title]="'Send the ' + st(c.status).label.toLowerCase() + ' message to ' + c.phone + ' on WhatsApp'"><app-icon name="phone" [size]="14" />WhatsApp</a>
            }
            <span class="flex-1"></span>
            @if (!c.is_main) {
              @switch (c.status) {
                @case ('PENDING') {
                  <button class="btn btn-ghost btn-sm hover:!text-red-600" (click)="act(c, 'reject')">Reject</button>
                  <button class="btn btn-primary btn-sm" (click)="act(c, 'approve')"><app-icon name="check" [size]="14" />Approve</button>
                }
                @case ('APPROVED') { <button class="btn btn-secondary btn-sm !text-red-700 !border-red-200 hover:!bg-red-50" (click)="act(c, 'suspend')" title="Stop this company's login and booking page"><app-icon name="x" [size]="14" />Stop ID</button> }
                @case ('SUSPENDED') { <button class="btn btn-primary btn-sm" (click)="act(c, 'reactivate')" title="Let this company log in again"><app-icon name="check" [size]="14" />Start ID</button> }
                @case ('REJECTED') { <button class="btn btn-primary btn-sm" (click)="act(c, 'approve')" title="Changed your mind? Approve this sign-up now"><app-icon name="check" [size]="14" />Approve</button> }
              }
            }
          </div>
        </article>
      } @empty {
        @if (!loading()) { <p class="col-span-full card card-pad text-center text-ink-400">No companies here.</p> }
      }
    </div>

    <app-modal [open]="!!detail()" [title]="detail()?.company_name || ''" [subtitle]="detail() ? st(detail()!.status).label : ''" size="lg" (closed)="detail.set(null)">
      @if (detail(); as d) {
        <div class="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          @for (row of rows(d); track row[0]) {
            <div><p class="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">{{ row[0] }}</p><p class="font-medium break-words">{{ row[1] || '—' }}</p></div>
          }
        </div>
        @if (!d.is_main) {
          <h3 class="font-semibold mt-6 mb-2">KYC documents</h3>
          <div class="grid sm:grid-cols-2 gap-4">
            @for (k of kinds; track k.key) {
              <div class="rounded-xl border border-ink-100 p-3">
                <p class="text-sm font-semibold mb-2">{{ k.label }}</p>
                @if (k.key === 'aadhaar' ? d.has_aadhaar_photo : d.has_pan_photo) {
                  <a [href]="kycUrl(d.id, k.key)" target="_blank" rel="noopener" title="Open full size">
                    <img [src]="kycUrl(d.id, k.key)" [alt]="k.label" class="w-full max-h-64 object-contain rounded-lg bg-ink-50" />
                  </a>
                } @else { <p class="text-sm text-ink-400">No photo</p> }
              </div>
            }
          </div>
        }
      }
      <div footer class="flex flex-wrap gap-2 justify-end w-full">
        @if (detail(); as d) {
          @if (!d.is_main && d.status === 'REJECTED') {
            <button class="btn btn-primary" (click)="act(d, 'approve')"><app-icon name="check" [size]="16" />Approve</button>
          }
          @if (!d.is_main && d.status === 'PENDING') {
            <button class="btn btn-ghost hover:!text-red-600" (click)="act(d, 'reject')">Reject</button>
            <button class="btn btn-primary" (click)="act(d, 'approve')"><app-icon name="check" [size]="16" />Approve</button>
          }
          @if (!d.is_main && d.status === 'APPROVED') {
            <button class="btn btn-secondary !text-red-700 !border-red-200 hover:!bg-red-50" (click)="act(d, 'suspend')"><app-icon name="x" [size]="16" />Stop ID</button>
          }
          @if (!d.is_main && d.status === 'SUSPENDED') {
            <button class="btn btn-primary" (click)="act(d, 'reactivate')"><app-icon name="check" [size]="16" />Start ID</button>
          }
        }
        @if (detail(); as d) {
          @if (waLink(d); as wa) { <a class="btn btn-secondary !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50" [href]="wa" target="_blank" rel="noopener"><app-icon name="phone" [size]="16" />Tell on WhatsApp</a> }
        }
        <button class="btn btn-secondary" (click)="detail.set(null)">Close</button>
      </div>
    </app-modal>
  `,
})
export class CompaniesComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  tabs: { key: CompanyStatus | 'ALL'; label: string }[] = [
    { key: 'PENDING', label: 'Waiting' }, { key: 'APPROVED', label: 'Approved' }, { key: 'SUSPENDED', label: 'Stopped' },
    { key: 'REJECTED', label: 'Rejected' }, { key: 'ALL', label: 'All' },
  ];
  kinds = [{ key: 'aadhaar' as const, label: 'Aadhaar card' }, { key: 'pan' as const, label: 'PAN card' }];

  list = signal<Company[]>([]);
  loading = signal(true);
  tab = signal<CompanyStatus | 'ALL'>('PENDING');
  detail = signal<Company | null>(null);
  shown = computed(() => (this.tab() === 'ALL' ? this.list() : this.list().filter((c) => c.status === this.tab())));

  constructor() {
    this.load();
  }

  st(s: CompanyStatus) {
    return STATUS[s];
  }

  count(k: CompanyStatus | 'ALL'): number {
    return k === 'ALL' ? this.list().length : this.list().filter((c) => c.status === k).length;
  }

  kycUrl(id: number, kind: 'aadhaar' | 'pan'): string {
    return `/api/super/companies/${id}/kyc/${kind}?token=${encodeURIComponent(this.auth.token || '')}`;
  }

  /**
   * WhatsApp link to the company's mobile with the message for its current status already typed.
   * Opens the Super Admin's own WhatsApp; nothing is sent until they press Send.
   */
  waLink(c: Company): string | null {
    if (c.is_main || c.status === 'PENDING') return null;
    let phone = String(c.phone || '').replace(/\D/g, '');
    if (phone.length === 10) phone = `91${phone}`;
    if (phone.length < 11) return null;
    const origin = location.origin;
    const reason = c.status_note ? `\nKaaran: ${c.status_note}` : '';
    const text = {
      APPROVED: `Namaste ${c.owner_name} ji,\nAapka BookMyUtsav account (${c.company_name}) approve ho gaya hai. 🎉\n\nLogin: ${origin}/login\nAapka booking page: ${origin}/book/${c.slug}`,
      REJECTED: `Namaste ${c.owner_name} ji,\nAapka BookMyUtsav sign-up (${c.company_name}) approve nahi hua.${reason}\n\nSahi details ke saath dobara sign-up karein: ${origin}/signup`,
      SUSPENDED: `Namaste ${c.owner_name} ji,\nAapki BookMyUtsav ID (${c.company_name}) abhi band kar di gayi hai.${reason}\n\nDobara chalu karne ke liye humse sampark karein.`,
    }[c.status as 'APPROVED' | 'REJECTED' | 'SUSPENDED'];
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  rows(d: Company): [string, string | null][] {
    return [
      ['Owner name', d.owner_name], ['Mobile', d.phone], ['Email (login)', d.email], ['Business type', d.business_type],
      ['Profile name', d.profile_name], ['Booking page', `${location.origin}/book/${d.slug}`], ['Address', d.address],
      ['Aadhaar number', d.aadhaar_no ? d.aadhaar_no.replace(/(\d{4})(?=\d)/g, '$1 ') : d.aadhaar_last4 ? `XXXX XXXX ${d.aadhaar_last4}` : null],
      ['PAN number', d.pan_no || d.pan_masked], ['Signed up', d.created_at], ['Approved', d.approved_at],
    ];
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.api.get<Company[]>('/super/companies');
      this.list.set(list);
      if (this.tab() === 'PENDING' && !list.some((c) => c.status === 'PENDING')) this.tab.set('APPROVED');
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.loading.set(false);
    }
  }

  async open(c: Company): Promise<void> {
    try {
      this.detail.set(await this.api.get<Company>(`/super/companies/${c.id}`));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async act(c: Company, action: 'approve' | 'reject' | 'suspend' | 'reactivate'): Promise<void> {
    let body: { reason?: string } = {};
    if (action === 'approve' && !window.confirm(`Approve ${c.company_name}? They can log in and use the panel right away.`)) return;
    if (action === 'reject' || action === 'suspend') {
      const reason = window.prompt(action === 'reject'
        ? `Why are you rejecting ${c.company_name}? (shown to them)`
        : `Stop the ID of ${c.company_name}? They cannot log in and their booking page closes. Their data stays safe.\n\nReason (shown when they try to log in), e.g. "Payment pending":`, action === 'suspend' ? 'Payment pending – please contact us' : '');
      if (reason === null) return;
      body = { reason: reason.trim() };
    }
    try {
      const updated = await this.api.post<Company>(`/super/companies/${c.id}/${action}`, body);
      this.list.update((l) => l.map((x) => (x.id === c.id ? { ...x, ...updated } : x)));
      if (this.detail()?.id === c.id) this.detail.set({ ...this.detail()!, ...updated });
      const msg = { approve: 'approved – they can log in now', reject: 'rejected', suspend: 'ID stopped – they cannot log in now', reactivate: 'ID started again – they can log in now' }[action];
      this.toast.success(`${c.company_name} ${msg}. An email went to ${c.email}. Use the WhatsApp button to tell them on ${c.phone}.`);
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
