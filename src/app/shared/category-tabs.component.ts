import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface CategoryTab { name: string; count: number; selected?: number; }

/** Tabs for service headings (Decoration & Setup, Photography, DJ & Sound...). Shows how many are selected in each. */
@Component({
  selector: 'app-category-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
      @for (t of tabs(); track t.name) {
        <button type="button" role="tab" [attr.aria-selected]="active() === t.name" (click)="active.set(t.name)"
                class="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition"
                [class]="active() === t.name ? 'bg-brand-800 text-white border-brand-800 shadow-sm' : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'">
          {{ t.name }}
          <span class="rounded-full px-2 py-0.5 text-[11px] font-bold"
                [class]="t.selected ? (active() === t.name ? 'bg-gold-400 text-brand-950' : 'bg-brand-700 text-white') : (active() === t.name ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-500')">
            {{ t.selected ? t.selected + ' selected' : t.count }}
          </span>
        </button>
      }
    </div>
  `,
})
export class CategoryTabsComponent {
  tabs = input<CategoryTab[]>([]);
  active = model<string>('');
}
