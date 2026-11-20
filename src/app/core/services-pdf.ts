import { Service } from './models';
import { fmtDate } from './format';
import { groupByCategory } from './service-images';

/** Business details printed at the top (from Settings). */
export interface PdfBusiness { business_name?: string; business_address?: string; business_phone?: string; business_email?: string; gstin?: string; }

export interface PdfLine {
  name: string; category?: string | null; variant_label: string | null;
  unit_price: number; quantity: number; amount?: number; photo_id: number | null;
}

export interface QuotationInput {
  business: PdfBusiness;
  title?: string;                 // "Quotation" by default
  reference?: string;
  /** Leave out for a quick quotation from the price list. */
  event?: { name: string; client_name?: string | null; client_mobile?: string | null; event_date?: string | null; venue?: string | null; guests?: number | null };
  lines: PdfLine[];
  subtotal: number; discount: number; total: number;
  received?: number; balance?: number;
  photoUrl: (id: number) => string;
  fileName: string;
  /** Small line at the bottom of each page. */
  note?: string;
}

interface Img { data: string; w: number; h: number; }
interface CellHook { section: string; column: { index: number }; row: { index: number }; cell: { x: number; y: number; width: number; height: number } }

const BRAND: [number, number, number] = [0, 36, 83];      // BookMyUtsav navy #002453
const LIGHT: [number, number, number] = [255, 236, 222];   // light orange #FFECDE
// The built-in PDF fonts have no ₹ sign, so amounts are written as "Rs. 12,500".
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const rs = (n: number | null | undefined) => `Rs. ${nf.format(Number(n || 0))}`;

/** Load a photo and shrink it to a small JPEG thumbnail for the PDF. Returns null if it cannot be loaded. */
async function thumb(url: string, max = 260): Promise<Img | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const src = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('image'));
        i.src = src;
      });
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return { data: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height };
    } finally {
      URL.revokeObjectURL(src);
    }
  } catch {
    return null;
  }
}

/** Load each distinct photo once. */
async function thumbs(ids: (number | null)[], photoUrl: (id: number) => string): Promise<Map<number, Img>> {
  const unique = [...new Set(ids.filter((x): x is number => !!x))];
  const out = new Map<number, Img>();
  const loaded = await Promise.all(unique.map((id) => thumb(photoUrl(id))));
  unique.forEach((id, i) => { const t = loaded[i]; if (t) out.set(id, t); });
  return out;
}

async function lib() {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  return { jsPDF, autoTable };
}

type Doc = InstanceType<Awaited<ReturnType<typeof lib>>['jsPDF']>;
const lastY = (doc: Doc, fallback: number) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;

/** Business name and contact lines. Returns the y position below it. */
function header(doc: Doc, b: PdfBusiness, title: string, right: string[]): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 4, 'F');
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(b.business_name || 'BookMyUtsav', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 100);
  const contact = [b.business_address, [b.business_phone, b.business_email].filter(Boolean).join('  ·  '), b.gstin ? `GSTIN: ${b.gstin}` : '']
    .filter((x): x is string => !!x);
  let y = 24;
  for (const line of contact) { doc.text(doc.splitTextToSize(line, 110), 14, y); y += 4.5; }
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title.toUpperCase(), W - 14, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 100);
  right.forEach((r, i) => doc.text(r, W - 14, 24 + i * 4.5, { align: 'right' }));
  y = Math.max(y, 24 + right.length * 4.5) + 2;
  doc.setDrawColor(220, 220, 228);
  doc.line(14, y, W - 14, y);
  return y + 6;
}

/** Heading bar for a group. Starts a new page when there is no room left. */
function heading(doc: Doc, text: string, y: number, extra = ''): number {
  const W = doc.internal.pageSize.getWidth();
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 18; }
  doc.setFillColor(...LIGHT);
  doc.roundedRect(14, y, W - 28, 8, 1.5, 1.5, 'F');
  doc.setTextColor(...BRAND);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(text, 17, y + 5.5);
  if (extra) doc.text(extra, W - 17, y + 5.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  return y + 10;
}

function footer(doc: Doc, note: string): void {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 150);
    doc.text(note, 14, H - 8);
    doc.text(`Page ${i} of ${n}`, W - 14, H - 8, { align: 'right' });
  }
}

/** Draw the photo inside column 0 of a table row. */
function photoCell(doc: Doc, imgs: (Img | null)[]) {
  return (d: CellHook) => {
    if (d.section !== 'body' || d.column.index !== 0) return;
    const im = imgs[d.row.index];
    if (!im) return;
    const box = Math.min(d.cell.width, d.cell.height) - 2;
    const r = Math.min(box / im.w, box / im.h);
    const w = im.w * r;
    const h = im.h * r;
    doc.addImage(im.data, 'JPEG', d.cell.x + (d.cell.width - w) / 2, d.cell.y + (d.cell.height - h) / 2, w, h);
  };
}

/** One PDF for an event: every selected service under its heading, with photo, price, quantity and totals. */
export async function quotationPdf(q: QuotationInput): Promise<void> {
  (await buildQuotation(q)).save(`${q.fileName}.pdf`);
}

/** Same PDF as a data: URL (used to send it with an online booking). */
export async function quotationPdfData(q: QuotationInput): Promise<string> {
  return (await buildQuotation(q)).output('datauristring');
}

async function buildQuotation(q: QuotationInput): Promise<Doc> {
  const { jsPDF, autoTable } = await lib();
  const imgs = await thumbs(q.lines.map((l) => l.photo_id), q.photoUrl);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const hasPhotos = imgs.size > 0;

  let y = header(doc, q.business, q.title || 'Quotation', [
    q.reference ? `No. ${q.reference}` : '', `Date: ${fmtDate(new Date().toISOString().slice(0, 10))}`,
  ].filter(Boolean));

  // Event and client details
  const ev = q.event;
  const info: [string, string][] = ev ? [
    ['Event', ev.name], ['Client', ev.client_name || ''], ['Mobile', ev.client_mobile || ''],
    ['Event date', ev.event_date ? fmtDate(ev.event_date, true) : ''], ['Venue', ev.venue || ''],
    ['Guests', ev.guests ? String(ev.guests) : ''],
  ] : [];
  const shown = info.filter(([, v]) => v);
  if (shown.length) autoTable(doc, {
    startY: y, theme: 'plain', margin: { left: 14, right: 14 },
    body: shown.reduce<string[][]>((rows, [k, v], i) => { if (i % 2 === 0) rows.push([k, v]); else rows[rows.length - 1].push(k, v); return rows; }, []),
    styles: { fontSize: 9.5, cellPadding: 1.4, textColor: [40, 40, 50] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 24, textColor: [110, 110, 120] }, 2: { fontStyle: 'bold', cellWidth: 24, textColor: [110, 110, 120] } },
  });
  if (shown.length) y = lastY(doc, y) + 6;

  // One table per heading
  let n = 0;
  for (const g of groupByCategory(q.lines)) {
    const sub = g.items.reduce((a, l) => a + (l.amount ?? l.unit_price * l.quantity), 0);
    y = heading(doc, g.name, y, rs(sub));
    const rowImgs = g.items.map((l) => (l.photo_id ? imgs.get(l.photo_id) ?? null : null));
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [[...(hasPhotos ? ['Photo'] : []), '#', 'Service', 'Price', 'Qty', 'Amount']],
      body: g.items.map((l) => [
        ...(hasPhotos ? [''] : []), String(++n), l.variant_label ? `${l.name}\n${l.variant_label}` : l.name,
        rs(l.unit_price), nf.format(l.quantity), rs(l.amount ?? l.unit_price * l.quantity),
      ]),
      styles: { fontSize: 9.5, cellPadding: 2, valign: 'middle', textColor: [40, 40, 50] },
      headStyles: { fillColor: BRAND, textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [243, 246, 251] },
      columnStyles: hasPhotos
        ? { 0: { cellWidth: 24, minCellHeight: 20 }, 1: { cellWidth: 9 }, 3: { halign: 'right', cellWidth: 28 }, 4: { halign: 'right', cellWidth: 13 }, 5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' } }
        : { 0: { cellWidth: 9 }, 2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 14 }, 4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' } },
      didDrawCell: hasPhotos ? photoCell(doc, rowImgs) : undefined,
    });
    y = lastY(doc, y) + 6;
  }

  // Totals
  const totals: string[][] = [['Subtotal', rs(q.subtotal)]];
  if (q.discount) totals.push(['Discount', `- ${rs(q.discount)}`]);
  totals.push(['Total', rs(q.total)]);
  if (q.received) totals.push(['Received', rs(q.received)], ['Balance', rs(q.balance)]);
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 18; }
  autoTable(doc, {
    startY: y, theme: 'plain', margin: { left: W - 14 - 80, right: 14 }, tableWidth: 80,
    body: totals,
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (d: { row: { raw: unknown }; cell: { styles: { fontSize: number; textColor: unknown; fillColor: unknown; fontStyle: string } } }) => {
      if ((d.row.raw as string[])[0] === 'Total') {
        d.cell.styles.fontSize = 13; d.cell.styles.textColor = [255, 255, 255]; d.cell.styles.fillColor = BRAND; d.cell.styles.fontStyle = 'bold';
      }
    },
  });

  footer(doc, q.note || 'Prices are as agreed for this event. Thank you for choosing us.');
  return doc;
}

/** Price list of all services under their headings, one row per photo option. */
export async function priceListPdf(business: PdfBusiness, services: Service[], photoUrl: (id: number) => string): Promise<void> {
  const { jsPDF, autoTable } = await lib();
  const imgs = await thumbs(services.flatMap((s) => s.photos.map((p) => p.id)), photoUrl);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = header(doc, business, 'Price List', [`Date: ${fmtDate(new Date().toISOString().slice(0, 10))}`]);

  for (const g of groupByCategory(services)) {
    y = heading(doc, g.name, y);
    const rows: { cells: string[]; img: Img | null }[] = [];
    for (const s of g.items) {
      if (!s.photos.length) rows.push({ cells: ['', s.name, '', rs(s.price)], img: null });
      else s.photos.forEach((p, i) => rows.push({ cells: ['', i === 0 ? s.name : '', p.label || `Option ${i + 1}`, rs(p.price)], img: imgs.get(p.id) ?? null }));
    }
    autoTable(doc, {
      startY: y, margin: { left: 14, right: 14 },
      head: [['Photo', 'Service', 'Option', 'Price']],
      body: rows.map((r) => r.cells),
      styles: { fontSize: 9.5, cellPadding: 2, valign: 'middle', textColor: [40, 40, 50] },
      headStyles: { fillColor: BRAND, textColor: 255, fontSize: 9 },
      alternateRowStyles: { fillColor: [243, 246, 251] },
      columnStyles: { 0: { cellWidth: 24, minCellHeight: 20 }, 1: { fontStyle: 'bold' }, 3: { halign: 'right', cellWidth: 32, fontStyle: 'bold' } },
      didDrawCell: photoCell(doc, rows.map((r) => r.img)),
    });
    y = lastY(doc, y) + 6;
  }
  footer(doc, 'Prices may change. Final price is confirmed at booking.');
  doc.save(`Price-list-${new Date().toISOString().slice(0, 10)}.pdf`);
}
