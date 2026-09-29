import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Truck, ShoppingCart, PackageCheck, Receipt } from 'lucide-react'
import { purchaseApi } from '../api/services'

const TABS = [
  { to: '/purchase', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/purchase/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/purchase/orders', label: 'Purchase Orders', icon: ShoppingCart },
  { to: '/purchase/receipts', label: 'Goods Receipts', icon: PackageCheck },
  { to: '/purchase/bills', label: 'Bills', icon: Receipt },
]

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function PurchaseLayout() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    purchaseApi.overview().then((res) => setOverview(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">Purchase</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchase</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suppliers, purchase orders, goods receipts, and bills.</p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <SummaryCard label="Total suppliers" value={overview.total_suppliers} />
          <SummaryCard label="Open purchase orders" value={overview.open_purchase_orders} />
          <SummaryCard label="Bills due" value={formatINR(overview.bills_due_amount)} accent={overview.bills_overdue_count > 0 ? 'text-red-600' : undefined} />
          <SummaryCard label="Pending receipts" value={overview.pending_receipts} accent={overview.pending_receipts > 0 ? 'text-amber-600' : undefined} />
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <t.icon size={15} />
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <p className={`text-xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
