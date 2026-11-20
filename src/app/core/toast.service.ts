import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(type: Toast['type'], message: string, ms = 3500): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, type, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  success(m: string): void { this.show('success', m); }
  info(m: string): void { this.show('info', m); }
  error(m: string): void { this.show('error', m, 5500); }
  /** Show the API error message for a failed request. */
  fail(err: unknown): void { this.error(ApiService.message(err)); }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
