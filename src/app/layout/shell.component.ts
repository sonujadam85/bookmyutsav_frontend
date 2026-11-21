import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { LookupService } from '../core/lookup.service';
import { IconComponent } from '../shared/icon.component';
import { LabelPipe } from '../core/format';

interface NavItem { path: string; label: string; icon: string; admin?: boolean; main?: boolean; super?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, IconComponent, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen lg:flex">
      <!-- Mobile backdrop -->
      @if (menuOpen()) { <div class="fixed inset-0 z-30 bg-ink-950/40 lg:hidden no-print" (click)="menuOpen.set(false)"></div> }

      <aside class="no-print fixed lg:sticky top-0 z-40 h-screen w-72 shrink-0 bg-brand-950 text-brand-100 flex flex-col transition-transform lg:translate-x-0"
             [class.-translate-x-full]="!menuOpen()">
        <div class="px-6 py-6 flex items-center gap-3">
          <img [src]="auth.companyLogo()" [alt]="auth.companyName() + ' logo'" class="w-11 h-11 rounded-xl shadow-lg ring-1 ring-white/10 bg-white object-contain p-0.5 shrink-0" />
          <div class="min-w-0">
            <p class="font-display text-xl text-white leading-tight truncate max-w-[180px]" [title]="auth.companyName()">{{ auth.companyName() }}</p>
            <p class="text-[11px] uppercase tracking-[0.2em] text-gold-400">@if (auth.isSuper()) { Super Admin · BookMyUtsav } @else if (auth.isMainCompany()) { BookMyUtsav } @else { on BookMyUtsav }</p>
          </div>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
          @for (group of groups(); track group.title) {
            <div>
              <p class="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-400">{{ group.title }}</p>
              @for (item of group.items; track item.path) {
                <a [routerLink]="item.path" routerLinkActive="!bg-white/10 !text-white" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
                   class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-200 hover:bg-white/5 hover:text-white transition">
                  <app-icon [name]="item.icon" [size]="18" />{{ item.label }}
                </a>
              }
            </div>
          }
        </nav>
        <div class="p-4 border-t border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-brand-700 text-white flex items-center justify-center text-sm font-semibold">{{ initials() }}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-white truncate">{{ auth.user()?.name }}</p>
              <p class="text-xs text-brand-300">{{ auth.user()?.role | label }}</p>
            </div>
            <button class="p-2 rounded-lg text-brand-300 hover:bg-white/10 hover:text-white" (click)="auth.logout()" title="Log out" aria-label="Log out"><app-icon name="logout" /></button>
          </div>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col">
        <header class="no-print sticky top-0 z-20 bg-ink-50/85 backdrop-blur border-b border-ink-100">
          <div class="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
            <button class="btn-icon lg:hidden" (click)="menuOpen.set(true)" aria-label="Open menu"><app-icon name="menu" /></button>
            <form class="flex-1 max-w-md" (ngSubmit)="search()">
              <label class="relative block">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"><app-icon name="search" [size]="16" /></span>
                <input class="input !py-2 pl-9 !bg-white" placeholder="Search events, clients, mobile..." name="q" [(ngModel)]="q" />
              </label>
            </form>
            <a routerLink="/events/new" class="btn btn-primary !hidden sm:!inline-flex"><app-icon name="plus" [size]="16" />New Event</a>
            <a routerLink="/events/new" class="btn-icon sm:hidden bg-brand-800 !text-white" aria-label="New event"><app-icon name="plus" /></a>
          </div>
        </header>
        <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  menuOpen = signal(false);
  q = '';

  private readonly items: { title: string; items: NavItem[] }[] = [
    { title: 'Overview', items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/calendar', label: 'Event Calendar', icon: 'calendar' },
    ] },
    { title: 'Operations', items: [
      { path: '/events', label: 'Events', icon: 'event' },
      { path: '/bookings', label: 'Booked Events', icon: 'image' },
      { path: '/clients', label: 'Clients', icon: 'client' },
      { path: '/services', label: 'Services & Prices', icon: 'money' },
      { path: '/inventory', label: 'Materials & Stock', icon: 'box' },
      { path: '/vendors', label: 'Vendors', icon: 'vendor' },
    ] },
    { title: 'Finance', items: [
      { path: '/payments', label: 'Client Payments', icon: 'wallet' },
      { path: '/expenses', label: 'Expenses', icon: 'receipt' },
      { path: '/reports', label: 'Reports', icon: 'report', admin: true },
    ] },
    { title: 'Admin', items: [
      { path: '/admin/companies', label: 'Companies', icon: 'client', super: true },
      { path: '/users', label: 'Users & Roles', icon: 'users', admin: true, main: true },
      { path: '/settings', label: 'Settings', icon: 'settings' },
    ] },
  ];

  groups = computed(() => {
    const admin = this.auth.isAdmin();
    const main = this.auth.isMainCompany();
    const sup = this.auth.isSuper();
    return this.items
      .map((g) => ({ ...g, items: g.items.filter((i) => (admin || !i.admin) && (main || !i.main) && (sup || !i.super)) }))
      .filter((g) => g.items.length);
  });

  initials = computed(() => (this.auth.user()?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase());

  constructor() {
    inject(LookupService).load();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuOpen.set(false));
  }

  search(): void {
    const q = this.q.trim();
    this.router.navigate(['/events'], { queryParams: q ? { q } : {} });
  }
}
