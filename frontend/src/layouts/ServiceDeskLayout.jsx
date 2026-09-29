import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Ticket as TicketIcon, Tags, Timer } from 'lucide-react'
import { serviceDeskApi } from '../api/services'

const TABS = [
  { to: '/service-desk', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/service-desk/tickets', label: 'Tickets', icon: TicketIcon },
  { to: '/service-desk/categories', label: 'Categories', icon: Tags },
  { to: '/service-desk/sla-policies', label: 'SLA Policies', icon: Timer },
]

export default function ServiceDeskLayout() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    serviceDeskApi.overview().then((res) => setOverview(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">Service Desk</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Service Desk</h1>
          <p className="text-sm text-slate-500 mt-0.5">Support tickets, categories, and SLA policies.</p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <SummaryCard label="Open tickets" value={overview.open_tickets} />
          <SummaryCard label="Urgent" value={overview.urgent_tickets} accent={overview.urgent_tickets > 0 ? 'text-red-600' : undefined} />
          <SummaryCard label="Breached SLA" value={overview.breached_sla} accent={overview.breached_sla > 0 ? 'text-red-600' : undefined} />
          <SummaryCard label="Resolved this month" value={overview.resolved_this_month} accent="text-green-600" />
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
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
