import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Layers, ArrowLeftRight, ClipboardList, ArrowRight, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { inventoryApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const IN_TYPES = new Set(['purchase_in', 'transfer_in', 'adjustment_in'])

export function MovementTypeTag({ type }) {
  const isIn = IN_TYPES.has(type)
  const labels = {
    purchase_in: 'Purchase in', sale_out: 'Sale out', transfer_in: 'Transfer in',
    transfer_out: 'Transfer out', adjustment_in: 'Adjustment in', adjustment_out: 'Adjustment out',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      isIn ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
    }`}>
      {isIn ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
      {labels[type] || type}
    </span>
  )
}

export default function InventoryOverviewPage() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    inventoryApi.overview().then((res) => setOverview(res.data)).finally(() => setLoading(false))
  }, [])

  const quickLinks = [
    { to: '/inventory/products', label: 'Add product', icon: Package, color: 'bg-blue-50 text-blue-600' },
    { to: '/inventory/stock-levels', label: 'View stock levels', icon: Layers, color: 'bg-purple-50 text-purple-600' },
    { to: '/inventory/transfers', label: 'New transfer', icon: ArrowLeftRight, color: 'bg-amber-50 text-amber-600' },
    { to: '/inventory/adjustments', label: 'New adjustment', icon: ClipboardList, color: 'bg-red-50 text-red-600' },
  ]

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className={`h-9 w-9 rounded-lg ${q.color} flex items-center justify-center mb-3`}>
              <q.icon size={16} />
            </div>
            <p className="text-sm font-medium text-slate-800">{q.label}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Recent stock movements</h3>
          <span className="text-xs text-slate-400">Live ledger</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">PRODUCT</th>
              <th className="px-5 py-2.5 font-medium">BRANCH</th>
              <th className="px-5 py-2.5 font-medium">TYPE</th>
              <th className="px-5 py-2.5 font-medium text-right">QUANTITY</th>
              <th className="px-5 py-2.5 font-medium text-right">BALANCE AFTER</th>
              <th className="px-5 py-2.5 font-medium">NOTES</th>
            </tr>
          </thead>
          <tbody>
            {!loading && (overview?.recent_movements || []).map((m) => (
              <tr key={m.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{m.product_name}</td>
                <td className="px-5 py-3 text-slate-600">{m.branch_name}</td>
                <td className="px-5 py-3"><MovementTypeTag type={m.movement_type} /></td>
                <td className="px-5 py-3 text-right text-slate-700">{Number(m.quantity).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-right font-medium text-slate-800">{Number(m.balance_after).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3 text-slate-400">{m.notes || '—'}</td>
              </tr>
            ))}
            {!loading && (!overview?.recent_movements || overview.recent_movements.length === 0) && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No stock movements yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
