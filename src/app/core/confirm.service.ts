import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface Pending extends ConfirmOptions { resolve: (v: boolean) => void; }

/** Promise-based confirmation modal: `if (await confirm.ask({...})) { ... }` */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<Pending | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.current.set({ ...opts, resolve }));
  }

  delete(what: string, extra?: string): Promise<boolean> {
    return this.ask({
      title: `Delete ${what}?`,
      message: extra || 'This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
  }

  close(result: boolean): void {
    const c = this.current();
    this.current.set(null);
    c?.resolve(result);
  }
}
