import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Trash2 } from 'lucide-react'
import { salesCrmApi } from '../../api/services'
import LineItemsEditor from '../../components/LineItemsEditor'

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled']

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function StatusPill({ status }) {
  const map = {
    pending: 'bg-slate-100 text-slate-500',
    confirmed: 'bg-blue-50 text-blue-600',
    processing: 'bg-amber-50 text-amber-600',
    shipped: 'bg-indigo-50 text-indigo-600',
    completed: 'bg-green-50 text-green-600',
    cancelled: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || map.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    salesCrmApi.listOrders({ status: statusFilter }).then((res) => setOrders(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (order, status) => {
    try {
      await salesCrmApi.updateOrder(order.id, { status })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update order')
    }
  }

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete ${order.order_number}?`)) return
    try {
      await salesCrmApi.removeOrder(order.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete order')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New sales order
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">ORDER #</th>
              <th className="px-5 py-3 font-medium">CUSTOMER</th>
              <th className="px-5 py-3 font-medium">DATE</th>
              <th className="px-5 py-3 font-medium">TOTAL</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{o.order_number}</td>
                <td className="px-5 py-3.5 text-slate-700">{o.customer_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{o.order_date}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(o.total_amount)}</td>
                <td className="px-5 py-3.5">
                  <select
                    value={o.status}
                    onChange={(e) => handleStatusChange(o, e.target.value)}
                    className="text-xs font-medium rounded-full border-0 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleDelete(o)}
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
        {!loading && orders.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No sales orders found.</p>
        )}
      </div>

      {modalOpen && (
        <OrderModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />
      )}
    </div>
  )
}

function OrderModal({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDelivery, setExpectedDelivery] = useState('')
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
      await salesCrmApi.createOrder({
        customer_id: Number(customerId),
        order_date: orderDate,
        expected_delivery_date: expectedDelivery || null,
        notes: notes || null,
        items: validItems.map((it) => ({ ...it, quantity: Number(it.quantity), unit_price: Number(it.unit_price), tax_rate: Number(it.tax_rate) })),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create sales order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New sales order</h3>
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Order date</label>
            <input type="date" className="input" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Expected delivery</label>
            <input type="date" className="input" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
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
            Create order
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
