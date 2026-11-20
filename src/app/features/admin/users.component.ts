import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { ToastService } from '../../core/toast.service';
import { Role, User } from '../../core/models';
import { FORMAT_PIPES } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Users &amp; Roles</h1><p class="page-sub">Admins have full access. Staff can manage events, checklists, materials, expenses and payments, but cannot delete records, edit payments, or see reports and profit.</p></div>
      <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add User</button>
    </div>
    <div class="card p-2">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td class="font-semibold">{{ u.name }} @if (u.id === auth.user()?.id) { <span class="chip ml-1">You</span> }</td>
                <td>{{ u.email }}</td>
                <td><span class="badge" [class]="u.role | badge">{{ u.role | label }}</span></td>
                <td>@if (u.active) { <span class="badge bg-emerald-50 text-emerald-700">Active</span> } @else { <span class="badge bg-ink-100 text-ink-500">Disabled</span> }</td>
                <td class="text-right whitespace-nowrap">
                  <button class="btn-icon" (click)="edit(u)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                  @if (u.id !== auth.user()?.id) { <button class="btn-icon hover:!text-red-600" (click)="remove(u)" title="Delete"><app-icon name="trash" [size]="16" /></button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit User' : 'Add User'" (closed)="open.set(false)">
      <form #uf="ngForm" id="userForm" (ngSubmit)="save(uf.valid)" class="space-y-4">
        <div><label class="label">Name *</label><input class="input" name="name" [(ngModel)]="form.name" required /></div>
        <div>
          <label class="label">Email *</label><input class="input" type="email" name="email" [(ngModel)]="form.email" required email #em="ngModel" />
          @if (em.invalid && em.touched) { <p class="err">Enter a valid email</p> }
          @if (errors()['email']) { <p class="err">{{ errors()['email'] }}</p> }
        </div>
        <div>
          <label class="label">Role</label>
          <select class="input" name="role" [(ngModel)]="form.role"><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select>
        </div>
        <div>
          <label class="label">{{ form.id ? 'New Password (leave blank to keep)' : 'Password *' }}</label>
          <input class="input" type="password" name="password" [(ngModel)]="password" [required]="!form.id" minlength="8" autocomplete="new-password" #pw="ngModel" />
          @if (pw.invalid && pw.touched) { <p class="err">Minimum 8 characters</p> }
        </div>
        <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" class="rounded" name="active" [(ngModel)]="active" />Active (can log in)</label>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="userForm" [disabled]="saving()">Save User</button>
      </div>
    </app-modal>
  `,
})
export class UsersComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  users = signal<User[]>([]);
  open = signal(false);
  saving = signal(false);
  errors = signal<Record<string, string>>({});
  form: { id?: number; name: string; email: string; role: Role } = { name: '', email: '', role: 'STAFF' };
  password = '';
  active = true;

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    try {
      this.users.set(await this.api.get<User[]>('/users'));
    } catch (e) {
      this.toast.fail(e);
    }
  }

  openNew(): void {
    this.form = { name: '', email: '', role: 'STAFF' };
    this.password = '';
    this.active = true;
    this.errors.set({});
    this.open.set(true);
  }

  edit(u: User): void {
    this.form = { id: u.id, name: u.name, email: u.email, role: u.role };
    this.password = '';
    this.active = !!u.active;
    this.errors.set({});
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    this.saving.set(true);
    const body: Record<string, unknown> = { name: this.form.name, email: this.form.email, role: this.form.role, active: this.active };
    if (this.password) body['password'] = this.password;
    try {
      if (this.form.id) await this.api.put(`/users/${this.form.id}`, body);
      else await this.api.post('/users', body);
      this.toast.success('User saved');
      this.open.set(false);
      this.load();
    } catch (e) {
      this.errors.set(ApiService.fieldErrors(e));
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(u: User): Promise<void> {
    if (!(await this.confirm.delete(`user "${u.name}"`, 'Users with recorded activity are disabled instead of deleted, to keep history intact.'))) return;
    try {
      const r = await this.api.delete<{ disabled?: boolean } | null>(`/users/${u.id}`);
      this.toast.success(r?.disabled ? 'User disabled (has activity history)' : 'User deleted');
      this.load();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
