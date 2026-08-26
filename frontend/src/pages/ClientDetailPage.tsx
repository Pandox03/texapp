import { FormEvent, Fragment, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Banknote, Bot, ChevronDown, ChevronRight, FileDown, FileSpreadsheet, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { extractApiError } from '../lib/errors'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/LocaleContext'
import type { AiClientSummary, Client, ClientProfile, Invoice, InvoiceStatus, Payment, Sale } from '../types'
import { toInputDate } from '../lib/format'
import Card from '../components/ui/Card'
import InvoicePicker, { invoiceRemaining, unpaidInvoices } from '../components/ui/InvoicePicker'
import { InvoiceStatusSelect } from '../components/ui/InvoiceStatusSelect'
import { InvoiceBadge, PaymentBadge } from '../components/ui/StatusBadge'

type Tab = 'orders' | 'credits' | 'payments' | 'invoices'
type PaymentTargetMode = 'client' | 'invoice'
type StatementFormat = 'pdf' | 'xls'

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'orders'
  const { isAdmin, isSecretaire, isComptable } = useAuth()
  const canEditClient = isAdmin || isSecretaire
  const canRecordPayment = isAdmin || isSecretaire || isComptable
  const { t, formatDateShort, locale } = useI18n()
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [tab, setTab] = useState<Tab>(
    ['orders', 'credits', 'payments', 'invoices'].includes(initialTab) ? initialTab : 'orders',
  )
  const [showEditForm, setShowEditForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentTargetCreditId, setPaymentTargetCreditId] = useState<number | null>(null)
  const [paymentTargetMode, setPaymentTargetMode] = useState<PaymentTargetMode>('client')
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('')
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<number | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    reference: `PAY-${Date.now()}`,
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    method: 'virement',
    bank_reference: '',
    notes: '',
  })
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    category: '',
    ice_number: '',
    cin: '',
    rc: '',
    credit_limit: '',
    payment_terms_days: '30',
    notes: '',
  })
  const [editError, setEditError] = useState('')
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editingCreditId, setEditingCreditId] = useState<number | null>(null)
  const [showNewCreditForm, setShowNewCreditForm] = useState(false)
  const [expandedCreditId, setExpandedCreditId] = useState<number | null>(null)
  const [creditForm, setCreditForm] = useState({
    reference: '',
    sale_date: '',
    total_amount: '',
    notes: '',
  })
  const [newCreditForm, setNewCreditForm] = useState({
    sale_date: new Date().toISOString().slice(0, 10),
    total_amount: '',
    notes: '',
  })
  const [creditError, setCreditError] = useState('')
  const [submittingCredit, setSubmittingCredit] = useState(false)
  const [aiSummary, setAiSummary] = useState<AiClientSummary | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummaryError, setAiSummaryError] = useState('')
  const [showAiSummary, setShowAiSummary] = useState(false)
  const [statementDownloading, setStatementDownloading] = useState<StatementFormat | null>(null)
  const [statementError, setStatementError] = useState('')

  const loadAiSummary = useCallback(async (refresh = false) => {
    if (!id) return
    setAiSummaryError('')
    setAiSummaryLoading(true)
    try {
      const { data } = await api.get<AiClientSummary>(`/ai/clients/${id}/summary`, {
        params: { locale, refresh: refresh ? 1 : undefined },
      })
      setAiSummary(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAiSummaryError(msg ?? t.ai.summaryError)
    } finally {
      setAiSummaryLoading(false)
    }
  }, [id, locale, t.ai.summaryError])

  const load = useCallback(() => {
    api.get<ClientProfile>(`/clients/${id}`).then((res) => setProfile(res.data))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (profile && showAiSummary) loadAiSummary()
  }, [profile?.client.id, locale, loadAiSummary, showAiSummary])

  function openEditForm(client: Client) {
    setEditForm({
      name: client.name ?? '',
      contact_person: client.contact_person ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      address: client.address ?? '',
      city: client.city ?? '',
      category: client.category ?? '',
      ice_number: client.ice_number ?? '',
      cin: client.cin ?? '',
      rc: client.rc ?? '',
      credit_limit: client.credit_limit != null ? String(client.credit_limit) : '',
      payment_terms_days: String(client.payment_terms_days ?? 30),
      notes: client.notes ?? '',
    })
    setEditError('')
    setShowEditForm(true)
  }

  async function handleClientUpdate(e: FormEvent) {
    e.preventDefault()
    if (!profile) return

    if (!editForm.cin.trim() && !editForm.rc.trim()) {
      setEditError(t.clients.cinOrRcRequired)
      return
    }

    setEditError('')
    setSubmittingEdit(true)

    try {
      const { data } = await api.put<Client>(`/clients/${profile.client.id}`, {
        name: editForm.name,
        contact_person: editForm.contact_person || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        city: editForm.city || null,
        category: editForm.category || null,
        ice_number: editForm.ice_number || null,
        cin: editForm.cin || null,
        rc: editForm.rc || null,
        credit_limit: editForm.credit_limit ? Number(editForm.credit_limit) : null,
        payment_terms_days: Number(editForm.payment_terms_days),
        notes: editForm.notes || null,
      })
      setProfile((prev) => (prev ? { ...prev, client: { ...prev.client, ...data } } : prev))
      setShowEditForm(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setEditError(msg ?? t.clients.updateError)
    } finally {
      setSubmittingEdit(false)
    }
  }

  async function handlePayment(e: FormEvent) {
    e.preventDefault()
    if (!profile) return

    const requiresProof = paymentForm.method === 'virement' || paymentForm.method === 'cheque'
    if (requiresProof && !proofFile) {
      setPaymentError(t.clients.proofRequired)
      return
    }
    if (!paymentTargetCreditId && paymentTargetMode === 'invoice' && !paymentInvoiceId) {
      setPaymentError(t.clients.chooseInvoice)
      return
    }

    setPaymentError('')
    setSubmittingPayment(true)

    try {
      const formData = new FormData()
      formData.append('client_id', String(profile.client.id))
      if (paymentForm.reference.trim()) formData.append('reference', paymentForm.reference.trim())
      formData.append('amount', paymentForm.amount)
      formData.append('payment_date', paymentForm.payment_date)
      formData.append('method', paymentForm.method)
      if (paymentTargetCreditId) formData.append('sale_id', String(paymentTargetCreditId))
      else if (paymentTargetMode === 'invoice' && paymentInvoiceId) {
        formData.append('invoice_id', paymentInvoiceId)
      }
      if (paymentForm.bank_reference) formData.append('bank_reference', paymentForm.bank_reference)
      if (paymentForm.notes) formData.append('notes', paymentForm.notes)
      if (proofFile) formData.append('proof_document', proofFile)

      await api.post('/payments', formData)

      const paidCreditId = paymentTargetCreditId
      setShowPaymentForm(false)
      setPaymentTargetCreditId(null)
      setPaymentTargetMode('client')
      setPaymentInvoiceId('')
      setProofFile(null)
      setPaymentForm({
        reference: `PAY-${Date.now()}`,
        amount: '',
        payment_date: new Date().toISOString().slice(0, 10),
        method: 'virement',
        bank_reference: '',
        notes: '',
      })
      if (paidCreditId) setExpandedCreditId(paidCreditId)
      load()
    } catch (err: unknown) {
      setPaymentError(extractApiError(err, t.clients.paymentError))
    } finally {
      setSubmittingPayment(false)
    }
  }

  function openSalesPaymentForm() {
    setPaymentTargetCreditId(null)
    setPaymentTargetMode('client')
    setPaymentInvoiceId('')
    setPaymentForm({
      reference: `PAY-${Date.now()}`,
      amount: '',
      payment_date: new Date().toISOString().slice(0, 10),
      method: 'virement',
      bank_reference: '',
      notes: '',
    })
    setProofFile(null)
    setPaymentError('')
    setShowPaymentForm(true)
  }

  function openInvoicePaymentForm(invoice?: Invoice) {
    setPaymentTargetCreditId(null)
    setPaymentTargetMode('invoice')
    const invId = invoice ? String(invoice.id) : ''
    const due = invoice ? invoiceRemaining(invoice) : 0
    setPaymentInvoiceId(invId)
    setPaymentForm({
      reference: `PAY-${Date.now()}`,
      amount: due > 0.01 ? String(Math.round(due * 100) / 100) : '',
      payment_date: new Date().toISOString().slice(0, 10),
      method: 'virement',
      bank_reference: '',
      notes: '',
    })
    setProofFile(null)
    setPaymentError('')
    setShowPaymentForm(true)
    setTab('payments')
  }

  function openCreditPaymentForm(credit: Sale) {
    const due = credit.balance_due ?? Number(credit.total_amount) - Number(credit.paid_amount ?? 0)
    setPaymentTargetCreditId(credit.id)
    setPaymentTargetMode('client')
    setPaymentInvoiceId('')
    setPaymentForm({
      reference: `PAY-${Date.now()}`,
      amount: due > 0 ? String(due) : '',
      payment_date: new Date().toISOString().slice(0, 10),
      method: 'virement',
      bank_reference: '',
      notes: '',
    })
    setProofFile(null)
    setPaymentError('')
    setEditingCreditId(null)
    setShowPaymentForm(true)
    setTab('credits')
  }

  async function downloadProof(payment: Payment) {
    if (!payment.id) return
    const res = await api.get(`/payments/${payment.id}/proof`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank')
  }

  async function downloadStatement(format: StatementFormat) {
    if (!id) return
    setStatementError('')
    setStatementDownloading(format)
    try {
      const res = await api.get(`/clients/${id}/statement.${format}`, {
        responseType: 'blob',
        headers: {
          Accept: format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.ms-excel',
        },
      })

      const contentType = String(res.headers['content-type'] ?? '')
      if (contentType.includes('application/json')) {
        const text = await (res.data as Blob).text()
        const parsed = JSON.parse(text) as { message?: string }
        throw new Error(parsed.message ?? t.clients.statementError)
      }

      const mime = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.ms-excel'
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const link = document.createElement('a')
      link.href = url
      const safeName = (profile?.client.name ?? 'client').replace(/[^\w\-]+/g, '-')
      link.download = `etat-client-${safeName}-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xls'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      let msg = t.clients.statementError
      if (err instanceof Error && err.message) {
        msg = err.message
      }
      try {
        const ax = err as { response?: { data?: Blob | { message?: string } } }
        const data = ax.response?.data
        if (data instanceof Blob) {
          const text = await data.text()
          const parsed = JSON.parse(text) as { message?: string }
          if (parsed.message) msg = parsed.message
        } else if (data && typeof data === 'object' && 'message' in data && data.message) {
          msg = String(data.message)
        } else {
          msg = extractApiError(err, t.clients.statementError)
        }
      } catch {
        msg = extractApiError(err, t.clients.statementError)
      }
      setStatementError(msg)
    } finally {
      setStatementDownloading(null)
    }
  }

  async function updateInvoiceStatus(invoice: Invoice, status: InvoiceStatus) {
    if (status === invoice.status) return
    setUpdatingInvoiceId(invoice.id)
    try {
      const { data } = await api.put<Invoice>(`/invoices/${invoice.id}`, { status })
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              invoices: prev.invoices.map((inv) => (inv.id === invoice.id ? { ...inv, ...data } : inv)),
            }
          : prev,
      )
    } finally {
      setUpdatingInvoiceId(null)
    }
  }

  function openCreditEdit(credit: Sale) {
    setShowNewCreditForm(false)
    setCreditForm({
      reference: credit.reference,
      sale_date: toInputDate(credit.sale_date),
      total_amount: String(credit.total_amount),
      notes: credit.notes ?? '',
    })
    setCreditError('')
    setEditingCreditId(credit.id)
  }

  function openNewCreditForm() {
    setEditingCreditId(null)
    setCreditError('')
    setNewCreditForm({
      sale_date: new Date().toISOString().slice(0, 10),
      total_amount: '',
      notes: '',
    })
    setShowNewCreditForm(true)
    setTab('credits')
  }

  async function handleCreditCreate(e: FormEvent) {
    e.preventDefault()
    if (!id) return

    setCreditError('')
    setSubmittingCredit(true)

    try {
      const { data } = await api.post<{ id: number }>('/sales', {
        sale_type: 'legacy_credit',
        client_id: Number(id),
        sale_date: newCreditForm.sale_date,
        total_amount: Number(newCreditForm.total_amount),
        notes: newCreditForm.notes || null,
      })
      setShowNewCreditForm(false)
      navigate(`/invoices/generer?sale_id=${data.id}`)
    } catch (err: unknown) {
      setCreditError(extractApiError(err, t.credit.error))
    } finally {
      setSubmittingCredit(false)
    }
  }

  async function handleCreditUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingCreditId) return

    setCreditError('')
    setSubmittingCredit(true)

    try {
      await api.put(`/sales/${editingCreditId}`, {
        reference: creditForm.reference,
        sale_date: creditForm.sale_date,
        total_amount: Number(creditForm.total_amount),
        notes: creditForm.notes || null,
      })
      setEditingCreditId(null)
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setCreditError(msg ?? t.credit.error)
    } finally {
      setSubmittingCredit(false)
    }
  }

  async function handleCreditDelete(credit: Sale) {
    if (!window.confirm(t.clients.deleteCreditConfirm.replace('{ref}', credit.reference))) {
      return
    }

    try {
      await api.delete(`/sales/${credit.id}`)
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      window.alert(msg ?? t.clients.deleteCreditError)
    }
  }

  if (!profile) return <p className="text-muted">{t.common.loading}</p>

  const { client, balance, stock_sales, credits, payments, invoices } = profile

  const salesPayments = payments.filter((p) => {
    if (!p.sale_id) return true
    return !credits.some((c) => c.id === p.sale_id)
  })
  const creditPaymentsBySaleId = payments.reduce<Record<number, Payment[]>>((acc, p) => {
    if (p.sale_id && credits.some((c) => c.id === p.sale_id)) {
      ;(acc[p.sale_id] ??= []).push(p)
    }
    return acc
  }, {})

  const requiresProof = paymentForm.method === 'virement' || paymentForm.method === 'cheque'
  const canPaySales = balance.sales_balance_due > 0.01
  const payingCredit = paymentTargetCreditId
    ? credits.find((c) => c.id === paymentTargetCreditId) ?? null
    : null
  const selectedInvoice = paymentInvoiceId
    ? invoices.find((inv) => String(inv.id) === paymentInvoiceId)
    : undefined
  const payableInvoices = unpaidInvoices(invoices)
  const paymentMax = payingCredit
    ? (payingCredit.balance_due ?? Number(payingCredit.total_amount) - Number(payingCredit.paid_amount ?? 0))
    : paymentTargetMode === 'invoice' && selectedInvoice
      ? invoiceRemaining(selectedInvoice)
      : balance.sales_balance_due
  const showPaymentPanel = canRecordPayment && showPaymentForm && (payingCredit ? paymentMax > 0.01 : canPaySales || payableInvoices.length > 0)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'orders', label: t.clients.orders, count: stock_sales.length },
    { key: 'credits', label: t.nav.credits, count: credits.length },
    { key: 'payments', label: t.clients.payments, count: salesPayments.length },
    { key: 'invoices', label: t.clients.invoices, count: invoices.length },
  ]

  return (
    <div>
      <Link
        to={isComptable && !isAdmin && !isSecretaire ? '/invoices' : '/clients'}
        className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-teal-600 hover:underline"
      >
        <ArrowLeft size={16} />
        {isComptable && !isAdmin && !isSecretaire ? t.clients.backToInvoices : t.clients.title}
      </Link>

      <div className="mb-6 grid gap-4">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-navy-900">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-xs font-medium uppercase tracking-wide text-muted sm:inline">
                {t.clients.statementTitle}
              </span>
              <button
                type="button"
                onClick={() => downloadStatement('pdf')}
                disabled={statementDownloading !== null}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-navy-800 hover:bg-surface disabled:opacity-50"
                title={t.clients.downloadStatementPdf}
              >
                <FileDown size={16} />
                {statementDownloading === 'pdf' ? '…' : t.clients.downloadStatementPdf}
              </button>
              <button
                type="button"
                onClick={() => downloadStatement('xls')}
                disabled={statementDownloading !== null}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-navy-800 hover:bg-surface disabled:opacity-50"
                title={t.clients.downloadStatementExcel}
              >
                <FileSpreadsheet size={16} />
                {statementDownloading === 'xls' ? '…' : t.clients.downloadStatementExcel}
              </button>
              {canEditClient && !showEditForm && (
                <button
                  type="button"
                  onClick={() => openEditForm(client)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-navy-800 hover:bg-surface"
                >
                  <Pencil size={16} />
                  {t.clients.edit}
                </button>
              )}
            </div>
          </div>
          {statementError && (
            <p className="mb-3 text-sm text-red-600">{statementError}</p>
          )}
          {!showEditForm ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {client.contact_person && <p><span className="text-muted">{t.clients.contact} :</span> {client.contact_person}</p>}
            {client.phone && <p><span className="text-muted">{t.common.phone} :</span> {client.phone}</p>}
            {client.email && <p><span className="text-muted">{t.auth.email} :</span> {client.email}</p>}
            {client.ice_number && <p><span className="text-muted">{t.clients.ice} :</span> {client.ice_number}</p>}
            {client.cin && <p><span className="text-muted">{t.clients.cin} :</span> {client.cin}</p>}
            {client.rc && <p><span className="text-muted">{t.clients.rc} :</span> {client.rc}</p>}
            {client.city && <p><span className="text-muted">{t.common.city} :</span> {client.city}</p>}
            {client.category && <p><span className="text-muted">{t.common.category} :</span> {client.category}</p>}
            {client.address && <p className="sm:col-span-2"><span className="text-muted">{t.common.address} :</span> {client.address}</p>}
            {client.credit_limit && <p><span className="text-muted">{t.clients.creditLimit} :</span> {Number(client.credit_limit).toLocaleString('fr-FR')} MAD</p>}
            <p><span className="text-muted">{t.clients.paymentTerms} :</span> {client.payment_terms_days ?? 30} {t.clients.days}</p>
            {client.notes && <p className="sm:col-span-2"><span className="text-muted">{t.common.notes} :</span> {client.notes}</p>}
          </div>
          ) : (
          <form onSubmit={handleClientUpdate} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t.common.name}</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.contact}</label>
              <input value={editForm.contact_person} onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.phone}</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.auth.email}</label>
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.cin}{!editForm.rc.trim() ? ' *' : ''}</label>
              <input value={editForm.cin} onChange={(e) => setEditForm({ ...editForm, cin: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" required={!editForm.rc.trim()} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.rc}{!editForm.cin.trim() ? ' *' : ''}</label>
              <input value={editForm.rc} onChange={(e) => setEditForm({ ...editForm, rc: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" required={!editForm.cin.trim()} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.ice}</label>
              <input value={editForm.ice_number} onChange={(e) => setEditForm({ ...editForm, ice_number: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.city}</label>
              <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.common.category}</label>
              <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.creditLimit}</label>
              <input type="number" min="0" value={editForm.credit_limit} onChange={(e) => setEditForm({ ...editForm, credit_limit: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.clients.paymentTerms}</label>
              <input type="number" min="0" max="365" value={editForm.payment_terms_days} onChange={(e) => setEditForm({ ...editForm, payment_terms_days: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t.common.address}</label>
              <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t.common.notes}</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" rows={2} />
            </div>
            {editError && <p className="md:col-span-2 text-sm text-red-600">{editError}</p>}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="submit" disabled={submittingEdit} className="cursor-pointer rounded-xl bg-teal-500 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {submittingEdit ? t.clients.saving : t.clients.saveChanges}
              </button>
              <button type="button" onClick={() => setShowEditForm(false)} className="cursor-pointer rounded-xl border border-border px-4 py-3 font-medium hover:bg-surface">
                {t.common.cancel}
              </button>
            </div>
          </form>
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-muted">{t.clients.totalStockSales}</p>
            <p className="text-xl font-bold text-navy-900">{balance.total_stock_sales?.toLocaleString('fr-FR') ?? 0} MAD</p>
            <p className="mt-1 text-xs text-muted">{t.clients.salesBalanceDue}: <span className="font-semibold text-red-600">{balance.sales_balance_due.toLocaleString('fr-FR')} MAD</span></p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{t.clients.totalCredits}</p>
            <p className="text-xl font-bold text-amber-700">{balance.total_credits?.toLocaleString('fr-FR') ?? 0} MAD</p>
            <p className="mt-1 text-xs text-muted">{t.clients.creditsBalanceDue}: <span className="font-semibold text-amber-800">{balance.credits_balance_due.toLocaleString('fr-FR')} MAD</span></p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{t.clients.totalPaid}</p>
            <p className="text-xl font-bold text-teal-600">{balance.total_paid.toLocaleString('fr-FR')} MAD</p>
            <p className="mt-1 text-xs text-muted">{t.clients.paymentsOnSalesAndCredits}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{t.clients.totalBalanceDue}</p>
            <p className="text-xl font-bold text-red-600">{balance.balance_due.toLocaleString('fr-FR')} MAD</p>
          </Card>
        </div>
      </div>

      <Card className="mb-6 border-teal-200 bg-teal-50/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <Bot size={18} className="text-teal-700" />
            <h2 className="font-semibold text-navy-900">{t.ai.clientSummary}</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showAiSummary) {
                setShowAiSummary(false)
              } else {
                setShowAiSummary(true)
                if (!aiSummary) loadAiSummary()
              }
            }}
            className="cursor-pointer rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            {showAiSummary ? t.clients.hideAiSummary : t.clients.showAiSummary}
          </button>
        </div>
        {showAiSummary && (
          <div className="mt-3">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => loadAiSummary(true)}
                disabled={aiSummaryLoading}
                className="cursor-pointer text-sm font-medium text-teal-700 hover:underline disabled:opacity-50"
              >
                {aiSummaryLoading ? t.ai.summaryLoading : t.ai.refreshSummary}
              </button>
            </div>
            {aiSummaryError && <p className="text-sm text-red-600">{aiSummaryError}</p>}
            {!aiSummaryError && aiSummaryLoading && !aiSummary && (
              <p className="text-sm text-muted">{t.ai.summaryLoading}</p>
            )}
            {aiSummary && (
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed text-navy-900">{aiSummary.summary}</p>
                {aiSummary.highlights.length > 0 && (
                  <ul className="list-disc space-y-1 ps-5 text-muted">
                    {aiSummary.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-medium ${tab === tabItem.key ? 'bg-teal-500 text-white' : 'border border-border'}`}
            >
              {tabItem.label} ({tabItem.count})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditClient && tab === 'credits' && (
            <button
              type="button"
              onClick={() => {
                if (showNewCreditForm) {
                  setShowNewCreditForm(false)
                } else {
                  openNewCreditForm()
                }
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-surface"
            >
              <Plus size={16} />
              {t.credit.submit}
            </button>
          )}
          {canRecordPayment && (canPaySales || payableInvoices.length > 0) && (
            <button
              type="button"
              onClick={() => {
                if (showPaymentForm && !paymentTargetCreditId) {
                  setShowPaymentForm(false)
                } else {
                  openSalesPaymentForm()
                }
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              {t.clients.addPayment}
            </button>
          )}
        </div>
      </div>

      {showPaymentPanel && (
        <Card className="mb-6">
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm">
              {payingCredit ? (
                <>
                  <p className="font-medium text-navy-900">{t.clients.creditPaymentHint}</p>
                  <p className="mt-1 text-muted">
                    {payingCredit.reference} · {t.clients.remaining}:{' '}
                    <strong className="text-amber-800">{paymentMax.toLocaleString('fr-FR')} MAD</strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-3 font-medium text-navy-900">{t.clients.paymentTargetTitle}</p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentTargetMode('client')
                        setPaymentInvoiceId('')
                        setPaymentForm((prev) => ({ ...prev, amount: '' }))
                      }}
                      className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${
                        paymentTargetMode === 'client' ? 'bg-teal-600 text-white' : 'border border-border bg-white'
                      }`}
                    >
                      {t.clients.paymentTargetClient}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentTargetMode('invoice')
                        setPaymentForm((prev) => ({ ...prev, amount: '' }))
                      }}
                      className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold ${
                        paymentTargetMode === 'invoice' ? 'bg-teal-600 text-white' : 'border border-border bg-white'
                      }`}
                    >
                      {t.clients.paymentTargetInvoice}
                    </button>
                  </div>
                  {paymentTargetMode === 'client' ? (
                    <>
                      <p className="text-muted">{t.clients.paymentFifoHint}</p>
                      <p className="mt-1 text-muted">
                        {t.clients.salesBalanceDue}:{' '}
                        <strong className="text-red-600">{balance.sales_balance_due.toLocaleString('fr-FR')} MAD</strong>
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">{t.clients.paymentInvoiceHint}</p>
                  )}
                </>
              )}
            </div>

            {!payingCredit && paymentTargetMode === 'invoice' && (
              <InvoicePicker
                invoices={invoices}
                value={paymentInvoiceId}
                onChange={(invoiceId, invoice) => {
                  setPaymentInvoiceId(invoiceId)
                  if (invoice) {
                    const due = invoiceRemaining(invoice)
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: due > 0.01 ? String(Math.round(due * 100) / 100) : '',
                    }))
                  }
                }}
              />
            )}

            <div className="grid items-start gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.amount}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={paymentMax}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                    required
                  />
                  {paymentMax > 0.01 && (
                    <button
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, amount: String(Math.round(paymentMax * 100) / 100) })}
                      className="shrink-0 cursor-pointer rounded-xl border border-teal-300 bg-teal-50 px-3 text-xs font-medium text-teal-800 hover:bg-teal-100"
                      title={t.clients.payFullAmount}
                    >
                      {t.clients.payFullAmount}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t.clients.remaining}: {paymentMax.toLocaleString('fr-FR')} MAD max
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.date}</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.method}</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => {
                    setPaymentForm({ ...paymentForm, method: e.target.value })
                    if (e.target.value !== 'virement' && e.target.value !== 'cheque') setProofFile(null)
                  }}
                  className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                >
                  {Object.entries(t.paymentMethod).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.clients.bankRef}</label>
                <input
                  value={paymentForm.bank_reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bank_reference: e.target.value })}
                  className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.notes}</label>
                <input
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                />
              </div>
              {requiresProof && (
                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm font-medium">
                    {t.clients.proofDocument} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="h-10 w-full rounded-xl border border-border px-3 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
                    required
                  />
                  <p className="mt-1 text-xs text-muted">{t.clients.proofRequired}</p>
                </div>
              )}
            </div>
            {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submittingPayment}
                className="cursor-pointer rounded-xl bg-teal-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {submittingPayment ? t.common.loading : t.clients.addPayment}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentForm(false)
                  setPaymentTargetCreditId(null)
                  setPaymentTargetMode('client')
                  setPaymentInvoiceId('')
                }}
                className="cursor-pointer rounded-xl border border-border px-4 py-3 font-medium hover:bg-surface"
              >
                {t.common.cancel}
              </button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'orders' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-3">{t.common.reference}</th>
                  <th className="px-3 py-3">{t.common.date}</th>
                  <th className="px-3 py-3">{t.common.total}</th>
                  <th className="px-3 py-3">{t.sales.payment}</th>
                  <th className="px-3 py-3">{t.sales.balance}</th>
                  <th className="px-3 py-3">Rouleaux</th>
                </tr>
              </thead>
              <tbody>
                {stock_sales.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted">{t.clients.noOrders}</td></tr>}
                {stock_sales.map((sale: Sale) => (
                  <tr key={sale.id} className="border-b border-border/70">
                    <td className="px-3 py-3 font-medium">{sale.reference}</td>
                    <td className="px-3 py-3">{formatDateShort(sale.sale_date)}</td>
                    <td className="px-3 py-3">{Number(sale.total_amount).toLocaleString('fr-FR')} MAD</td>
                    <td className="px-3 py-3">{sale.payment_status && <PaymentBadge status={sale.payment_status} />}</td>
                    <td className="px-3 py-3">{(sale.balance_due ?? Number(sale.total_amount) - Number(sale.paid_amount ?? 0)).toLocaleString('fr-FR')} MAD</td>
                    <td className="px-3 py-3">{sale.items?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'credits' && (
        <Card>
          {showNewCreditForm && (
            <form onSubmit={handleCreditCreate} className="mb-6 grid gap-4 border-b border-border pb-6 md:grid-cols-2">
              <div className="md:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t.credit.noStockHint}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.date}</label>
                <input
                  type="date"
                  value={newCreditForm.sale_date}
                  onChange={(e) => setNewCreditForm({ ...newCreditForm, sale_date: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-3"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.credit.totalAmount}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newCreditForm.total_amount}
                  onChange={(e) => setNewCreditForm({ ...newCreditForm, total_amount: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-3"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">{t.common.notes}</label>
                <input
                  value={newCreditForm.notes}
                  onChange={(e) => setNewCreditForm({ ...newCreditForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-border px-4 py-3"
                  placeholder={t.credit.notesPlaceholder}
                />
              </div>
              {creditError && !editingCreditId && <p className="md:col-span-2 text-sm text-red-600">{creditError}</p>}
              <div className="flex gap-2 md:col-span-2">
                <button type="submit" disabled={submittingCredit} className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {submittingCredit ? t.credit.saving : t.credit.submit}
                </button>
                <button type="button" onClick={() => setShowNewCreditForm(false)} className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
                  {t.common.cancel}
                </button>
              </div>
            </form>
          )}
          {editingCreditId && (
            <form onSubmit={handleCreditUpdate} className="mb-6 grid gap-4 border-b border-border pb-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.reference}</label>
                <input value={creditForm.reference} onChange={(e) => setCreditForm({ ...creditForm, reference: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.date}</label>
                <input type="date" value={creditForm.sale_date} onChange={(e) => setCreditForm({ ...creditForm, sale_date: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.credit.totalAmount}</label>
                <input type="number" step="0.01" min="0.01" value={creditForm.total_amount} onChange={(e) => setCreditForm({ ...creditForm, total_amount: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t.common.notes}</label>
                <input value={creditForm.notes} onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })} className="w-full rounded-xl border border-border px-4 py-3" />
              </div>
              {creditError && <p className="md:col-span-2 text-sm text-red-600">{creditError}</p>}
              <div className="flex gap-2 md:col-span-2">
                <button type="submit" disabled={submittingCredit} className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {submittingCredit ? t.clients.saving : t.clients.saveChanges}
                </button>
                <button type="button" onClick={() => setEditingCreditId(null)} className="cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
                  {t.common.cancel}
                </button>
              </div>
            </form>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="w-10 px-2 py-3" aria-hidden />
                  <th className="px-3 py-3">{t.common.reference}</th>
                  <th className="px-3 py-3">{t.common.date}</th>
                  <th className="px-3 py-3">{t.common.total}</th>
                  <th className="px-3 py-3">{t.sales.payment}</th>
                  <th className="px-3 py-3">{t.clients.amountPaid}</th>
                  <th className="px-3 py-3">{t.sales.balance}</th>
                  <th className="px-3 py-3">{t.common.notes}</th>
                  {(canEditClient || canRecordPayment) && <th className="px-3 py-3 text-right">{t.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {credits.length === 0 && (
                  <tr>
                    <td colSpan={(canEditClient || canRecordPayment) ? 9 : 8} className="px-3 py-8 text-center text-muted">{t.clients.noCredits}</td>
                  </tr>
                )}
                {credits.map((credit: Sale) => {
                  const creditDue = credit.balance_due ?? Number(credit.total_amount) - Number(credit.paid_amount ?? 0)
                  const canPayCredit = canRecordPayment && creditDue > 0.01
                  const creditPayments = creditPaymentsBySaleId[credit.id] ?? []
                  const isExpanded = expandedCreditId === credit.id
                  const colSpan = (canEditClient || canRecordPayment) ? 9 : 8

                  return (
                    <Fragment key={credit.id}>
                      <tr className="border-b border-border/70">
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedCreditId(isExpanded ? null : credit.id)}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-navy-800 hover:bg-surface"
                            title={isExpanded ? t.clients.hideCreditPayments : t.clients.showCreditPayments}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-medium">{credit.reference}</td>
                        <td className="px-3 py-3">{formatDateShort(credit.sale_date)}</td>
                        <td className="px-3 py-3 font-semibold text-amber-700">{Number(credit.total_amount).toLocaleString('fr-FR')} MAD</td>
                        <td className="px-3 py-3">{credit.payment_status && <PaymentBadge status={credit.payment_status} />}</td>
                        <td className="px-3 py-3 text-teal-600">{Number(credit.paid_amount ?? 0).toLocaleString('fr-FR')} MAD</td>
                        <td className="px-3 py-3 font-medium text-red-600">{creditDue.toLocaleString('fr-FR')} MAD</td>
                        <td className="px-3 py-3">{credit.notes ?? t.common.dash}</td>
                        {(canEditClient || canRecordPayment) && (
                          <td className="px-3 py-3 text-right">
                            <div className="inline-flex gap-2">
                              {canPayCredit && (
                                <button type="button" onClick={() => openCreditPaymentForm(credit)} className="cursor-pointer rounded-lg border border-border p-2 text-teal-700 hover:bg-teal-50" title={t.clients.addCreditPayment}>
                                  <Banknote size={14} />
                                </button>
                              )}
                              {canEditClient && (
                                <>
                                  <button type="button" onClick={() => openCreditEdit(credit)} className="cursor-pointer rounded-lg border border-border p-2 hover:bg-surface" title={t.clients.edit}>
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" onClick={() => handleCreditDelete(credit)} className="cursor-pointer rounded-lg border border-border p-2 text-red-600 hover:bg-red-50" title={t.users.delete}>
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/70 bg-amber-50/40">
                          <td colSpan={colSpan} className="px-3 py-4">
                            {creditPayments.length === 0 ? (
                              <p className="text-sm text-muted">{t.clients.noCreditPayments}</p>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                                <table className="min-w-full text-left text-sm">
                                  <thead className="border-b border-border text-muted">
                                    <tr>
                                      <th className="px-3 py-2">{t.common.reference}</th>
                                      <th className="px-3 py-2">{t.common.date}</th>
                                      <th className="px-3 py-2">{t.common.amount}</th>
                                      <th className="px-3 py-2">{t.common.method}</th>
                                      <th className="px-3 py-2">{t.clients.bankRef}</th>
                                      <th className="px-3 py-2">{t.common.notes}</th>
                                      <th className="px-3 py-2">{t.clients.proofDocument}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {creditPayments.map((p) => (
                                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                                        <td className="px-3 py-2 font-medium">{p.reference}</td>
                                        <td className="px-3 py-2">{formatDateShort(p.payment_date)}</td>
                                        <td className="px-3 py-2 font-semibold text-teal-600">{Number(p.amount).toLocaleString('fr-FR')} MAD</td>
                                        <td className="px-3 py-2">{t.paymentMethod[p.method]}</td>
                                        <td className="px-3 py-2">{p.bank_reference ?? t.common.dash}</td>
                                        <td className="px-3 py-2">{p.notes ?? t.common.dash}</td>
                                        <td className="px-3 py-2">
                                          {p.proof_document_url ? (
                                            <button type="button" onClick={() => downloadProof(p)} className="cursor-pointer text-sm text-teal-600 hover:underline">
                                              {t.clients.viewProof}
                                            </button>
                                          ) : t.common.dash}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted">{t.clients.creditsPaymentHelp}</p>
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-3">{t.common.reference}</th>
                  <th className="px-3 py-3">{t.common.date}</th>
                  <th className="px-3 py-3">{t.common.amount}</th>
                  <th className="px-3 py-3">{t.clients.paymentTarget}</th>
                  <th className="px-3 py-3">{t.common.method}</th>
                  <th className="px-3 py-3">{t.clients.bankRef}</th>
                  <th className="px-3 py-3">{t.clients.proofDocument}</th>
                </tr>
              </thead>
              <tbody>
                {salesPayments.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">{t.clients.noPayments}</td></tr>}
                {salesPayments.map((p: Payment) => (
                  <tr key={p.id} className="border-b border-border/70">
                    <td className="px-3 py-3 font-medium">{p.reference}</td>
                    <td className="px-3 py-3">{formatDateShort(p.payment_date)}</td>
                    <td className="px-3 py-3 font-semibold text-teal-600">{Number(p.amount).toLocaleString('fr-FR')} MAD</td>
                    <td className="px-3 py-3">
                      {p.invoice?.reference
                        ? p.invoice.reference
                        : p.auto_allocated
                          ? t.clients.paymentTargetClient
                          : p.sale?.reference ?? t.common.dash}
                    </td>
                    <td className="px-3 py-3">{t.paymentMethod[p.method]}</td>
                    <td className="px-3 py-3">{p.bank_reference ?? t.common.dash}</td>
                    <td className="px-3 py-3">
                      {p.proof_document_url ? (
                        <button type="button" onClick={() => downloadProof(p)} className="cursor-pointer text-sm text-teal-600 hover:underline">
                          {t.clients.viewProof}
                        </button>
                      ) : t.common.dash}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted">{t.clients.salesPaymentsOnlyHint}</p>
        </Card>
      )}

      {tab === 'invoices' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-3">{t.common.reference}</th>
                  <th className="px-3 py-3">{t.common.date}</th>
                  <th className="px-3 py-3">{t.invoices.totalTtc}</th>
                  <th className="px-3 py-3">{t.sales.balance}</th>
                  <th className="px-3 py-3">{t.invoices.dueDate}</th>
                  <th className="px-3 py-3">{t.containers.status}</th>
                  {canRecordPayment && <th className="px-3 py-3 text-right">{t.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={canRecordPayment ? 7 : 6} className="px-3 py-8 text-center text-muted">
                      {t.clients.noInvoices}
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => {
                  const remaining = invoiceRemaining(inv)
                  return (
                  <tr key={inv.id} className="border-b border-border/70">
                    <td className="px-3 py-3 font-medium">{inv.reference}</td>
                    <td className="px-3 py-3">{inv.invoice_date}</td>
                    <td className="px-3 py-3">{Number(inv.total).toLocaleString('fr-FR')} MAD</td>
                    <td className="px-3 py-3">{remaining.toLocaleString('fr-FR')} MAD</td>
                    <td className="px-3 py-3">{inv.due_date ?? t.common.dash}</td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <InvoiceStatusSelect
                          value={inv.status}
                          disabled={updatingInvoiceId === inv.id}
                          onChange={(status) => updateInvoiceStatus(inv, status)}
                        />
                      ) : (
                        <InvoiceBadge status={inv.status} />
                      )}
                    </td>
                    {canRecordPayment && (
                      <td className="px-3 py-3 text-right">
                        {remaining > 0.01 && (
                          <button
                            type="button"
                            onClick={() => openInvoicePaymentForm(inv)}
                            className="cursor-pointer text-sm font-medium text-teal-700 hover:underline"
                          >
                            {t.clients.payInvoice}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
