import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, Loader2, PackageCheck, Trash2 } from 'lucide-react'
import { purchaseApi, branchesApi, inventoryApi } from '../../api/services'
import LineItemsEditor from '../../components/LineItemsEditor'
import { StatusPill } from './PurchaseOverviewPage'

const STATUSES = ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled']

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    purchaseApi.listOrders({ status: statusFilter }).then((res) => setOrders(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (o) => {
    if (!window.confirm(`Delete ${o.po_number}?`)) return
    try {
      await purchaseApi.removeOrder(o.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete purchase order')
    }
  }

  const handleAdvance = async (o, nextStatus) => {
    try {
      await purchaseApi.updateOrder(o.id, { status: nextStatus })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update status')
    }
  }

  const canReceive = (status) => ['sent', 'confirmed', 'partially_received'].includes(status)

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
          <Plus size={15} /> New purchase order
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">PO NUMBER</th>
              <th className="px-5 py-3 font-medium">SUPPLIER</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">DATE</th>
              <th className="px-5 py-3 font-medium">TOTAL</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{o.po_number}</td>
                <td className="px-5 py-3.5 text-slate-700">{o.supplier_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{o.branch_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{o.po_date}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(o.total_amount)}</td>
                <td className="px-5 py-3.5"><StatusPill status={o.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {o.status === 'draft' && (
                      <button
                        onClick={() => handleAdvance(o, 'sent')}
                        className="px-2.5 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Send to supplier
                      </button>
                    )}
                    {o.status === 'sent' && (
                      <button
                        onClick={() => handleAdvance(o, 'confirmed')}
                        className="px-2.5 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Mark confirmed
                      </button>
                    )}
                    {canReceive(o.status) && (
                      <Link
                        title="Receive goods"
                        to={`/purchase/receipts?new_from_po=${o.id}`}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                      >
                        <PackageCheck size={14} />
                      </Link>
                    )}
                    {o.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(o)}
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
        {!loading && orders.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No purchase orders found.</p>
        )}
      </div>

      {modalOpen && (
        <PurchaseOrderModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />
      )}
    </div>
  )
}

function PurchaseOrderModal({ onClose, onSaved }) {
  const [suppliers, setSuppliers] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ product_name: '', product_id: null, quantity: 1, unit: 'unit', unit_price: 0, tax_rate: 18 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    purchaseApi.listSuppliers().then((res) => setSuppliers(res.data))
    branchesApi.list().then((res) => setBranches(res.data))
    inventoryApi.listProducts().then((res) => setProducts(res.data))
  }, [])

  const handleSave = async () => {
    setError('')
    if (!supplierId) { setError('Please select a supplier'); return }
    if (!branchId) { setError('Please select a branch'); return }
    const validItems = items.filter((it) => (it.product_name || '').trim())
    if (validItems.length === 0) { setError('Add at least one line item with a product name'); return }

    setSaving(true)
    try {
      await purchaseApi.createOrder({
        supplier_id: Number(supplierId),
        branch_id: Number(branchId),
        po_date: poDate,
        expected_delivery_date: expectedDate || null,
        notes: notes || null,
        items: validItems.map((it) => ({
          ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price), tax_rate: Number(it.tax_rate),
        })),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create purchase order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New purchase order</h3>
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">PO date</label>
            <input type="date" className="input" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Expected delivery</label>
            <input type="date" className="input" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1.5">Line items</label>
        <LineItemsEditor items={items} onChange={setItems} products={products} />
        <p className="text-xs text-slate-400 mt-1.5">Pick an existing product from the suggestions to fill its unit, price and tax; typed names that match no product are saved as-is.</p>

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
            Create purchase order
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
