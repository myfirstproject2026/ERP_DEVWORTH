import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Factory, ClipboardList, Layers } from 'lucide-react'
import { manufacturingApi } from '../api/services'

const TABS = [
  { to: '/manufacturing', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/manufacturing/work-orders', label: 'Work Orders', icon: ClipboardList },
  { to: '/manufacturing/boms', label: 'Bill of Materials', icon: Layers },
  { to: '/manufacturing/work-centers', label: 'Work Centers', icon: Factory },
]

export default function ManufacturingLayout() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    manufacturingApi.overview().then((res) => setOverview(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">Manufacturing</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manufacturing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Work orders, bill of materials, and work centers.</p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <SummaryCard label="Total work orders" value={overview.total_work_orders} />
          <SummaryCard label="In progress" value={overview.in_progress_count} accent="text-blue-600" />
          <SummaryCard label="Completed this month" value={overview.completed_this_month} accent="text-green-600" />
          <SummaryCard label="Active BOMs" value={overview.active_boms} />
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
