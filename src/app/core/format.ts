import { Pipe, PipeTransform } from '@angular/core';

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function inr(v: number | null | undefined): string {
  return inrFmt.format(Number(v || 0));
}

export function num(v: number | null | undefined): string {
  return numFmt.format(Number(v || 0));
}

/** Parse YYYY-MM-DD as a local date (avoids timezone shifts). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function fmtDate(s: string | null | undefined, withDay = false): string {
  if (!s) return '—';
  const d = parseDate(s);
  const base = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withDay ? `${d.toLocaleDateString('en-IN', { weekday: 'short' })}, ${base}` : base;
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

const LABELS: Record<string, string> = {
  UPCOMING: 'Upcoming', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque',
  ADVANCE: 'Advance', SECOND: 'Second Installment', THIRD: 'Third Installment', FINAL: 'Final Payment', OTHER: 'Other',
  PAID: 'Paid', PARTIAL: 'Partially Paid', UNPAID: 'Unpaid',
  PURCHASE: 'Purchase', RENTAL: 'Rental', PURCHASED: 'Purchased',
  AVAILABLE: 'Available', NOT_AVAILABLE: 'Not Available', ORDERED: 'Ordered',
  ADMIN: 'Admin', STAFF: 'Staff',
};
export function label(v: string | null | undefined): string {
  return v ? LABELS[v] ?? v : '—';
}

const BADGES: Record<string, string> = {
  UPCOMING: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-amber-50 text-amber-700', COMPLETED: 'bg-emerald-50 text-emerald-700', CANCELLED: 'bg-ink-100 text-ink-500 line-through',
  PAID: 'bg-emerald-50 text-emerald-700', PARTIAL: 'bg-amber-50 text-amber-700', UNPAID: 'bg-red-50 text-red-700',
  AVAILABLE: 'bg-emerald-50 text-emerald-700', NOT_AVAILABLE: 'bg-red-50 text-red-700', ORDERED: 'bg-blue-50 text-blue-700',
  ADMIN: 'bg-brand-50 text-brand-800', STAFF: 'bg-ink-100 text-ink-700',
};
export function badgeClass(v: string | null | undefined): string {
  return v ? BADGES[v] ?? 'bg-ink-100 text-ink-700' : 'bg-ink-100 text-ink-700';
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(v: number | null | undefined): string { return inr(v); }
}

@Pipe({ name: 'num', standalone: true })
export class NumPipe implements PipeTransform {
  transform(v: number | null | undefined): string { return num(v); }
}

@Pipe({ name: 'dmy', standalone: true })
export class DatePipeLocal implements PipeTransform {
  transform(v: string | null | undefined, withDay = false): string { return fmtDate(v, withDay); }
}

@Pipe({ name: 'time12', standalone: true })
export class TimePipe implements PipeTransform {
  transform(v: string | null | undefined): string { return fmtTime(v); }
}

@Pipe({ name: 'label', standalone: true })
export class LabelPipe implements PipeTransform {
  transform(v: string | null | undefined): string { return label(v); }
}

@Pipe({ name: 'badge', standalone: true })
export class BadgePipe implements PipeTransform {
  transform(v: string | null | undefined): string { return badgeClass(v); }
}

export const FORMAT_PIPES = [InrPipe, NumPipe, DatePipeLocal, TimePipe, LabelPipe, BadgePipe] as const;
