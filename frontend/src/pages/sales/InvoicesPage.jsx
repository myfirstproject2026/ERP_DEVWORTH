import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Trash2, IndianRupee } from 'lucide-react'
import { salesCrmApi } from '../../api/services'
import LineItemsEditor from '../../components/LineItemsEditor'
import { InvoiceStatusPill } from './SalesOverviewPage'

const STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other']

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    salesCrmApi.listInvoices({ status: statusFilter }).then((res) => setInvoices(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete ${inv.invoice_number}?`)) return
    try {
      await salesCrmApi.removeInvoice(inv.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete invoice')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
        </select>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New invoice
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">INVOICE #</th>
              <th className="px-5 py-3 font-medium">CUSTOMER</th>
              <th className="px-5 py-3 font-medium">DUE DATE</th>
              <th className="px-5 py-3 font-medium">TOTAL</th>
              <th className="px-5 py-3 font-medium">BALANCE DUE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{inv.invoice_number}</td>
                <td className="px-5 py-3.5 text-slate-700">{inv.customer_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{inv.due_date || '—'}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(inv.total_amount)}</td>
                <td className="px-5 py-3.5 font-medium text-amber-600">{formatINR(inv.balance_due)}</td>
                <td className="px-5 py-3.5"><InvoiceStatusPill status={inv.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {inv.balance_due > 0 && inv.status !== 'cancelled' && (
                      <button
                        title="Record payment"
                        onClick={() => setPaymentInvoice(inv)}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-green-600 hover:bg-green-50"
                      >
                        <IndianRupee size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(inv)}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && invoices.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No invoices found.</p>
        )}
      </div>

      {createOpen && (
        <InvoiceModal onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load() }} />
      )}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSaved={() => { setPaymentInvoice(null); load() }}
        />
      )}
    </div>
  )
}

function InvoiceModal({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ product_name: '', quantity: 1, unit: 'unit', unit_price: 0, tax_rate: 18 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { salesCrmApi.listCustomers().then((res) => setCustomers(res.data)) }, [])

  const handleSave = async () => {
    setError('')
    if (!customerId) { setError('Please select a customer'); return }
    const validItems = items.filter((it) => it.product_name.trim())
    if (validItems.length === 0) { setError('Add at least one line item'); return }

    setSaving(true)
    try {
      await salesCrmApi.createInvoice({
        customer_id: Number(customerId),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes || null,
        items: validItems.map((it) => ({ ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price), tax_rate: Number(it.tax_rate) })),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New invoice</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer *</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Invoice date</label>
            <input type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Due date</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1.5">Line items</label>
        <LineItemsEditor items={items} onChange={setItems} />

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create invoice
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
      `}</style>
    </div>
  )
}

function PaymentModal({ invoice, onClose, onSaved }) {
  const [amount, setAmount] = useState(invoice.balance_due)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      await salesCrmApi.recordPayment(invoice.id, {
        amount: Number(amount),
        payment_date: paymentDate,
        payment_method: method,
        reference_number: reference || null,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Record payment — {invoice.invoice_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Outstanding balance: <span className="font-medium text-slate-700">{formatINR(invoice.balance_due)}</span></p>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (₹) *</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} max={invoice.balance_due} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment date</label>
            <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference number</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction / cheque ID" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !amount || Number(amount) <= 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Record payment
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
      `}</style>
    </div>
  )
}
