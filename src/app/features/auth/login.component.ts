import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ApiService } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { AuthBannerComponent } from './auth-banner.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, AuthBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col lg:grid lg:grid-cols-2 bg-brand-900 lg:bg-white">
      <app-auth-banner />

      <!-- Right: sign-in form -->
      <section class="relative flex-1 -mt-6 lg:mt-0 rounded-t-[28px] lg:rounded-none bg-white flex flex-col items-center justify-center px-6 pt-8 pb-16 sm:px-12 lg:p-14">
        <form class="w-full max-w-[400px]" #f="ngForm" (ngSubmit)="submit(f.valid)" novalidate>
          <img src="/brand/logo-full.png" alt="BookMyUtsav – Plan, Book, Celebrate" class="hidden lg:block w-[230px] h-auto mb-9" />
          <h2 class="font-display text-[28px] lg:text-[34px] font-bold text-brand-900">Welcome back</h2>
          <p class="text-sm lg:text-[15px] text-ink-600 mt-2 mb-7 lg:mb-8">Sign in to manage your events and bookings.</p>

          @if (error()) {
            <div class="mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex gap-2"><app-icon name="alert" [size]="16" />{{ error() }}</div>
          }

          <label class="label" for="email">Email</label>
          <input id="email" class="input !h-12 !rounded-xl" type="email" name="email" placeholder="you@business.com" [(ngModel)]="email" required email autocomplete="username" #em="ngModel" />
          @if (em.invalid && (em.touched || submitted())) { <p class="err">Enter a valid email address</p> }

          <label class="label mt-5" for="password">Password</label>
          <div class="relative">
            <input id="password" class="input !h-12 !rounded-xl pr-12" [type]="show() ? 'text' : 'password'" name="password" placeholder="Your password" [(ngModel)]="password" required autocomplete="current-password" #pw="ngModel" />
            <button type="button" class="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-ink-500 hover:text-ink-800" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'"><app-icon name="eye" [size]="18" /></button>
          </div>
          @if (pw.invalid && (pw.touched || submitted())) { <p class="err">Password is required</p> }

          <button class="btn btn-primary w-full mt-8 !h-[52px] !rounded-xl !text-base gap-2.5" [disabled]="loading()">
            @if (loading()) { Signing in... } @else {
              Sign in
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF761E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            }
          </button>

          <div class="flex items-center gap-3 my-7">
            <span class="flex-1 h-px bg-ink-100"></span>
            <span class="text-[13px] text-ink-500">New here?</span>
            <span class="flex-1 h-px bg-ink-100"></span>
          </div>
          <a routerLink="/signup" class="h-[52px] rounded-xl border-[1.5px] border-gold-500 bg-gold-50 text-gold-700 font-semibold text-[15px] flex items-center justify-center hover:bg-gold-100">Create a business account</a>
        </form>
        <p class="absolute bottom-6 text-[13px] text-ink-500">© {{ year }} BookMyUtsav</p>
      </section>
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
