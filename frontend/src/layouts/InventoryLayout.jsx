import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Package, Layers, ArrowLeftRight, ClipboardList } from 'lucide-react'
import { inventoryApi } from '../api/services'

const TABS = [
  { to: '/inventory', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/inventory/products', label: 'Products', icon: Package },
  { to: '/inventory/stock-levels', label: 'Stock Levels', icon: Layers },
  { to: '/inventory/transfers', label: 'Transfers', icon: ArrowLeftRight },
  { to: '/inventory/adjustments', label: 'Adjustments', icon: ClipboardList },
]

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function InventoryLayout() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    inventoryApi.overview().then((res) => setOverview(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">Inventory</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Products, stock levels, branch transfers, and adjustments.</p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <SummaryCard label="Total products" value={overview.total_products} />
          <SummaryCard label="Low stock items" value={overview.low_stock_count} accent={overview.low_stock_count > 0 ? 'text-red-600' : undefined} />
          <SummaryCard label="Total stock value" value={formatINR(overview.total_stock_value)} />
          <SummaryCard label="Pending transfers" value={overview.pending_transfers} accent={overview.pending_transfers > 0 ? 'text-amber-600' : undefined} />
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
