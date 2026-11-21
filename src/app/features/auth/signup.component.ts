import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { resizeImage, resizeLogo } from '../../core/service-images';
import { IconComponent } from '../../shared/icon.component';
import { AuthBannerComponent } from './auth-banner.component';

interface Card { data: string; mime: string; name: string; }

const BUSINESS_TYPES = ['Wedding Planner', 'Event Management', 'Decorator', 'Tent House', 'Photographer', 'DJ & Sound', 'Caterer', 'Banquet / Venue', 'Other'];

/** Business sign-up. The account can be used after the Super Admin approves it. */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass, IconComponent, AuthBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes stepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .step-in { animation: stepIn .35s ease both; }
    @media (prefers-reduced-motion: reduce) { .step-in { animation: none; } }
  `],
  template: `
    <div class="min-h-screen flex flex-col lg:grid lg:grid-cols-[560px_minmax(0,1fr)] bg-brand-900 lg:bg-white">
      <app-auth-banner [details]="false" />

      <section class="relative flex-1 -mt-6 lg:mt-0 rounded-t-[28px] lg:rounded-none bg-white flex flex-col px-5 pt-7 pb-10 sm:px-10 lg:px-20 lg:py-12">
        <div class="flex flex-wrap justify-between items-center gap-3 text-sm">
          <span class="text-ink-600">Already have an account? <a routerLink="/login" class="font-semibold text-brand-700 hover:underline">Log in</a></span>
          <span class="text-[13px] text-ink-600 flex items-center gap-1.5"><app-icon name="lock" [size]="14" />Your details are kept safe</span>
        </div>

        @if (done(); as slug) {
          <div class="flex-1 flex flex-col items-center justify-center text-center max-w-[480px] mx-auto gap-3.5 py-12">
            <div class="w-[72px] h-[72px] rounded-full bg-gold-50 text-gold-600 grid place-items-center"><app-icon name="clock" [size]="34" /></div>
            <h2 class="font-display text-[32px] font-bold text-brand-900">Sign-up mil gaya!</h2>
            <p class="text-base leading-relaxed text-ink-700">Shukriya {{ f.owner_name }} ji. Aapka account <b>approval ke liye wait</b> kar raha hai. Approve hote hi <b>{{ f.email }}</b> par email aayega.</p>
            <p class="text-sm text-ink-600">Aapka booking page: <b class="text-brand-700 break-all">{{ origin }}/book/{{ slug }}</b></p>
            <a routerLink="/login" class="btn btn-primary mt-2.5 !h-[52px] !px-7 !rounded-xl !text-base">Go to login</a>
          </div>
        } @else {
          <form class="flex-1 flex flex-col w-full max-w-[640px] mx-auto mt-8 lg:mt-10" (ngSubmit)="next()" novalidate>
            <h2 class="font-display text-[28px] lg:text-[34px] font-bold text-brand-900">Create your business account</h2>
            <p class="text-sm lg:text-[15px] text-ink-600 mt-2 mb-7">4 aasaan step. Approve hote hi aap login karke kaam shuru kar sakte ho.</p>

            <ol class="grid grid-cols-4 gap-2 mb-8">
              @for (l of stepLabels; track $index) {
                <li class="flex flex-col gap-2.5" [attr.aria-current]="$index === step() ? 'step' : null">
                  <span class="h-1 rounded-full" [ngClass]="$index < step() ? 'bg-gold-500' : $index === step() ? 'bg-brand-900' : 'bg-ink-100'"></span>
                  <span class="text-[13px]" [ngClass]="$index === step() ? 'font-bold text-ink-950' : $index < step() ? 'font-medium text-ink-950' : 'font-medium text-ink-500'"><span class="text-ink-400 font-medium hidden sm:inline">0{{ $index + 1 }} </span>{{ l }}</span>
                </li>
              }
            </ol>

            <div class="flex-1">
              @switch (step()) {
                @case (0) {
                  <div class="step-in grid sm:grid-cols-2 gap-5">
                    <div><label class="label" for="s-name">Full name</label><input id="s-name" class="input !h-12 !rounded-xl" name="owner_name" [(ngModel)]="f.owner_name" maxlength="120" autocomplete="name" placeholder="Enter Name" /></div>
                    <div><label class="label" for="s-phone">Mobile number</label><input id="s-phone" class="input !h-12 !rounded-xl" name="phone" [(ngModel)]="f.phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile" /></div>
                    <div class="sm:col-span-2"><label class="label" for="s-email">Email</label><input id="s-email" type="email" class="input !h-12 !rounded-xl" name="email" [(ngModel)]="f.email" autocomplete="email" placeholder="you@business.com" /><p class="hint">Isi email se login karoge.</p></div>
                    <div class="sm:col-span-2"><label class="label" for="s-addr">Address</label><textarea id="s-addr" class="input !rounded-xl resize-none" rows="3" name="address" [(ngModel)]="f.address" maxlength="500" placeholder="Shop / office address"></textarea></div>
                  </div>
                }
                @case (1) {
                  <div class="step-in grid sm:grid-cols-2 gap-5">
                    <div><label class="label" for="s-company">Company name</label><input id="s-company" class="input !h-12 !rounded-xl" name="company_name" [(ngModel)]="f.company_name" maxlength="150" autocomplete="organization" placeholder="Sharma Events Pvt. Ltd." /></div>
                    <div><label class="label" for="s-type">Business type</label>
                      <select id="s-type" class="input !h-12 !rounded-xl" name="business_type" [(ngModel)]="f.business_type">
                        <option value="">Select...</option>
                        @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
                      </select></div>
                    <div class="sm:col-span-2"><label class="label" for="s-profile">Profile name</label>
                      <input id="s-profile" class="input !h-12 !rounded-xl" name="profile_name" [(ngModel)]="f.profile_name" maxlength="80" (input)="checkSlug()" placeholder="e.g. Sharma Events" />
                      <p class="hint">Yahi naam aapke booking link mein aayega.</p></div>
                    <div class="sm:col-span-2">
                      <span class="label">Company logo</span>
                      <label class="flex items-center gap-4 rounded-2xl border-2 p-3 cursor-pointer"
                        [ngClass]="logo() ? 'border-emerald-300 bg-emerald-50' : 'border-dashed border-ink-200 bg-ink-50 hover:border-brand-300'">
                        <span class="w-16 h-16 rounded-xl bg-white border border-ink-100 grid place-items-center overflow-hidden shrink-0">
                          @if (logo(); as l) { <img [src]="l.data" alt="Your logo" class="w-full h-full object-contain p-1" /> }
                          @else { <span class="text-brand-500"><app-icon name="upload" [size]="24" /></span> }
                        </span>
                        <span class="text-sm min-w-0">
                          <b class="block" [ngClass]="logo() ? 'text-emerald-800' : 'text-ink-800'">{{ logo() ? 'Logo added · Change' : 'Upload your logo' }}</b>
                          <span class="block truncate" [ngClass]="logo() ? 'text-emerald-700' : 'text-ink-600'">{{ logo()?.name || 'PNG ya JPG. Aapke clients booking page par yahi logo dekhenge.' }}</span>
                        </span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="pickLogo($event)" />
                      </label>
                    </div>
                    @if (slug()) {
                      <div class="sm:col-span-2 flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm"
                        [ngClass]="slugOk() === false ? 'bg-red-50 border-red-200 text-red-800' : slugOk() ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-ink-50 border-ink-200 text-ink-700'">
                        <app-icon name="copy" [size]="18" />
                        <span class="min-w-0">Aapka booking page: <b class="break-all">{{ origin }}/book/{{ slug() }}</b>
                          @if (slugOk() === false) { – yeh naam le liya gaya hai, doosra naam chuno } @else if (slugOk()) { – available } @else { – check ho raha hai... }</span>
                      </div>
                    }
                  </div>
                }
                @case (2) {
                  <div class="step-in grid sm:grid-cols-2 gap-5">
                    <div><label class="label" for="s-aadhaar">Aadhaar number</label><input id="s-aadhaar" class="input !h-12 !rounded-xl tracking-wider" name="aadhaar_no" [(ngModel)]="f.aadhaar_no" inputmode="numeric" maxlength="14" placeholder="1234 5678 9012" autocomplete="off" /></div>
                    <div><label class="label" for="s-pan">PAN number</label><input id="s-pan" class="input !h-12 !rounded-xl uppercase tracking-wider" name="pan_no" [(ngModel)]="f.pan_no" maxlength="10" placeholder="ABCDE1234F" autocomplete="off" /></div>
                    @for (k of cards; track k.key) {
                      <label class="relative flex flex-col items-center justify-center gap-2 h-[150px] rounded-2xl cursor-pointer text-center px-3 overflow-hidden"
                        [ngClass]="card(k.key) ? 'border-2 border-emerald-300 bg-emerald-50' : 'border-2 border-dashed border-ink-200 bg-ink-50 hover:border-brand-300'">
                        @if (card(k.key); as c) {
                          <img [src]="c.data" alt="" class="w-16 h-11 rounded-md object-cover ring-2 ring-white" />
                          <span class="text-sm font-semibold text-emerald-800">{{ k.label }} photo added</span>
                          <span class="text-xs text-emerald-700 truncate max-w-full">{{ c.name }} · Change</span>
                        } @else {
                          <span class="text-brand-500"><app-icon name="upload" [size]="28" /></span>
                          <span class="text-sm font-semibold text-ink-800">{{ k.label }} photo</span>
                          <span class="text-xs text-ink-600">JPG or PNG, saaf aur padhne layak</span>
                        }
                        <input type="file" accept="image/*" class="sr-only" (change)="pick(k.key, $event)" />
                      </label>
                    }
                    <p class="sm:col-span-2 text-[13px] text-ink-600 flex gap-2 items-center"><app-icon name="lock" [size]="14" />Documents encrypted rehte hain. Sirf administrator verify karne ke liye dekh sakta hai.</p>
                  </div>
                }
                @default {
                  <div class="step-in grid sm:grid-cols-2 gap-5">
                    <div><label class="label" for="s-pw">Password</label><input id="s-pw" type="password" class="input !h-12 !rounded-xl" name="password" [(ngModel)]="f.password" autocomplete="new-password" /><p class="hint">Kam se kam 8 characters.</p></div>
                    <div><label class="label" for="s-pw2">Confirm password</label><input id="s-pw2" type="password" class="input !h-12 !rounded-xl" name="confirm" [(ngModel)]="confirm" autocomplete="new-password" /></div>
                    <div class="sm:col-span-2 p-4 rounded-xl bg-gold-50 border border-gold-200 text-sm text-gold-700 leading-relaxed">Account banane ke baad hum aapki details check karenge. Approve hote hi aapko email aayega, phir aap login kar sakte ho.</div>
                  </div>
                }
              }
            </div>

            @if (error()) { <div class="mt-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex gap-2" role="alert"><app-icon name="alert" [size]="16" />{{ error() }}</div> }

            <div class="flex items-center gap-3 pt-6 mt-6 border-t border-ink-100">
              @if (step() > 0) {
                <button type="button" class="btn btn-secondary !h-12 !px-5 !rounded-xl" (click)="back()" [disabled]="sending()">Back</button>
              }
              <span class="flex-1"></span>
              <button class="btn btn-primary !h-[52px] !px-7 !rounded-xl !text-base gap-2.5" [disabled]="sending()">
                {{ sending() ? 'Sending...' : step() === 3 ? 'Create account' : 'Next' }}
                @if (!sending()) { <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF761E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg> }
              </button>
            </div>
          </form>
        }
      </section>
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
  logo = signal<Card | null>(null);
  slug = signal('');
  slugOk = signal<boolean | null>(null);
  sending = signal(false);
  error = signal('');
  done = signal<string | null>(null);
  step = signal(0);
  stepLabels = ['Your details', 'Business', 'KYC', 'Password'];
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

  async pickLogo(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const img = await resizeLogo(file);
      this.logo.set({ data: img.data_base64, mime: img.mime_type, name: file.name });
      this.error.set('');
    } catch {
      this.error.set('That file could not be read as a logo. Please choose a PNG or JPG image.');
    }
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

  /** What is still missing on one step, or '' when the step is complete. */
  private problem(step: number): string {
    const f = this.f;
    const need: [string, string][][] = [
      [[f.owner_name, 'your name'], [f.phone, 'mobile number'], [f.email, 'email'], [f.address, 'address']],
      [[f.company_name, 'company name'], [f.business_type, 'business type'], [f.profile_name, 'profile name'], [this.logo() ? 'ok' : '', 'your company logo (upload a photo)']],
      [[f.aadhaar_no, 'Aadhaar number'], [f.pan_no, 'PAN number']],
      [],
    ];
    const missing = need[step].find(([v]) => !String(v).trim());
    if (missing) return `Please enter ${missing[1]}.`;
    if (step === 0 && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Please enter a valid email address.';
    if (step === 1 && this.slugOk() === false) return 'This profile name is already taken. Please choose another name.';
    if (step === 2) {
      if (!/^\d{12}$/.test(f.aadhaar_no.replace(/[\s-]/g, ''))) return 'Aadhaar number must have 12 digits.';
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan_no.trim().toUpperCase())) return 'PAN must look like ABCDE1234F.';
      const p = this.photos();
      if (!p.aadhaar || !p.pan) return 'Please upload photos of both your Aadhaar card and PAN card.';
    }
    if (step === 3) {
      if (this.f.password.length < 8) return 'Password must be at least 8 characters.';
      if (this.f.password !== this.confirm) return 'The two passwords do not match.';
    }
    return '';
  }

  next(): void {
    const msg = this.problem(this.step());
    this.error.set(msg);
    if (msg) return;
    if (this.step() < 3) { this.step.update((s) => s + 1); window.scrollTo({ top: 0 }); return; }
    void this.submit();
  }

  back(): void {
    this.error.set('');
    this.step.update((s) => Math.max(0, s - 1));
  }

  private async submit(): Promise<void> {
    const f = this.f;
    const p = this.photos();
    if (!p.aadhaar || !p.pan) { this.step.set(2); return; }
    this.sending.set(true);
    try {
      const r = await this.api.post<{ slug: string }>('/public/signup', {
        ...f, pan_no: f.pan_no.trim().toUpperCase(),
        aadhaar_photo: p.aadhaar.data, aadhaar_photo_mime: p.aadhaar.mime, pan_photo: p.pan.data, pan_photo_mime: p.pan.mime,
        logo: this.logo()?.data, logo_mime: this.logo()?.mime,
      });
      this.done.set(r.slug);
      window.scrollTo({ top: 0 });
    } catch (e) {
      const fields = ApiService.fieldErrors(e);
      const first = Object.keys(fields)[0];
      const stepOf: Record<string, number> = { owner_name: 0, phone: 0, email: 0, address: 0, company_name: 1, business_type: 1, profile_name: 1, aadhaar_no: 2, pan_no: 2, aadhaar_photo: 2, pan_photo: 2, logo: 1 };
      if (first && first in stepOf) this.step.set(stepOf[first]);
      this.error.set((first && fields[first]) || ApiService.message(e));
    } finally {
      this.sending.set(false);
    }
  }
}
