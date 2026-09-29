import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Users2, UserPlus, FileText, ShoppingCart, Receipt } from 'lucide-react'
import { salesCrmApi } from '../api/services'

const TABS = [
  { to: '/sales', label: 'Overview', icon: Users2, end: true },
  { to: '/sales/leads', label: 'Leads', icon: UserPlus },
  { to: '/sales/customers', label: 'Customers', icon: Users2 },
  { to: '/sales/quotations', label: 'Quotations', icon: FileText },
  { to: '/sales/orders', label: 'Sales Orders', icon: ShoppingCart },
  { to: '/sales/invoices', label: 'Invoices', icon: Receipt },
]

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function SalesCrmLayout() {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    salesCrmApi.pipelineSummary().then((res) => setSummary(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">Sales + CRM</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales + CRM</h1>
          <p className="text-sm text-slate-500 mt-0.5">Leads, customers, quotations, orders, and invoices — all in one place.</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-4 mb-5">
          <SummaryCard label="Open leads" value={summary.open_leads} />
          <SummaryCard label="Pipeline value" value={formatINR(summary.pipeline_value)} />
          <SummaryCard label="Quotations pending" value={summary.quotations_pending} />
          <SummaryCard label="Orders in progress" value={summary.orders_in_progress} />
          <SummaryCard label="Invoices outstanding" value={formatINR(summary.invoices_outstanding)} accent="text-amber-600" />
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
