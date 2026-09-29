import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X, Loader2, Check } from 'lucide-react'
import { purchaseApi } from '../../api/services'
import { StatusPill } from './PurchaseOverviewPage'

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const prefilledPoId = searchParams.get('new_from_po')

  const load = useCallback(() => {
    setLoading(true)
    purchaseApi.listReceipts({ status: statusFilter }).then((res) => setReceipts(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (prefilledPoId) setModalOpen(true)
  }, [prefilledPoId])

  const handleComplete = async (r) => {
    if (!window.confirm(`Mark ${r.grn_number} as completed? This will update stock levels.`)) return
    try {
      await purchaseApi.completeReceipt(r.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not complete receipt')
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    if (prefilledPoId) {
      searchParams.delete('new_from_po')
      setSearchParams(searchParams)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New goods receipt
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">GRN NUMBER</th>
              <th className="px-5 py-3 font-medium">PO NUMBER</th>
              <th className="px-5 py-3 font-medium">SUPPLIER</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">DATE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && receipts.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{r.grn_number}</td>
                <td className="px-5 py-3.5 text-slate-600">{r.po_number}</td>
                <td className="px-5 py-3.5 text-slate-700">{r.supplier_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{r.branch_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{r.receipt_date}</td>
                <td className="px-5 py-3.5"><StatusPill status={r.status} /></td>
                <td className="px-5 py-3.5 text-right">
                  {r.status === 'draft' && (
                    <button
                      onClick={() => handleComplete(r)}
                      className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Check size={13} /> Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && receipts.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No goods receipts yet.</p>
        )}
      </div>

      {modalOpen && (
        <ReceiptModal prefilledPoId={prefilledPoId} onClose={closeModal} onSaved={() => { closeModal(); load() }} />
      )}
    </div>
  )
}

function ReceiptModal({ prefilledPoId, onClose, onSaved }) {
  const [orders, setOrders] = useState([])
  const [poId, setPoId] = useState(prefilledPoId || '')
  const [poDetail, setPoDetail] = useState(null)
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [receiveQty, setReceiveQty] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    purchaseApi.listOrders().then((res) =>
      setOrders(res.data.filter((o) => ['sent', 'confirmed', 'partially_received'].includes(o.status)))
    )
  }, [])

  useEffect(() => {
    if (!poId) { setPoDetail(null); return }
    purchaseApi.getOrder(poId).then((res) => {
      setPoDetail(res.data)
      const defaults = {}
      res.data.items.forEach((it) => {
        defaults[it.id] = 0
      })
      setReceiveQty(defaults)
    })
  }, [poId])

  const handleSave = async () => {
    setError('')
    if (!poId) { setError('Please select a purchase order'); return }
    const items = Object.entries(receiveQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([itemId, qty]) => ({ purchase_order_item_id: Number(itemId), quantity_received: Number(qty) }))
    if (items.length === 0) { setError('Enter a received quantity for at least one item'); return }

    setSaving(true)
    try {
      await purchaseApi.createReceipt({
        purchase_order_id: Number(poId),
        branch_id: poDetail.branch_id,
        receipt_date: receiptDate,
        notes: notes || null,
        items,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create goods receipt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New goods receipt</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Purchase order *</label>
            <select className="input" value={poId} onChange={(e) => setPoId(e.target.value)}>
              <option value="">Select purchase order...</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Receipt date</label>
            <input type="date" className="input" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>
        </div>

        {poDetail && (
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-slate-400 bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 font-medium">PRODUCT</th>
                  <th className="px-3 py-2 font-medium">ORDERED</th>
                  <th className="px-3 py-2 font-medium">ALREADY RECEIVED</th>
                  <th className="px-3 py-2 font-medium w-32">RECEIVE NOW</th>
                </tr>
              </thead>
              <tbody>
                {poDetail.items.map((it) => {
                  const remaining = Number(it.quantity) - Number(it.received_quantity ?? 0)
                  return (
                    <tr key={it.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{it.product_name}</td>
                      <td className="px-3 py-2 text-slate-500">{it.quantity} {it.unit}</td>
                      <td className="px-3 py-2 text-slate-500">{it.received_quantity ?? 0} {it.unit}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.01"
                          className="input"
                          value={receiveQty[it.id] ?? 0}
                          onChange={(e) => setReceiveQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !poDetail}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create receipt
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
