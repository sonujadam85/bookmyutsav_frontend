import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../core/confirm.service';
import { IconComponent } from './icon.component';

/** Global toast notifications + confirmation dialog. Rendered once in AppComponent. */
@Component({
  selector: 'app-overlays',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed z-[70] top-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none no-print" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lift border text-sm bg-white"
             [class.border-emerald-200]="t.type === 'success'" [class.border-red-200]="t.type === 'error'" [class.border-blue-200]="t.type === 'info'">
          <span class="mt-0.5 rounded-full p-1"
                [class.bg-emerald-100]="t.type === 'success'" [class.text-emerald-700]="t.type === 'success'"
                [class.bg-red-100]="t.type === 'error'" [class.text-red-700]="t.type === 'error'"
                [class.bg-blue-100]="t.type === 'info'" [class.text-blue-700]="t.type === 'info'">
            <app-icon [name]="t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'sparkle'" [size]="14" [stroke]="2.4" />
          </span>
          <p class="flex-1 text-ink-800">{{ t.message }}</p>
          <button class="text-ink-400 hover:text-ink-700" (click)="toast.dismiss(t.id)" aria-label="Dismiss"><app-icon name="x" [size]="16" /></button>
        </div>
      }
    </div>

    @if (confirm.current(); as c) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
        <div class="absolute inset-0 bg-ink-950/50" (click)="confirm.close(false)"></div>
        <div class="relative w-full max-w-md bg-white rounded-2xl shadow-lift p-6">
          <div class="flex gap-4">
            <div class="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                 [class.bg-red-50]="c.danger" [class.text-red-600]="c.danger" [class.bg-gold-50]="!c.danger" [class.text-gold-600]="!c.danger">
              <app-icon name="alert" [size]="22" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold">{{ c.title }}</h3>
              <p class="text-sm text-ink-600 mt-1">{{ c.message }}</p>
              @if (c.details?.length) {
                <ul class="mt-3 space-y-1 text-sm text-ink-700 bg-ink-50 rounded-xl p-3 max-h-48 overflow-auto">
                  @for (d of c.details; track $index) { <li>• {{ d }}</li> }
                </ul>
              }
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <button class="btn btn-secondary" (click)="confirm.close(false)">{{ c.cancelText || 'Cancel' }}</button>
            <button class="btn" [class.btn-danger]="c.danger" [class.btn-primary]="!c.danger" (click)="confirm.close(true)">{{ c.confirmText || 'Confirm' }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class OverlaysComponent {
  toast = inject(ToastService);
  confirm = inject(ConfirmService);
}
