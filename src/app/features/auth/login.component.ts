import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen grid lg:grid-cols-2">
      <div class="hidden lg:flex relative overflow-hidden bg-brand-950 text-white p-12 flex-col justify-between">
        <div class="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-800/60 blur-3xl"></div>
        <div class="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-gold-500/20 blur-3xl"></div>
        <div class="relative rounded-2xl bg-white p-4 shadow-lift">
          <img src="/brand/logo-full.png" alt="BookMyUtsav – Plan, Book, Celebrate" class="w-full h-auto" />
        </div>
        <div class="relative max-w-md">
          <p class="text-gold-400 font-semibold tracking-wide mb-3">Plan • Book • Celebrate</p>
          <h1 class="font-display text-5xl leading-tight text-white">Every function, payment and detail in one place.</h1>
          <p class="mt-6 text-brand-200">Plan weddings and events, track decoration checklists, materials, vendors, expenses and client installments with automatic profit &amp; loss.</p>
        </div>
        <p class="relative text-xs text-brand-300">© {{ year }} BookMyUtsav</p>
      </div>

      <div class="flex items-center justify-center p-6 sm:p-12">
        <form class="w-full max-w-sm" #f="ngForm" (ngSubmit)="submit(f.valid)" novalidate>
          <div class="lg:hidden mb-10">
            <img src="/brand/logo-full.png" alt="BookMyUtsav – Plan, Book, Celebrate" class="w-full h-auto" />
          </div>
          <h2 class="font-display text-3xl font-bold">Welcome back</h2>
          <p class="text-sm text-ink-500 mt-2 mb-8">Sign in to manage your events.</p>

          @if (error()) {
            <div class="mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex gap-2"><app-icon name="alert" [size]="16" />{{ error() }}</div>
          }

          <label class="label" for="email">Email</label>
          <input id="email" class="input" type="email" name="email" [(ngModel)]="email" required email autocomplete="username" #em="ngModel" />
          @if (em.invalid && (em.touched || submitted())) { <p class="err">Enter a valid email address</p> }

          <label class="label mt-4" for="password">Password</label>
          <div class="relative">
            <input id="password" class="input pr-11" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" #pw="ngModel" />
            <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 btn-icon !w-8 !h-8" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><app-icon name="eye" [size]="16" /></button>
          </div>
          @if (pw.invalid && (pw.touched || submitted())) { <p class="err">Password is required</p> }

          <button class="btn btn-primary w-full mt-8 !py-3" [disabled]="loading()">
            @if (loading()) { Signing in... } @else { Sign in }
          </button>
          <p class="text-sm text-center mt-6 text-ink-600">New business? <a routerLink="/signup" class="font-semibold text-brand-700 hover:underline">Create an account</a></p>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  email = '';
  password = '';
  year = new Date().getFullYear();
  loading = signal(false);
  submitted = signal(false);
  error = signal('');
  show = signal(false);

  async submit(valid: boolean | null): Promise<void> {
    this.submitted.set(true);
    if (!valid) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email.trim(), this.password);
      const ret = this.route.snapshot.queryParamMap.get('returnUrl');
      this.router.navigateByUrl(ret && ret.startsWith('/') && !ret.startsWith('/login') ? ret : '/dashboard');
    } catch (e) {
      this.error.set(ApiService.message(e));
    } finally {
      this.loading.set(false);
    }
  }
}
