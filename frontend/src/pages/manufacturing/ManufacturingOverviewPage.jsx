import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { manufacturingApi } from '../../api/services'

export const STATUS_STYLES = {
  draft: 'text-slate-500 bg-slate-100',
  scheduled: 'text-blue-600 bg-blue-50',
  in_progress: 'text-blue-600 bg-blue-50',
  completed: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
  active: 'text-green-600 bg-green-50',
  archived: 'text-slate-500 bg-slate-100',
  inactive: 'text-slate-500 bg-slate-100',
  maintenance: 'text-amber-600 bg-amber-50',
}

export function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || 'text-slate-500 bg-slate-100'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}

export function PriorityPill({ priority }) {
  const cls = {
    low: 'text-slate-500 bg-slate-100',
    medium: 'text-blue-600 bg-blue-50',
    high: 'text-amber-600 bg-amber-50',
    urgent: 'text-red-600 bg-red-50',
  }[priority] || 'text-slate-500 bg-slate-100'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}

export default function ManufacturingOverviewPage() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    manufacturingApi.overview().then((res) => setOverview(res.data))
  }, [])

  if (!overview) return <div className="text-sm text-slate-400">Loading…</div>

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Recent work orders</h3>
          <Link to="/manufacturing/work-orders" className="text-xs text-brand-600 font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">WO NUMBER</th>
              <th className="px-5 py-3 font-medium">PRODUCT</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">PROGRESS</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {overview.recent_work_orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{o.wo_number}</td>
                <td className="px-5 py-3.5 text-slate-600">{o.product_name} ({o.quantity_planned} units)</td>
                <td className="px-5 py-3.5 text-slate-600">{o.branch_name}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${o.progress_pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{o.progress_pct}%</span>
                  </div>
                </td>
                <td className="px-5 py-3.5"><StatusPill status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {overview.recent_work_orders.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No work orders yet.</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <QuickLink to="/manufacturing/work-orders" title="Start a work order" desc="Plan production against a product and its bill of materials." />
        <QuickLink to="/manufacturing/boms" title="Build a bill of materials" desc="Define which raw materials go into a finished product." />
        <QuickLink to="/manufacturing/work-centers" title="Set up work centers" desc="Track daily capacity per production line or station." />
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
