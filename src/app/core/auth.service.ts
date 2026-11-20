import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User } from './models';

const TOKEN_KEY = 'eventpro.token';
const USER_KEY = 'eventpro.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly user = signal<User | null>(this.readUser());
  readonly isLoggedIn = computed(() => !!this.user() && !!this.token);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly isSuper = computed(() => !!this.user()?.is_super);
  /** The platform owner's own company (it can have several logins). */
  readonly isMainCompany = computed(() => this.user()?.company?.is_main ?? true);
  readonly companyName = computed(() => this.user()?.company?.name || 'BookMyUtsav');
  /** Public booking page of the logged-in company. */
  readonly bookingPath = computed(() => (this.user()?.company?.slug ? `/book/${this.user()!.company!.slug}` : '/book'));

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private readUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await this.api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.user.set(res.user);
  }

  /** Re-validate the stored token on app start. */
  async refresh(): Promise<void> {
    if (!this.token) return;
    try {
      const u = await this.api.get<User>('/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      this.user.set(u);
    } catch {
      this.clear();
    }
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
  }

  logout(): void {
    this.clear();
    this.router.navigate(['/login']);
  }
}
