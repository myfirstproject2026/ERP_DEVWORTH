import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { purchaseApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export const STATUS_STYLES = {
  draft: 'text-slate-500 bg-slate-100',
  sent: 'text-blue-600 bg-blue-50',
  confirmed: 'text-blue-600 bg-blue-50',
  partially_received: 'text-amber-600 bg-amber-50',
  received: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
  pending: 'text-amber-600 bg-amber-50',
  partially_paid: 'text-amber-600 bg-amber-50',
  paid: 'text-green-600 bg-green-50',
  overdue: 'text-red-600 bg-red-50',
  completed: 'text-green-600 bg-green-50',
}

export function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || 'text-slate-500 bg-slate-100'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}

export default function PurchaseOverviewPage() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    purchaseApi.overview().then((res) => setOverview(res.data))
  }, [])

  if (!overview) return <div className="text-sm text-slate-400">Loading…</div>

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Recent purchase orders</h3>
          <Link to="/purchase/orders" className="text-xs text-brand-600 font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">PO NUMBER</th>
              <th className="px-5 py-3 font-medium">SUPPLIER</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">AMOUNT</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {overview.recent_orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{o.po_number}</td>
                <td className="px-5 py-3.5 text-slate-600">{o.supplier_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{o.branch_name}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(o.total_amount)}</td>
                <td className="px-5 py-3.5"><StatusPill status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {overview.recent_orders.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No purchase orders yet.</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <QuickLink to="/purchase/suppliers" title="Manage suppliers" desc="Add vendors, track spend, assign a category and payment terms." />
        <QuickLink to="/purchase/orders" title="Create a purchase order" desc="Build a PO with line items and send it to a supplier." />
        <QuickLink to="/purchase/bills" title="Record a bill" desc="Log a supplier bill and track payments against it." />
      </div>
    </div>
  )
}

function QuickLink({ to, title, desc }) {
  return (
    <Link to={to} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-300 transition-colors">
      <p className="font-semibold text-slate-900 text-sm mb-1">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </Link>
  )
}
