import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { LookupService } from '../../core/lookup.service';
import { ToastService } from '../../core/toast.service';
import { ReportColumn, ReportData } from '../../core/models';
import { FORMAT_PIPES, fmtDate, inr, isoDate, label, num, parseDate, today } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';

type Kind = 'daily' | 'weekly' | 'monthly' | 'client-payments' | 'pending-payments' | 'expenses' | 'vendor-payments' | 'profit-loss';

const REPORTS: { key: Kind; label: string; api: string; icon: string }[] = [
  { key: 'daily', label: 'Daily Events', api: 'events', icon: 'calendar' },
  { key: 'weekly', label: 'Weekly Events', api: 'events', icon: 'calendar' },
  { key: 'monthly', label: 'Monthly Events', api: 'events', icon: 'calendar' },
  { key: 'client-payments', label: 'Client Payments', api: 'client-payments', icon: 'wallet' },
  { key: 'pending-payments', label: 'Pending Payments', api: 'pending-payments', icon: 'alert' },
  { key: 'expenses', label: 'Expenses', api: 'expenses', icon: 'receipt' },
  { key: 'vendor-payments', label: 'Vendor Payments', api: 'vendor-payments', icon: 'vendor' },
  { key: 'profit-loss', label: 'Profit & Loss', api: 'profit-loss', icon: 'trending' },
];

function monthStart(d = new Date()): string { return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); }
function monthEnd(d = new Date()): string { return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, IconComponent, ...FORMAT_PIPES],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 class="page-title">Reports</h1><p class="page-sub">Filter, review and export to Excel or PDF.</p></div>
      <div class="flex gap-2">
        <button class="btn btn-secondary" (click)="exportExcel()" [disabled]="!data()?.rows?.length"><app-icon name="download" [size]="16" />Excel</button>
        <button class="btn btn-primary" (click)="exportPdf()" [disabled]="!data()?.rows?.length"><app-icon name="download" [size]="16" />PDF</button>
      </div>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
      @for (r of reports; track r.key) {
        <button class="tab inline-flex items-center gap-1.5 border border-ink-200 bg-white" [class.tab-active]="kind() === r.key" (click)="kind.set(r.key)">
          <app-icon [name]="r.icon" [size]="15" />{{ r.label }}
        </button>
      }
    </div>

    <div class="card card-pad mb-6">
      <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        @switch (kind()) {
          @case ('daily') { <div><label class="label">Date</label><input type="date" class="input" [ngModel]="day()" (ngModelChange)="day.set($event)" /></div> }
          @case ('weekly') { <div><label class="label">Any date in the week</label><input type="date" class="input" [ngModel]="day()" (ngModelChange)="day.set($event)" /></div> }
          @case ('monthly') { <div><label class="label">Month</label><input type="month" class="input" [ngModel]="month()" (ngModelChange)="month.set($event)" /></div> }
          @default {
            <div><label class="label">From</label><input type="date" class="input" [ngModel]="from()" (ngModelChange)="from.set($event)" /></div>
            <div><label class="label">To</label><input type="date" class="input" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
          }
        }
        @if (isEventReport()) {
          <div>
            <label class="label">Status</label>
            <select class="input" [ngModel]="status()" (ngModelChange)="status.set($event)">
              <option value="">All</option><option value="UPCOMING">Upcoming</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="label">Event Type</label>
            <select class="input" [ngModel]="typeId()" (ngModelChange)="typeId.set($event)">
              <option value="">All</option>
              @for (t of lookups.data().event_types; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
            </select>
          </div>
        }
        @if (kind() === 'expenses') {
          <div>
            <label class="label">Category</label>
            <select class="input" [ngModel]="category()" (ngModelChange)="category.set($event)">
              <option value="">All</option>
              @for (c of lookups.data().expense_categories; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </div>
          <div>
            <label class="label">Vendor</label>
            <select class="input" [ngModel]="vendorId()" (ngModelChange)="vendorId.set($event)">
              <option value="">All</option>
              @for (v of lookups.data().vendors; track v.id) { <option [value]="v.id">{{ v.name }}</option> }
            </select>
          </div>
        }
        @if (kind() === 'client-payments') {
          <div>
            <label class="label">Mode</label>
            <select class="input" [ngModel]="mode()" (ngModelChange)="mode.set($event)">
              <option value="">All</option><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option>
            </select>
          </div>
        }
        <p class="text-sm text-ink-500 lg:col-span-1">{{ rangeLabel() }}</p>
      </div>
    </div>

    @if (data(); as d) {
      <div class="card p-2 mb-6">
        <div class="px-4 pt-3 pb-2 flex justify-between items-center"><h2 class="card-title">{{ d.title }}</h2><span class="text-sm text-ink-500">{{ d.rows.length }} rows</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>@for (c of d.columns; track c.key) { <th [class]="isNum(c) ? '!text-right' : ''">{{ c.label }}</th> }</tr></thead>
            <tbody>
              @for (row of d.rows; track $index) {
                <tr>@for (c of d.columns; track c.key) { <td [class]="isNum(c) ? 'text-right money' : ''">{{ cell(row, c) }}</td> }</tr>
              } @empty { <tr><td [attr.colspan]="d.columns.length" class="text-center text-ink-400 py-8">No data for these filters</td></tr> }
            </tbody>
            @if (d.rows.length) {
              <tfoot><tr>@for (c of d.columns; track c.key; let i = $index) { <td [class]="isNum(c) ? 'text-right money' : ''">{{ i === 0 ? 'Total' : footer(d, c) }}</td> }</tr></tfoot>
            }
          </table>
        </div>
      </div>
      @if (d.secondary; as s) {
        <div class="card p-2">
          <div class="px-4 pt-3 pb-2"><h2 class="card-title">{{ s.title }}</h2></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr>@for (c of s.columns; track c.key) { <th [class]="isNum(c) ? '!text-right' : ''">{{ c.label }}</th> }</tr></thead>
              <tbody>
                @for (row of s.rows; track $index) { <tr>@for (c of s.columns; track c.key) { <td [class]="isNum(c) ? 'text-right money' : ''">{{ cell(row, c) }}</td> }</tr> }
                @empty { <tr><td [attr.colspan]="s.columns.length" class="text-center text-ink-400 py-6">No vendor payments in this period</td></tr> }
              </tbody>
            </table>
          </div>
        </div>
      }
    } @else { <div class="card card-pad text-ink-400">Loading report...</div> }
  `,
})
export class ReportsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  lookups = inject(LookupService);
  reports = REPORTS;

  kind = signal<Kind>('monthly');
  day = signal(today());
  month = signal(today().slice(0, 7));
  from = signal(monthStart());
  to = signal(monthEnd());
  status = signal('');
  typeId = signal('');
  category = signal('');
  vendorId = signal('');
  mode = signal('');
  data = signal<ReportData | null>(null);

  isEventReport = computed(() => ['daily', 'weekly', 'monthly'].includes(this.kind()));

  range = computed(() => {
    switch (this.kind()) {
      case 'daily':
        return { from: this.day(), to: this.day() };
      case 'weekly': {
        const d = parseDate(this.day() || today());
        const offset = (d.getDay() + 6) % 7; // Monday start
        const s = new Date(d); s.setDate(d.getDate() - offset);
        const e = new Date(s); e.setDate(s.getDate() + 6);
        return { from: isoDate(s), to: isoDate(e) };
      }
      case 'monthly': {
        const m = this.month() || today().slice(0, 7);
        const d = parseDate(`${m}-01`);
        return { from: monthStart(d), to: monthEnd(d) };
      }
      default:
        return { from: this.from(), to: this.to() };
    }
  });

  rangeLabel = computed(() => {
    const r = this.range();
    return r.from === r.to ? fmtDate(r.from, true) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
  });

  constructor() {
    this.lookups.load();
    effect(() => {
      const kind = this.kind();
      const api = REPORTS.find((r) => r.key === kind)!.api;
      const r = this.range();
      const q = { from: r.from, to: r.to, status: this.isEventReport() ? this.status() : '', typeId: this.isEventReport() ? this.typeId() : '',
        category: kind === 'expenses' ? this.category() : '', vendorId: kind === 'expenses' ? this.vendorId() : '', mode: kind === 'client-payments' ? this.mode() : '' };
      this.data.set(null);
      this.api.get<ReportData>(`/reports/${api}`, q).then((d) => this.data.set(d)).catch((e) => this.toast.fail(e));
    });
  }

  isNum(c: ReportColumn): boolean {
    return c.type === 'money' || c.type === 'number' || c.type === 'percent';
  }

  cell(row: Record<string, any>, c: ReportColumn, plain = false): string {
    const v = row[c.key];
    if (v === null || v === undefined || v === '') return c.type === 'money' ? (plain ? '0' : inr(0)) : '';
    switch (c.type) {
      case 'money': return plain ? num(v) : inr(v);
      case 'number': return num(v);
      case 'percent': return `${num(v)}%`;
      case 'date': return fmtDate(v);
      case 'status': return label(v);
      default: return String(v);
    }
  }

  footer(d: Omit<ReportData, 'secondary'>, c: ReportColumn, plain = false): string {
    return c.key in d.totals ? this.cell(d.totals, c, plain) : '';
  }

  private fileName(): string {
    const r = this.range();
    return `${REPORTS.find((x) => x.key === this.kind())!.label.replace(/\W+/g, '-')}_${r.from}_${r.to}`;
  }

  async exportExcel(): Promise<void> {
    const d = this.data();
    if (!d) return;
    try {
      const XLSX = await import('xlsx');
      const sheet = (t: Omit<ReportData, 'secondary'>) => {
        const header = t.columns.map((c) => c.label);
        const body = t.rows.map((row) => t.columns.map((c) => (this.isNum(c) ? Number(row[c.key] || 0) : this.cell(row, c))));
        const foot = t.columns.map((c, i) => (i === 0 ? 'Total' : c.key in t.totals ? Number(t.totals[c.key]) : ''));
        const ws = XLSX.utils.aoa_to_sheet([[t.title], [this.rangeLabel()], [], header, ...body, foot]);
        ws['!cols'] = t.columns.map((c) => ({ wch: Math.max(12, c.label.length + 4) }));
        return ws;
      };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet(d), 'Report');
      if (d.secondary) XLSX.utils.book_append_sheet(wb, sheet(d.secondary), 'Payments');
      XLSX.writeFile(wb, `${this.fileName()}.xlsx`);
    } catch (e) {
      this.toast.error('Excel export failed: ' + (e as Error).message);
    }
  }

  async exportPdf(): Promise<void> {
    const d = this.data();
    if (!d) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: d.columns.length > 7 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const settings = await this.api.get<{ business_name: string }>('/settings').catch(() => ({ business_name: 'Event Pro' }));
      const money = (s: string) => s.replace(/₹/g, 'Rs. '); // default PDF fonts have no rupee glyph
      const table = (t: Omit<ReportData, 'secondary'>, startY: number) => {
        autoTable(doc, {
          startY,
          head: [t.columns.map((c) => c.label)],
          body: t.rows.map((row) => t.columns.map((c) => money(this.cell(row, c)))),
          foot: t.rows.length ? [t.columns.map((c, i) => (i === 0 ? 'Total' : money(this.footer(t, c))))] : undefined,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [90, 34, 63], textColor: 255 },
          footStyles: { fillColor: [246, 231, 240], textColor: [54, 15, 35], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [251, 244, 248] },
          columnStyles: Object.fromEntries(t.columns.map((c, i) => [i, { halign: (this.isNum(c) ? 'right' : 'left') as 'right' | 'left' }])),
        });
      };
      doc.setFontSize(15);
      doc.text(settings.business_name || 'Event Pro', 14, 15);
      doc.setFontSize(11);
      doc.text(`${d.title} · ${this.rangeLabel()}`, 14, 22);
      doc.setFontSize(8);
      doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, 14, 27);
      table(d, 31);
      if (d.secondary) {
        const y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 40) + 10;
        doc.setFontSize(11);
        doc.text(d.secondary.title, 14, y);
        table(d.secondary, y + 4);
      }
      doc.save(`${this.fileName()}.pdf`);
    } catch (e) {
      this.toast.error('PDF export failed: ' + (e as Error).message);
    }
  }
}
