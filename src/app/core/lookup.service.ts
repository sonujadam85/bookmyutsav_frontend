import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Lookups } from './models';

/** Cached dropdown data (event types, vendors, categories, units). Call reload() after changing any of them. */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private api = inject(ApiService);
  readonly data = signal<Lookups>({
    event_types: [], vendors: [], expense_categories: [], units: [], checklist_categories: [], material_categories: [], payment_modes: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'],
  });
  private loaded: Promise<void> | null = null;

  load(): Promise<void> {
    if (!this.loaded) this.loaded = this.reload();
    return this.loaded;
  }

  async reload(): Promise<void> {
    try {
      this.data.set(await this.api.get<Lookups>('/lookups'));
    } catch {
      this.loaded = null;
    }
  }
}
