import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Trash2, CheckCircle2 } from 'lucide-react'
import { inventoryApi, branchesApi } from '../../api/services'

const STATUSES = ['pending', 'in_transit', 'completed', 'cancelled']

function StatusPill({ status }) {
  const map = {
    pending: 'bg-slate-100 text-slate-500',
    in_transit: 'bg-amber-50 text-amber-600',
    completed: 'bg-green-50 text-green-600',
    cancelled: 'bg-red-50 text-red-500',
  }
  const labels = { pending: 'Pending', in_transit: 'In transit', completed: 'Completed', cancelled: 'Cancelled' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{labels[status]}</span>
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    inventoryApi.listTransfers({ status: statusFilter }).then((res) => setTransfers(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    branchesApi.list().then((res) => setBranches(res.data))
    inventoryApi.listProducts().then((res) => setProducts(res.data))
  }, [])

  const advanceStatus = async (transfer) => {
    const next = transfer.status === 'pending' ? 'in_transit' : transfer.status === 'in_transit' ? 'completed' : null
    if (!next) return
    if (next === 'completed' && !window.confirm('Mark this transfer as completed? This will move stock between branches.')) return
    try {
      await inventoryApi.updateTransfer(transfer.id, { status: next })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update transfer')
    }
  }

  const handleDelete = async (transfer) => {
    if (!window.confirm(`Delete transfer ${transfer.transfer_number}?`)) return
    try {
      await inventoryApi.removeTransfer(transfer.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete transfer')
    }
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Status: All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Plus size={15} /> New transfer
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">TRANSFER #</th>
              <th className="px-5 py-3 font-medium">FROM</th>
              <th className="px-5 py-3 font-medium">TO</th>
              <th className="px-5 py-3 font-medium">DATE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && transfers.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{t.transfer_number}</td>
                <td className="px-5 py-3.5 text-slate-600">{t.from_branch_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{t.to_branch_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{t.transfer_date}</td>
                <td className="px-5 py-3.5"><StatusPill status={t.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {(t.status === 'pending' || t.status === 'in_transit') && (
                      <button
                        onClick={() => advanceStatus(t)}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-green-600 hover:bg-green-50"
                        title={t.status === 'pending' ? 'Mark in transit' : 'Mark completed'}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    {t.status === 'pending' && (
                      <button
                        onClick={() => handleDelete(t)}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && transfers.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No transfers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <TransferModal
          branches={branches}
          products={products}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function TransferModal({ branches, products, onClose, onSaved }) {
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  const addItem = () => setItems((prev) => [...prev, { product_id: '', quantity: 1 }])
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (!fromBranch || !toBranch) throw new Error('Select both branches')
      const payload = {
        from_branch_id: Number(fromBranch),
        to_branch_id: Number(toBranch),
        transfer_date: transferDate,
        notes,
        items: items.filter((i) => i.product_id).map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })),
      }
      await inventoryApi.createTransfer(payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not create transfer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New stock transfer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="From branch" required>
              <select className="input" value={fromBranch} onChange={(e) => setFromBranch(e.target.value)}>
                <option value="">Select...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="To branch" required>
              <select className="input" value={toBranch} onChange={(e) => setToBranch(e.target.value)}>
                <option value="">Select...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Transfer date" required>
            <input type="date" className="input" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Items</label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select className="input flex-1" value={it.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)}>
                    <option value="">Select product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                  </select>
                  <input
                    type="number" min="1" className="input w-24" value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                  <button onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-sm text-brand-600 font-medium flex items-center gap-1">
              <Plus size={14} /> Add item
            </button>
          </div>

          <Field label="Notes">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create transfer
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

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
