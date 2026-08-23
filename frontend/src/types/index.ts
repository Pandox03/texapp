export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'secretaire' | 'comptable'
}

export interface ActivityLog {
  id: number
  user_id: number | null
  action: string
  subject_type: string | null
  subject_id: number | null
  description: string
  properties: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user?: User
}

export interface FabricType {
  id: number
  name: string
  code?: string | null
  parent_id?: number | null
  composition?: string | null
  default_width_cm?: number | null
  default_gsm?: number | null
  description?: string | null
  market_price_m2_mad?: string | number | null
  target_margin_pct?: string | number | null
  parent?: FabricType | null
  children?: FabricType[]
}

export interface ContainerStockSummary {
  lines_count: number
  total_m2: number
}

export interface ContainerItem {
  id: number
  container_id: number
  fabric_type_id: number
  color_code: string
  color_name?: string | null
  quantity_m2: string | number
  estimated_rolls?: number | null
  notes?: string | null
  fabric_type?: FabricType
  sold_m2?: number
  available_m2?: number
}

export interface Container {
  id: number
  reference: string
  arrival_date: string
  origin: string
  supplier_reference?: string | null
  status: 'in_transit' | 'arrived' | 'processing' | 'closed'
  notes?: string | null
  purchase_cost_mad?: string | number | null
  shipping_cost_mad?: string | number | null
  customs_fees_mad?: string | number | null
  other_fees_mad?: string | number | null
  market_notes?: string | null
  items_count?: number
  rolls_count?: number
  items?: ContainerItem[]
  rolls?: FabricRoll[]
  stock_summary?: ContainerStockSummary
}

export interface FabricRoll {
  id: number
  container_id?: number | null
  container_item_id?: number | null
  fabric_type_id: number
  color_code: string
  roll_number: string
  order_number?: string | null
  origin: string
  width_cm: number
  length_m: string | number
  quantity_m2: string | number
  gross_weight_kg?: string | number | null
  net_weight_kg?: string | number | null
  gsm?: number | null
  composition?: string | null
  status: 'available' | 'reserved' | 'sold'
  container?: Container
  fabric_type?: FabricType
  sale?: Sale
}

export interface Client {
  id: number
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  category?: string | null
  ice_number?: string | null
  credit_limit?: string | number | null
  payment_terms_days?: number
  notes?: string | null
  sales_count?: number
  orders_count?: number
  total_sales?: number
  balance_due?: number
}

export interface SaleItem {
  id: number
  sale_id: number
  fabric_roll_id?: number | null
  fabric_type_id?: number | null
  unit_price: string | number
  quantity_m2: string | number
  line_total: string | number
  fabric_roll?: FabricRoll
  fabric_type?: FabricType
}

export type SaleType = 'stock' | 'legacy_credit'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Sale {
  id: number
  reference: string
  sale_type?: SaleType
  client_id: number
  sale_date: string
  total_amount: string | number
  paid_amount?: string | number
  payment_status?: PaymentStatus
  balance_due?: number
  can_edit?: boolean
  can_delete?: boolean
  invoices_count?: number
  notes?: string | null
  client?: Client
  items?: SaleItem[]
  invoices?: Invoice[]
  invoiced_total?: number
  invoiced_subtotal?: number
  remaining_to_invoice?: number
  invoice?: Invoice
  payments?: Payment[]
}

export type InvoiceStatus = 'sent' | 'paid' | 'unpaid' | 'partial'

export interface Invoice {
  id: number
  sale_id: number
  client_id: number
  reference: string
  invoice_date: string
  due_date?: string | null
  subtotal: string | number
  tax_rate: string | number
  tax_amount: string | number
  total: string | number
  status: InvoiceStatus
  notes?: string | null
  paid_amount?: number
  remaining_to_pay?: number
  client?: Client
  sale?: Sale
  payments?: Payment[]
}

export type PaymentMethod = 'especes' | 'cheque' | 'virement' | 'effet' | 'autre'

export interface Payment {
  id: number
  client_id: number
  sale_id?: number | null
  invoice_id?: number | null
  reference: string
  amount: string | number
  payment_date: string
  method: PaymentMethod
  status: 'pending' | 'confirmed' | 'cancelled'
  bank_reference?: string | null
  proof_document_url?: string | null
  auto_allocated?: boolean
  notes?: string | null
  client?: Client
  sale?: Sale
  invoice?: Invoice
}

export interface StockLine {
  fabric_type_id: number
  fabric_type?: FabricType
  quantity_m2: number
  sold_m2: number
  available_m2: number
  total_rolls: number
  available_rolls: number
  sold_rolls: number
}

export interface StockResponse {
  summary: {
    total_m2: number
    sold_m2: number
    available_m2: number
    total_rolls: number
    sold_rolls: number
    available_rolls: number
    available_fabric_rolls: number
    lines_count: number
  }
  items: Paginated<StockLine>
}

export interface ClientProfile {
  client: Client
  balance: {
    total_invoiced?: number
    total_stock_sales?: number
    total_credits?: number
    total_sales: number
    total_paid: number
    sales_balance_due: number
    credits_balance_due: number
    balance_due: number
    orders_count: number
    credits_count?: number
  }
  stock_sales: Sale[]
  credits: Sale[]
  payments: Payment[]
  invoices: Invoice[]
}

export interface DashboardChartPoint {
  month: string
  label: string
  revenue: number
  count: number
  has_data: boolean
}

export interface DashboardStockType {
  fabric_type_id: number
  name: string
  total_m2: number
  available_m2: number
  sold_m2: number
  is_low: boolean
  usage_pct: number
}

export interface DashboardReceivableClient {
  id: number
  name: string
  city?: string | null
  invoiced: number
  paid: number
  balance_due: number
}

export interface DashboardPriorityAction {
  type: 'overdue_invoice' | 'low_stock' | 'stale_container'
  severity: 'high' | 'medium'
  label: string
  detail: string
  amount: number | null
  link: string
  entity_id: number
}

export interface DashboardTopClient {
  id: number
  name: string
  city?: string | null
  revenue: number
  orders_count: number
  last_sale_date?: string | null
  days_since_last_order?: number | null
  is_inactive?: boolean
}

export interface DashboardLowStock {
  fabric_type_id: number
  fabric_type?: string
  available_m2: number
  available_rolls: number
  total_m2: number
  ratio: number
}

export interface DashboardData {
  stats: {
    containers: number
    clients: number
    total_stock_m2: number
    sold_m2: number
    available_m2: number
    available_rolls: number
    total_revenue: number
    revenue_this_month: number
    revenue_last_month: number
    revenue_growth: number
    revenue_three_month_avg?: number
    total_paid: number
    total_invoiced?: number
    balance_due: number
    sales_count: number
    sales_this_month: number
    unpaid_invoices_count?: number
  }
  receivables?: {
    total: number
    by_client: DashboardReceivableClient[]
  }
  priority_actions?: DashboardPriorityAction[]
  sales_chart: DashboardChartPoint[]
  stock_by_type: DashboardStockType[]
  top_clients: DashboardTopClient[]
  container_status: Record<string, number>
  payment_breakdown: Record<string, { count: number; amount: number }>
  invoice_stats: {
    total: number
    paid: number
    unpaid: number
    sent: number
    total_amount: number
  }
  low_stock: DashboardLowStock[]
  recent_containers: Container[]
  recent_sales: Sale[]
  recent_payments: Payment[]
  unpaid_invoices: Invoice[]
}

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}

export interface FilterValues {
  search?: string
  status?: string
  client_id?: string
  container_id?: string
  fabric_type_id?: string
  payment_status?: string
  date_from?: string
  date_to?: string
  city?: string
  category?: string
  color_code?: string
  container_status?: string
  method?: string
}

export interface AiClientSummary {
  summary: string
  highlights: string[]
}

export interface AiPricingHint {
  suggested_price_m2_mad: number | null
  min_price_m2_mad: number | null
  max_price_m2_mad: number | null
  landed_cost_m2_mad: number | null
  target_margin_pct: number | null
  summary: string
  factors: string[]
}

/** Cost + margin pricing (no AI) from containers. */
export interface PricingBasis {
  fabric_type_id: number
  fabric_type_name: string
  landed_cost_m2_mad: number | null
  target_margin_pct: number
  suggested_price_m2_mad: number | null
  market_price_m2_mad: number | null
  has_container_costs: boolean
}
