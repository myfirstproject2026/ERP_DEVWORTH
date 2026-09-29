import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Wallet, Trash2 } from 'lucide-react'
import { purchaseApi, branchesApi } from '../../api/services'
import LineItemsEditor from '../../components/LineItemsEditor'
import { StatusPill } from './PurchaseOverviewPage'

const STATUSES = ['pending', 'partially_paid', 'paid', 'overdue', 'cancelled']
const PAYMENT_METHODS = ['bank_transfer', 'upi', 'cheque', 'cash', 'card', 'other']

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function BillsPage() {
  const [bills, setBills] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [payingBill, setPayingBill] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    purchaseApi.listBills({ status: statusFilter }).then((res) => setBills(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete ${b.bill_number}?`)) return
    try {
      await purchaseApi.removeBill(b.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete bill')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
        </select>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New bill
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">BILL NUMBER</th>
              <th className="px-5 py-3 font-medium">SUPPLIER</th>
              <th className="px-5 py-3 font-medium">DUE DATE</th>
              <th className="px-5 py-3 font-medium">TOTAL</th>
              <th className="px-5 py-3 font-medium">BALANCE DUE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && bills.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{b.bill_number}</td>
                <td className="px-5 py-3.5 text-slate-700">{b.supplier_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{b.due_date}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(b.total_amount)}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(b.balance_due)}</td>
                <td className="px-5 py-3.5"><StatusPill status={b.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {b.status !== 'paid' && b.status !== 'cancelled' && (
                      <button
                        title="Record payment"
                        onClick={() => setPayingBill(b)}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                      >
                        <Wallet size={14} />
                      </button>
                    )}
                    {Number(b.amount_paid) === 0 && (
                      <button
                        onClick={() => handleDelete(b)}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && bills.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No bills found.</p>
        )}
      </div>

      {modalOpen && (
        <BillModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />
      )}
      {payingBill && (
        <PaymentModal bill={payingBill} onClose={() => setPayingBill(null)} onSaved={() => { setPayingBill(null); load() }} />
      )}
    </div>
  )
}

function BillModal({ onClose, onSaved }) {
  const [suppliers, setSuppliers] = useState([])
  const [branches, setBranches] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState([{ product_name: '', quantity: 1, unit: 'unit', unit_price: 0, tax_rate: 18 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    purchaseApi.listSuppliers().then((res) => setSuppliers(res.data))
    branchesApi.list().then((res) => setBranches(res.data))
  }, [])

  const handleSave = async () => {
    setError('')
    if (!supplierId) { setError('Please select a supplier'); return }
    if (!branchId) { setError('Please select a branch'); return }
    if (!dueDate) { setError('Please set a due date'); return }
    const validItems = items.filter((it) => it.product_name.trim())
    if (validItems.length === 0) { setError('Add at least one line item'); return }

    setSaving(true)
    try {
      await purchaseApi.createBill({
        supplier_id: Number(supplierId),
        branch_id: Number(branchId),
        bill_date: billDate,
        due_date: dueDate,
        items: validItems.map((it) => ({ ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price), tax_rate: Number(it.tax_rate) })),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create bill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New bill</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier *</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier...</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Branch *</label>
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch...</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bill date</label>
            <input type="date" className="input" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Due date *</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1.5">Line items</label>
        <LineItemsEditor items={items} onChange={setItems} />

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create bill
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

function PaymentModal({ bill, onClose, onSaved }) {
  const [amount, setAmount] = useState(bill.balance_due)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (Number(amount) <= 0) { setError('Enter a valid amount'); return }
    if (Number(amount) > Number(bill.balance_due)) { setError(`Amount exceeds outstanding balance of ₹${bill.balance_due}`); return }

    setSaving(true)
    try {
      await purchaseApi.recordPayment(bill.id, {
        amount: Number(amount), payment_date: paymentDate, payment_method: method, reference_number: reference || null,
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
          <h3 className="font-semibold text-slate-900">Record payment — {bill.bill_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <p className="text-xs text-slate-400 mb-4">Outstanding balance: <span className="font-semibold text-slate-700">{formatINR(bill.balance_due)}</span></p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount *</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment date</label>
            <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference number</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction ID" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
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
