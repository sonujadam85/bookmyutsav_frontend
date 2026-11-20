import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { Client } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

type SortKey = 'name' | 'event_count' | 'total_booking' | 'pending';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Clients</h1><p class="page-sub">{{ clients().length }} clients · one client can book many events</p></div>
      <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Client</button>
    </div>

    <div class="card card-pad">
      <input class="input max-w-sm mb-4" placeholder="Search name, mobile or email" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="th-sort" (click)="sortBy('name')">Client {{ arrow('name') }}</th><th>Mobile</th><th>Email</th>
              <th class="th-sort !text-right" (click)="sortBy('event_count')">Events {{ arrow('event_count') }}</th>
              <th class="th-sort !text-right" (click)="sortBy('total_booking')">Booking {{ arrow('total_booking') }}</th>
              <th class="!text-right">Received</th>
              <th class="th-sort !text-right" (click)="sortBy('pending')">Pending {{ arrow('pending') }}</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of view(); track c.id) {
              <tr>
                <td><a [routerLink]="['/clients', c.id]" class="font-semibold hover:text-brand-700">{{ c.name }}</a></td>
                <td><a [href]="'tel:' + c.mobile" class="hover:underline">{{ c.mobile }}</a></td>
                <td>{{ c.email || '—' }}</td>
                <td class="text-right">{{ c.event_count }}</td>
                <td class="text-right money">{{ c.total_booking | inr }}</td>
                <td class="text-right money text-emerald-700">{{ c.total_received | inr }}</td>
                <td class="text-right money font-semibold" [class.text-red-600]="(c.pending || 0) > 0">{{ c.pending | inr }}</td>
                <td class="text-right whitespace-nowrap">
                  <a class="btn-icon" [routerLink]="['/events/new']" [queryParams]="{ clientId: c.id }" title="New event for this client"><app-icon name="plus" [size]="16" /></a>
                  <button class="btn-icon" (click)="edit(c)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                  @if (auth.isAdmin()) { <button class="btn-icon hover:!text-red-600" (click)="remove(c)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="8" class="text-center text-ink-400 py-8">No clients found</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit Client' : 'Add Client'" (closed)="open.set(false)">
      <form #cf="ngForm" id="clientForm" (ngSubmit)="save(cf.valid)" class="grid sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="label">Client / Party Name *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required #nm="ngModel" />
          @if (nm.invalid && nm.touched) { <p class="err">Name is required</p> }
        </div>
        <div>
          <label class="label">Mobile *</label>
          <input class="input" name="mobile" [(ngModel)]="form.mobile" required pattern="^\\+?[0-9\\s-]{10,18}$" #mb="ngModel" inputmode="tel" />
          @if (mb.invalid && mb.touched) { <p class="err">Enter a valid mobile number</p> }
          @if (errors()['mobile']) { <p class="err">{{ errors()['mobile'] }}</p> }
        </div>
        <div>
          <label class="label">Email</label>
          <input class="input" type="email" name="email" [(ngModel)]="form.email" email #em="ngModel" />
          @if (em.invalid && em.touched) { <p class="err">Enter a valid email</p> }
        </div>
        <div class="sm:col-span-2"><label class="label">Address</label><textarea class="input" rows="2" name="address" [(ngModel)]="form.address"></textarea></div>
        <div class="sm:col-span-2"><label class="label">Notes</label><textarea class="input" rows="2" name="notes" [(ngModel)]="form.notes"></textarea></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="clientForm" [disabled]="saving()">Save Client</button>
      </div>
    </app-modal>
  `,
})
export class ClientListComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);

  clients = signal<Client[]>([]);
  q = signal('');
  sort = signal<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  open = signal(false);
  saving = signal(false);
  errors = signal<Record<string, string>>({});
  form: Partial<Client> = {};

  view = computed(() => {
    const q = this.q().toLowerCase();
    const { key, dir } = this.sort();
    return this.clients()
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q) || (c.email || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[key] ?? 0;
        const bv = b[key] ?? 0;
        return (typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv)) * dir;
      });
  });

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    try {
      this.clients.set(await this.api.get<Client[]>('/clients'));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  sortBy(key: SortKey): void {
    this.sort.update((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }));
  }
  arrow(key: SortKey): string {
    const s = this.sort();
    return s.key === key ? (s.dir === 1 ? '↑' : '↓') : '';
  }

  openNew(): void {
    this.form = { name: '', mobile: '', email: '', address: '', notes: '' };
    this.errors.set({});
    this.open.set(true);
  }

  edit(c: Client): void {
    this.form = { ...c };
    this.errors.set({});
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    this.saving.set(true);
    const { id, name, mobile, email, address, notes } = this.form;
    try {
      if (id) await this.api.put(`/clients/${id}`, { name, mobile, email: email || null, address, notes });
      else await this.api.post('/clients', { name, mobile, email: email || null, address, notes });
      this.toast.success('Client saved');
      this.open.set(false);
      this.load();
    } catch (e) {
      this.errors.set(ApiService.fieldErrors(e));
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(c: Client): Promise<void> {
    if (!(await this.confirm.delete(`client "${c.name}"`, c.event_count ? 'This client has events and cannot be deleted until those are removed.' : undefined))) return;
    try {
      await this.api.delete(`/clients/${c.id}`);
      this.toast.success('Client deleted');
      this.load();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
