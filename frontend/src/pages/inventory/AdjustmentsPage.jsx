import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Trash2, CheckCircle2 } from 'lucide-react'
import { inventoryApi, branchesApi } from '../../api/services'

const REASONS = ['damage', 'loss', 'found', 'correction', 'other']
const STATUSES = ['draft', 'completed']

function StatusPill({ status }) {
  const map = { draft: 'bg-slate-100 text-slate-500', completed: 'bg-green-50 text-green-600' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{status === 'draft' ? 'Draft' : 'Completed'}</span>
}

function ReasonPill({ reason }) {
  const map = {
    damage: 'bg-red-50 text-red-500', loss: 'bg-red-50 text-red-500',
    found: 'bg-green-50 text-green-600', correction: 'bg-blue-50 text-blue-600', other: 'bg-slate-100 text-slate-500',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[reason]}`}>{reason.charAt(0).toUpperCase() + reason.slice(1)}</span>
}

export default function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    inventoryApi.listAdjustments({ status: statusFilter }).then((res) => setAdjustments(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    branchesApi.list().then((res) => setBranches(res.data))
    inventoryApi.listProducts().then((res) => setProducts(res.data))
  }, [])

  const handleComplete = async (adj) => {
    if (!window.confirm(`Complete adjustment ${adj.adjustment_number}? This will update stock levels immediately.`)) return
    try {
      await inventoryApi.completeAdjustment(adj.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not complete adjustment')
    }
  }

  const handleDelete = async (adj) => {
    if (!window.confirm(`Delete adjustment ${adj.adjustment_number}?`)) return
    try {
      await inventoryApi.removeAdjustment(adj.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete adjustment')
    }
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Status: All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'draft' ? 'Draft' : 'Completed'}</option>)}
          </select>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Plus size={15} /> New adjustment
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">ADJUSTMENT #</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">REASON</th>
              <th className="px-5 py-3 font-medium">DATE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && adjustments.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{a.adjustment_number}</td>
                <td className="px-5 py-3.5 text-slate-600">{a.branch_name}</td>
                <td className="px-5 py-3.5"><ReasonPill reason={a.reason} /></td>
                <td className="px-5 py-3.5 text-slate-500">{a.adjustment_date}</td>
                <td className="px-5 py-3.5"><StatusPill status={a.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {a.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleComplete(a)}
                          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-green-600 hover:bg-green-50"
                          title="Complete adjustment"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && adjustments.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No adjustments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <AdjustmentModal
          branches={branches}
          products={products}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function AdjustmentModal({ branches, products, onClose, onSaved }) {
  const [branchId, setBranchId] = useState('')
  const [reason, setReason] = useState('correction')
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ product_id: '', quantity_change: '', reason_note: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  const addItem = () => setItems((prev) => [...prev, { product_id: '', quantity_change: '', reason_note: '' }])
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (!branchId) throw new Error('Select a branch')
      const payload = {
        branch_id: Number(branchId),
        adjustment_date: adjustmentDate,
        reason,
        notes,
        items: items.filter((i) => i.product_id && i.quantity_change !== '').map((i) => ({
          product_id: Number(i.product_id), quantity_change: Number(i.quantity_change), reason_note: i.reason_note || null,
        })),
      }
      await inventoryApi.createAdjustment(payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not create adjustment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New stock adjustment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch" required>
              <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Reason" required>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Adjustment date" required>
            <input type="date" className="input" value={adjustmentDate} onChange={(e) => setAdjustmentDate(e.target.value)} />
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Items <span className="text-slate-400 font-normal">(use negative numbers to remove stock, positive to add)</span>
            </label>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select className="input flex-1" value={it.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)}>
                    <option value="">Select product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                  </select>
                  <input
                    type="number" placeholder="±qty" className="input w-24" value={it.quantity_change}
                    onChange={(e) => updateItem(idx, 'quantity_change', e.target.value)}
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
            Save as draft
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
