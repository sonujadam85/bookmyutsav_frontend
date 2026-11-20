import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

/** Usage: <app-modal [open]="show()" title="..." (closed)="show.set(false)"> body <div footer>buttons</div> </app-modal> */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" (click)="closed.emit()"></div>
        <div class="relative w-full bg-white rounded-t-3xl sm:rounded-2xl shadow-lift max-h-[92vh] flex flex-col" [class]="widthClass[size()]">
          <div class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-ink-100">
            <div>
              <h2 class="text-lg font-semibold">{{ title() }}</h2>
              @if (subtitle()) { <p class="text-xs text-ink-500 mt-0.5">{{ subtitle() }}</p> }
            </div>
            <button type="button" class="btn-icon" (click)="closed.emit()" aria-label="Close"><app-icon name="x" /></button>
          </div>
          <div class="px-5 sm:px-6 py-5 overflow-y-auto"><ng-content /></div>
          <div class="px-5 sm:px-6 py-4 border-t border-ink-100 flex flex-wrap justify-end gap-2 bg-ink-50/60 rounded-b-2xl">
            <ng-content select="[footer]" />
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  open = input<boolean>(false);
  title = input<string>('');
  subtitle = input<string>('');
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  closed = output<void>();
  readonly widthClass: Record<string, string> = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) this.closed.emit();
  }
}
