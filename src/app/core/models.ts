export type Role = 'ADMIN' | 'STAFF';
export type EventStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export type Installment = 'ADVANCE' | 'SECOND' | 'THIRD' | 'FINAL' | 'OTHER';
export type ExpenseStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface CompanyRef { id: number; name: string; slug: string; is_main: boolean; logo_url?: string | null; }
export interface User { id: number; name: string; email: string; role: Role; active: number; created_at?: string; is_super?: boolean; company?: CompanyRef; }

/** A business using the panel (Super Admin view). */
export type CompanyStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export interface Company {
  id: number; slug: string; company_name: string; profile_name: string | null; business_type: string | null;
  owner_name: string; email: string; phone: string | null; address: string | null; status: CompanyStatus; status_note: string | null;
  is_main: boolean; aadhaar_last4: string | null; pan_masked: string | null; has_aadhaar_photo: boolean; has_pan_photo: boolean; has_logo?: boolean;
  created_at: string; approved_at: string | null; aadhaar_no?: string | null; pan_no?: string | null;
}

export interface Client {
  id: number; name: string; mobile: string; email?: string | null; address?: string | null; notes?: string | null;
  event_count?: number; total_booking?: number; total_received?: number; pending?: number; events?: EventItem[];
}

export interface EventType { id: number; name: string; color: string; event_count?: number; }

export interface EventFunction {
  id: number; event_id: number; name: string; function_date: string; start_time: string | null; end_time: string | null;
  venue: string | null; notes: string | null; status: EventStatus; sort_order: number;
}

export interface EventItem {
  id: number; client_id: number; event_type_id: number | null; name: string; event_date: string;
  start_time: string | null; end_time: string | null; venue: string | null; address: string | null; guests: number | null;
  booking_amount: number; description: string | null; special_instructions: string | null; status: EventStatus; is_tentative: number;
  client_name: string; client_mobile: string; type_name: string | null; type_color: string | null;
  total_received: number; total_expenses: number; advance_received: number; remaining_balance: number; net_profit: number; profit_percentage: number;
  created_at?: string; updated_at?: string;
  client?: Client; functions?: EventFunction[];
  checklist_summary?: { total: number; included: number; excluded: number; unconfirmed: number; completed: number };
  counts?: { materials: number; expenses: number; payments: number; documents: number };
}

export interface ChecklistItem {
  id: number; event_id: number; name: string; category: string | null; included: number | null; done: number;
  needs_verification: number; notes: string | null; sort_order: number; material_count?: number; material_cost?: number;
}

export interface Decor { event_id: number; theme: string | null; color_scheme: string | null; flowers: string | null; lighting: string | null; backdrop: string | null; notes: string | null; }

export interface Material {
  id: number; event_id: number; checklist_item_id: number | null; inventory_item_id: number | null; name: string; category: string | null;
  quantity: number; unit: string; price_type: 'PURCHASE' | 'RENTAL'; purchase_price: number; rental_price: number; total_cost: number;
  vendor_id: number | null; vendor_name?: string | null; required_date: string | null; availability: 'AVAILABLE' | 'PARTIAL' | 'NOT_AVAILABLE' | 'ORDERED';
  notes: string | null; checklist_item_name?: string | null; inventory_name?: string | null;
}

export interface InventoryItem {
  id: number; name: string; category: string | null; unit: string; total_stock: number; purchase_price: number; rental_price: number;
  ownership: 'PURCHASED' | 'RENTAL'; vendor_id: number | null; vendor_name?: string | null; notes: string | null;
  used_stock: number; remaining_stock: number; event_count: number; allocations?: (Material & { event_name: string; event_date: string; event_status: EventStatus })[];
}

export interface Vendor {
  id: number; name: string; contact: string | null; address: string | null; service_category: string | null; notes: string | null;
  total_amount: number; amount_paid: number; remaining: number;
  expenses?: Expense[]; payments?: VendorPayment[]; events?: { id: number; name: string; event_date: string; billed: number }[];
}

export interface Expense {
  id: number; event_id: number; expense_date: string; category: string; description: string | null; vendor_id: number | null; vendor_name?: string | null;
  quantity: number; unit_price: number; total_amount: number; paid_direct: number; amount_paid: number; balance: number; payment_status: ExpenseStatus;
  payment_method: string | null; event_name?: string; event_date?: string;
}

export interface VendorPayment {
  id: number; vendor_id: number; event_id: number | null; expense_id: number | null; payment_date: string; amount: number; mode: PaymentMode;
  transaction_id: string | null; notes: string | null; vendor_name?: string; event_name?: string | null; expense_description?: string | null;
}

export interface ClientPayment {
  id: number; event_id: number; payment_date: string; amount: number; mode: PaymentMode; installment: Installment; transaction_id: string | null;
  notes: string | null; receipt_no: string; event_name?: string; client_name?: string; client_mobile?: string; received_by_name?: string; booking_amount?: number;
}

export interface PaymentSummary {
  booking_amount: number; advance_received: number; second_installment: number; third_installment: number; final_payment: number;
  other_payments: number; total_received: number; remaining_balance: number;
}

export interface Pnl {
  event_id: number; total_revenue: number; total_expenses: number; net_profit: number; profit_percentage: number; total_received: number;
  client_pending: number; vendor_billed: number; vendor_paid: number; vendor_pending: number; unpaid_expenses: number;
  planned_material_cost: number; cash_position: number; expenses_by_category: { category: string; amount: number; count: number }[];
}

export interface DocumentItem { id: number; event_id: number; file_name: string; mime_type: string; size: number; caption: string | null; uploaded_by_name?: string; created_at: string; }

export interface CalendarEntry {
  kind: 'event' | 'function'; event_id: number; function_id: number | null; title: string; event_name: string; date: string;
  start_time: string | null; end_time: string | null; venue: string | null; status: EventStatus; is_tentative: number;
  client_name: string; client_mobile: string; type_name: string | null; color: string;
}

export interface Lookups {
  event_types: EventType[]; vendors: { id: number; name: string; service_category: string | null; contact: string | null }[];
  expense_categories: string[]; units: string[]; checklist_categories: string[]; material_categories: string[]; payment_modes: PaymentMode[];
}

export interface Settings { business_name: string; business_address: string; business_phone: string; business_email: string; gstin: string; receipt_footer: string; booking_notify_email?: string; business_city?: string; }

export interface ReportColumn { key: string; label: string; type: 'text' | 'date' | 'money' | 'number' | 'status' | 'percent'; }
export interface ReportData { title: string; columns: ReportColumn[]; rows: Record<string, any>[]; totals: Record<string, number>; secondary?: Omit<ReportData, 'secondary'>; }

// ---------- Services & Prices (Event Manager) ----------
export interface ServicePhoto { id: number; service_id: number; label: string | null; price: number; sort_order: number; mime_type: string; size: number; created_at: string; }
export interface ServiceVideo { id: number; service_id: number; provider: 'file' | 'youtube' | 'instagram'; video_id: string | null; url: string; label: string | null; mime_type?: string | null; size?: number | null; sort_order: number; }
export interface Service { id: number; name: string; category: string | null; price: number; sort_order: number; active: number; photos: ServicePhoto[]; videos: ServiceVideo[]; min_price: number; max_price: number; }
export interface EventServiceItem {
  id?: number; service_id: number | null; photo_id: number | null; name: string; category?: string | null; variant_label: string | null;
  unit_price: number; quantity: number; amount?: number;
}
export interface EventServices { event_id: number; items: EventServiceItem[]; subtotal: number; discount: number; total: number; booking_amount: number; }
