import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { resizeImage } from '../../core/service-images';
import { IconComponent } from '../../shared/icon.component';

interface Card { data: string; mime: string; name: string; }

const BUSINESS_TYPES = ['Wedding Planner', 'Event Management', 'Decorator', 'Tent House', 'Photographer', 'DJ & Sound', 'Caterer', 'Banquet / Venue', 'Other'];

/** Business sign-up. The account can be used after the Super Admin approves it. */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-ink-50">
      <header class="bg-brand-950 text-white">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center gap-5">
          <div class="rounded-2xl bg-white p-2.5 shrink-0 w-full max-w-xs"><img src="/brand/logo-full.png" alt="BookMyUtsav – Plan, Book, Celebrate" class="w-full h-auto" /></div>
          <div>
            <h1 class="font-display text-3xl font-bold text-white">Create your business account</h1>
            <p class="text-brand-200 text-sm mt-1">Fill in your details. We check them and approve your account, then you can log in.</p>
          </div>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        @if (done(); as slug) {
          <div class="card card-pad text-center max-w-xl mx-auto">
            <div class="w-14 h-14 mx-auto rounded-full bg-gold-50 text-gold-700 flex items-center justify-center"><app-icon name="clock" [size]="28" /></div>
            <h2 class="text-2xl font-bold mt-3">Sign-up received</h2>
            <p class="text-ink-600 mt-2">Thank you, {{ f.owner_name }}. Your account is <b>waiting for approval</b>. You will get an email at <b>{{ f.email }}</b> when it is approved.</p>
            <p class="text-sm text-ink-500 mt-3">Your booking page will be: <b class="text-brand-700">{{ origin }}/book/{{ slug }}</b></p>
            <a routerLink="/login" class="btn btn-primary mt-6">Go to login</a>
          </div>
        } @else {
          <form class="space-y-6" (ngSubmit)="submit()" novalidate>
            <section class="card card-pad">
              <h2 class="card-title mb-4">1. Your details</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <div><label class="label" for="s-name">Full name *</label><input id="s-name" class="input" name="owner_name" [(ngModel)]="f.owner_name" maxlength="120" autocomplete="name" /></div>
                <div><label class="label" for="s-phone">Mobile number *</label><input id="s-phone" class="input" name="phone" [(ngModel)]="f.phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile" /></div>
                <div><label class="label" for="s-email">Email *</label><input id="s-email" type="email" class="input" name="email" [(ngModel)]="f.email" autocomplete="email" /><p class="hint">You log in with this email.</p></div>
                <div class="sm:col-span-2"><label class="label" for="s-addr">Address *</label><textarea id="s-addr" class="input" rows="2" name="address" [(ngModel)]="f.address" maxlength="500"></textarea></div>
              </div>
            </section>

            <section class="card card-pad">
              <h2 class="card-title mb-4">2. Your business</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <div><label class="label" for="s-company">Company name *</label><input id="s-company" class="input" name="company_name" [(ngModel)]="f.company_name" maxlength="150" autocomplete="organization" /></div>
                <div><label class="label" for="s-type">Business type *</label>
                  <select id="s-type" class="input" name="business_type" [(ngModel)]="f.business_type">
                    <option value="">Select...</option>
                    @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
                  </select></div>
                <div class="sm:col-span-2"><label class="label" for="s-profile">Profile name *</label>
                  <input id="s-profile" class="input" name="profile_name" [(ngModel)]="f.profile_name" maxlength="80" (input)="checkSlug()" placeholder="e.g. Sharma Events" />
                  @if (slug()) {
                    <p class="hint" [class.!text-emerald-700]="slugOk()" [class.!text-red-600]="slugOk() === false">
                      Your booking page: {{ origin }}/book/<b>{{ slug() }}</b>
                      @if (slugOk() === false) { – already taken, choose another name } @else if (slugOk()) { – available }
                    </p>
                  }
                </div>
              </div>
            </section>

            <section class="card card-pad">
              <h2 class="card-title mb-1">3. KYC documents</h2>
              <p class="text-sm text-ink-500 mb-4">Kept encrypted. Only the administrator can see them, to verify your business.</p>
              <div class="grid sm:grid-cols-2 gap-4">
                <div><label class="label" for="s-aadhaar">Aadhaar number *</label><input id="s-aadhaar" class="input tracking-wider" name="aadhaar_no" [(ngModel)]="f.aadhaar_no" inputmode="numeric" maxlength="14" placeholder="1234 5678 9012" autocomplete="off" /></div>
                <div><label class="label" for="s-pan">PAN number *</label><input id="s-pan" class="input uppercase tracking-wider" name="pan_no" [(ngModel)]="f.pan_no" maxlength="10" placeholder="ABCDE1234F" autocomplete="off" /></div>
                @for (k of cards; track k.key) {
                  <div>
                    <span class="label">{{ k.label }} photo *</span>
                    <label class="flex items-center gap-3 rounded-xl border-2 border-dashed p-3 cursor-pointer hover:bg-ink-50" [class]="card(k.key) ? 'border-emerald-300' : 'border-ink-200'">
                      @if (card(k.key); as c) { <img [src]="c.data" alt="" class="w-16 h-12 rounded-md object-cover" /> }
                      @else { <span class="w-16 h-12 rounded-md bg-ink-100 flex items-center justify-center text-ink-400"><app-icon name="image" [size]="20" /></span> }
                      <span class="text-sm flex-1 min-w-0"><b class="block">{{ card(k.key) ? 'Change photo' : 'Upload photo' }}</b><span class="text-ink-500 truncate block">{{ card(k.key)?.name || 'JPG or PNG, clear and readable' }}</span></span>
                      <input type="file" accept="image/*" class="hidden" (change)="pick(k.key, $event)" />
                    </label>
                  </div>
                }
              </div>
            </section>

            <section class="card card-pad">
              <h2 class="card-title mb-4">4. Password</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <div><label class="label" for="s-pw">Password *</label><input id="s-pw" type="password" class="input" name="password" [(ngModel)]="f.password" autocomplete="new-password" /><p class="hint">At least 8 characters.</p></div>
                <div><label class="label" for="s-pw2">Confirm password *</label><input id="s-pw2" type="password" class="input" name="confirm" [(ngModel)]="confirm" autocomplete="new-password" /></div>
              </div>
            </section>

            @if (error()) { <div class="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex gap-2"><app-icon name="alert" [size]="16" />{{ error() }}</div> }
            <div class="flex flex-wrap items-center gap-4">
              <button class="btn btn-primary !px-8 !py-3" [disabled]="sending()">{{ sending() ? 'Sending...' : 'Create account' }}</button>
              <span class="text-sm text-ink-600">Already have an account? <a routerLink="/login" class="font-semibold text-brand-700 hover:underline">Log in</a></span>
            </div>
          </form>
        }
      </main>
    </div>
  `,
})
export class SignupComponent {
  private api = inject(ApiService);
  types = BUSINESS_TYPES;
  cards = [{ key: 'aadhaar' as const, label: 'Aadhaar card' }, { key: 'pan' as const, label: 'PAN card' }];
  origin = location.origin;
  f = { owner_name: '', phone: '', email: '', address: '', company_name: '', business_type: '', profile_name: '', aadhaar_no: '', pan_no: '', password: '' };
  confirm = '';
  photos = signal<Partial<Record<'aadhaar' | 'pan', Card>>>({});
  slug = signal('');
  slugOk = signal<boolean | null>(null);
  sending = signal(false);
  error = signal('');
  done = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  card(k: 'aadhaar' | 'pan'): Card | undefined {
    return this.photos()[k];
  }

  checkSlug(): void {
    clearTimeout(this.timer);
    this.slugOk.set(null);
    this.timer = setTimeout(async () => {
      if (!this.f.profile_name.trim()) { this.slug.set(''); return; }
      try {
        const r = await this.api.get<{ slug: string; available: boolean }>('/public/slug-available', { name: this.f.profile_name });
        this.slug.set(r.slug);
        this.slugOk.set(r.available);
      } catch { /* checked again on submit */ }
    }, 350);
  }

  async pick(k: 'aadhaar' | 'pan', ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const img = await resizeImage(file, 1800, 0.85);
      this.photos.update((p) => ({ ...p, [k]: { data: img.data_base64, mime: img.mime_type, name: file.name } }));
    } catch {
      this.error.set('That file could not be read as a photo. Please choose a JPG or PNG image.');
    }
  }

  async submit(): Promise<void> {
    const f = this.f;
    const need: [string, string][] = [[f.owner_name, 'your name'], [f.phone, 'mobile number'], [f.email, 'email'], [f.address, 'address'],
      [f.company_name, 'company name'], [f.business_type, 'business type'], [f.profile_name, 'profile name'], [f.aadhaar_no, 'Aadhaar number'], [f.pan_no, 'PAN number']];
    const missing = need.find(([v]) => !String(v).trim());
    this.error.set('');
    if (missing) { this.error.set(`Please enter ${missing[1]}.`); return; }
    if (!/^\d{12}$/.test(f.aadhaar_no.replace(/[\s-]/g, ''))) { this.error.set('Aadhaar number must have 12 digits.'); return; }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan_no.trim().toUpperCase())) { this.error.set('PAN must look like ABCDE1234F.'); return; }
    const p = this.photos();
    if (!p.aadhaar || !p.pan) { this.error.set('Please upload photos of both your Aadhaar card and PAN card.'); return; }
    if (f.password.length < 8) { this.error.set('Password must be at least 8 characters.'); return; }
    if (f.password !== this.confirm) { this.error.set('The two passwords do not match.'); return; }
    this.sending.set(true);
    try {
      const r = await this.api.post<{ slug: string }>('/public/signup', {
        ...f, pan_no: f.pan_no.trim().toUpperCase(),
        aadhaar_photo: p.aadhaar.data, aadhaar_photo_mime: p.aadhaar.mime, pan_photo: p.pan.data, pan_photo_mime: p.pan.mime,
      });
      this.done.set(r.slug);
      window.scrollTo({ top: 0 });
    } catch (e) {
      const fields = ApiService.fieldErrors(e);
      this.error.set(Object.values(fields)[0] || ApiService.message(e));
    } finally {
      this.sending.set(false);
    }
  }
}
