import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { ConfirmService } from '../../../core/confirm.service';
import { ToastService } from '../../../core/toast.service';
import { EventFunction, EventItem, EventStatus } from '../../../core/models';
import { FORMAT_PIPES } from '../../../core/format';
import { IconComponent } from '../../../shared/icon.component';
import { ModalComponent } from '../../../shared/modal.component';

const PRESETS = ['Haldi', 'Mehndi', 'Sangeet', 'Engagement', 'Tilak', 'Barat', 'Wedding / Phere', 'Reception', 'Mayra', 'Cocktail'];

@Component({
  selector: 'app-schedule-tab',
  standalone: true,
  imports: [FormsModule, IconComponent, ModalComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card card-pad">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="card-title">Event Schedule</h2>
          <p class="text-sm text-ink-500">One event can have many functions on different dates. Each appears on the calendar.</p>
        </div>
        <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" />Add Function</button>
      </div>

      <ol class="relative border-l-2 border-brand-100 ml-3 space-y-5">
        <li class="pl-6 relative">
          <span class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-brand-800 ring-4 ring-white"></span>
          <p class="text-xs font-semibold text-brand-700 uppercase tracking-wide">{{ event().event_date | dmy: true }} · Main event</p>
          <p class="font-semibold">{{ event().name }}</p>
          <p class="text-sm text-ink-500">{{ event().start_time | time12 }}@if (event().end_time) { – {{ event().end_time | time12 }} } · {{ event().venue || 'Venue not set' }}</p>
        </li>
        @for (f of sorted(); track f.id) {
          <li class="pl-6 relative group">
            <span class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gold-400 ring-4 ring-white"></span>
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="text-xs font-semibold text-ink-500 uppercase tracking-wide">{{ f.function_date | dmy: true }}</p>
                <p class="font-semibold">{{ f.name }} <span class="badge ml-1" [class]="f.status | badge">{{ f.status | label }}</span></p>
                <p class="text-sm text-ink-500">{{ (f.start_time | time12) || 'Time TBD' }}@if (f.end_time) { – {{ f.end_time | time12 }} } · {{ f.venue || event().venue || 'Venue not set' }}</p>
                @if (f.notes) { <p class="text-sm text-ink-600 mt-1 whitespace-pre-line">{{ f.notes }}</p> }
              </div>
              <div class="flex gap-1">
                <button class="btn-icon" (click)="edit(f)" title="Edit"><app-icon name="edit" [size]="16" /></button>
                <button class="btn-icon hover:!text-red-600" (click)="remove(f)" title="Delete"><app-icon name="trash" [size]="16" /></button>
              </div>
            </div>
          </li>
        }
      </ol>
      @if (!sorted().length) { <p class="text-sm text-ink-400 mt-4 ml-3">No additional functions yet.</p> }
    </div>

    <app-modal [open]="open()" [title]="form.id ? 'Edit Function' : 'Add Function'" (closed)="open.set(false)">
      <form #fnF="ngForm" id="fnForm" (ngSubmit)="save(fnF.valid)" class="grid sm:grid-cols-2 gap-4">
        <div class="sm:col-span-2">
          <label class="label">Function Name *</label>
          <input class="input" name="name" [(ngModel)]="form.name" required list="fnPresets" #nm="ngModel" />
          <datalist id="fnPresets">@for (p of presets; track p) { <option [value]="p"></option> }</datalist>
          @if (nm.invalid && (nm.touched || fnF.submitted)) { <p class="err">Name is required</p> }
        </div>
        <div>
          <label class="label">Date *</label>
          <input type="date" class="input" name="function_date" [(ngModel)]="form.function_date" required #dt="ngModel" />
          @if (dt.invalid && (dt.touched || fnF.submitted)) { <p class="err">Date is required</p> }
        </div>
        <div>
          <label class="label">Status</label>
          <select class="input" name="status" [(ngModel)]="form.status">
            @for (s of statuses; track s) { <option [value]="s">{{ s | label }}</option> }
          </select>
        </div>
        <div><label class="label">Start Time</label><input type="time" class="input" name="start_time" [(ngModel)]="form.start_time" /></div>
        <div><label class="label">End Time</label><input type="time" class="input" name="end_time" [(ngModel)]="form.end_time" /></div>
        @if (form.start_time && form.end_time && form.end_time <= form.start_time) { <p class="err sm:col-span-2 -mt-2">End time must be after start time</p> }
        <div class="sm:col-span-2"><label class="label">Venue (if different)</label><input class="input" name="venue" [(ngModel)]="form.venue" [placeholder]="event().venue || ''" /></div>
        <div class="sm:col-span-2"><label class="label">Notes</label><textarea class="input" rows="3" name="notes" [(ngModel)]="form.notes"></textarea></div>
      </form>
      <div footer>
        <button class="btn btn-secondary" (click)="open.set(false)">Cancel</button>
        <button class="btn btn-primary" type="submit" form="fnForm" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save' }}</button>
      </div>
    </app-modal>
  `,
})
export class ScheduleTabComponent {
  event = input.required<EventItem>();
  changed = output<void>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  presets = PRESETS;
  statuses: EventStatus[] = ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  open = signal(false);
  saving = signal(false);
  form: Partial<EventFunction> = {};
  sorted = computed(() => [...(this.event().functions || [])].sort((a, b) => (a.function_date + (a.start_time || '')).localeCompare(b.function_date + (b.start_time || ''))));

  openNew(): void {
    this.form = { name: '', function_date: this.event().event_date, status: 'UPCOMING', start_time: '', end_time: '', venue: '', notes: '' };
    this.open.set(true);
  }

  edit(f: EventFunction): void {
    this.form = { ...f, start_time: f.start_time || '', end_time: f.end_time || '' };
    this.open.set(true);
  }

  async save(valid: boolean | null): Promise<void> {
    if (!valid) return;
    if (this.form.start_time && this.form.end_time && this.form.end_time <= this.form.start_time) return;
    this.saving.set(true);
    const body = { ...this.form, start_time: this.form.start_time || null, end_time: this.form.end_time || null };
    try {
      if (this.form.id) await this.api.put(`/functions/${this.form.id}`, body);
      else await this.api.post(`/events/${this.event().id}/functions`, body);
      this.toast.success('Function saved');
      this.open.set(false);
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(f: EventFunction): Promise<void> {
    if (!(await this.confirm.delete(`"${f.name}"`))) return;
    try {
      await this.api.delete(`/functions/${f.id}`);
      this.toast.success('Function deleted');
      this.changed.emit();
    } catch (e) {
      this.toast.fail(e);
    }
  }
}
