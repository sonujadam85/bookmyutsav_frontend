import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { ToastService } from '../../../core/toast.service';
import { ChecklistItem, Decor } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';

const DECOR_CATEGORIES = ['Decoration', 'Themes', 'Stage', 'Entry', 'Rituals'];

@Component({
  selector: 'app-decor-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid lg:grid-cols-3 gap-6">
      <form class="card card-pad lg:col-span-2" (ngSubmit)="save()">
        <h2 class="card-title mb-1">Decoration Plan</h2>
        <p class="text-sm text-ink-500 mb-5">Theme, colours and design notes for the decorators.</p>
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">Theme</label><input class="input" name="theme" [(ngModel)]="d.theme" placeholder="Royal Rajasthani, Pastel floral..." /></div>
          <div><label class="label">Colour Scheme</label><input class="input" name="color_scheme" [(ngModel)]="d.color_scheme" placeholder="Ivory, gold, blush pink" /></div>
          <div class="sm:col-span-2"><label class="label">Flowers</label><textarea class="input" rows="2" name="flowers" [(ngModel)]="d.flowers" placeholder="Marigold strings, roses, orchids..."></textarea></div>
          <div class="sm:col-span-2"><label class="label">Lighting</label><textarea class="input" rows="2" name="lighting" [(ngModel)]="d.lighting" placeholder="Fairy lights, chandeliers, par lights..."></textarea></div>
          <div class="sm:col-span-2"><label class="label">Stage / Backdrop</label><textarea class="input" rows="2" name="backdrop" [(ngModel)]="d.backdrop"></textarea></div>
          <div class="sm:col-span-2"><label class="label">Other Notes</label><textarea class="input" rows="4" name="notes" [(ngModel)]="d.notes"></textarea></div>
        </div>
        <div class="flex justify-end mt-5">
          <button class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save Decoration Plan' }}</button>
        </div>
      </form>

      <section class="card card-pad">
        <h2 class="card-title mb-3">Decoration Items</h2>
        <p class="text-xs text-ink-500 mb-3">From the setup checklist. Change inclusion in the Setup Checklist tab.</p>
        <ul class="space-y-2">
          @for (i of decorItems(); track i.id) {
            <li class="flex items-center justify-between gap-2 text-sm">
              <span [class.line-through]="i.included === 0" [class.text-ink-400]="i.included === 0">{{ i.name }}</span>
              @if (i.included === 1) { <span class="badge bg-emerald-50 text-emerald-700">{{ i.done ? 'Done' : 'Included' }}</span> }
              @else if (i.included === 0) { <span class="badge bg-ink-100 text-ink-500">Not included</span> }
              @else { <span class="badge bg-gold-50 text-gold-700">To confirm</span> }
            </li>
          } @empty { <li class="text-sm text-ink-400">No decoration items.</li> }
        </ul>
      </section>
    </div>
  `,
})
export class DecorTabComponent {
  eventId = input.required<number>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  d: Partial<Decor> = {};
  items = signal<ChecklistItem[]>([]);
  saving = signal(false);
  decorItems = computed(() => this.items().filter((i) => DECOR_CATEGORIES.includes(i.category || '')));

  constructor() {
    effect(() => {
      const id = this.eventId();
      if (id) this.load(id);
    });
  }

  async load(id: number): Promise<void> {
    try {
      const [d, items] = await Promise.all([this.api.get<Decor>(`/events/${id}/decor`), this.api.get<ChecklistItem[]>(`/events/${id}/checklist`)]);
      this.d = d;
      this.items.set(items);
    } catch (e) {
      this.toast.fail(e);
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const { theme, color_scheme, flowers, lighting, backdrop, notes } = this.d;
      this.d = await this.api.put<Decor>(`/events/${this.eventId()}/decor`, { theme, color_scheme, flowers, lighting, backdrop, notes });
      this.toast.success('Decoration plan saved');
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
}
