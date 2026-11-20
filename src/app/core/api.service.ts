import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Query = Record<string, string | number | boolean | null | undefined>;

/** Thin promise-based wrapper around HttpClient for the /api backend. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly base = '/api';

  private params(q?: Query): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q || {})) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return p;
  }

  get<T>(url: string, q?: Query): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + url, { params: this.params(q) }));
  }
  post<T>(url: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.base + url, body));
  }
  put<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(this.base + url, body));
  }
  patch<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(this.base + url, body));
  }
  delete<T = void>(url: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.base + url));
  }

  /** Human readable message from any error thrown by the methods above. */
  static message(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0 || ((err.status === 500 || err.status === 502 || err.status === 504) && !err.error?.message))
        return 'Cannot reach the API server. Start it with "npm start" in the server folder (port 3000).';
      return err.error?.message || `Request failed (${err.status})`;
    }
    return (err as Error)?.message || 'Something went wrong';
  }

  /** Field-level validation errors returned by the API (400). */
  static fieldErrors(err: unknown): Record<string, string> {
    return err instanceof HttpErrorResponse && err.error?.errors ? err.error.errors : {};
  }
}
