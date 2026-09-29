import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, BookOpen, Landmark, ListChecks, Receipt, FileBarChart } from 'lucide-react'
import { financeApi } from '../api/services'

const TABS = [
  { to: '/finance', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/finance/accounts', label: 'Chart of Accounts', icon: BookOpen },
  { to: '/finance/bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { to: '/finance/journal-entries', label: 'Journal Entries', icon: ListChecks },
  { to: '/finance/expenses', label: 'Expenses', icon: Receipt },
  { to: '/finance/gst', label: 'GST', icon: FileBarChart },
]

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function FinanceLayout() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    financeApi.overview().then((res) => setOverview(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">Finance & GST</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Finance & GST</h1>
          <p className="text-sm text-slate-500 mt-0.5">Chart of accounts, bank accounts, journal entries, expenses, and GST.</p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-5 gap-4 mb-5">
          <SummaryCard label="Cash & bank balance" value={formatINR(overview.cash_and_bank_balance)} />
          <SummaryCard label="Outstanding receivables" value={formatINR(overview.outstanding_receivables)} accent="text-green-600" />
          <SummaryCard label="Outstanding payables" value={formatINR(overview.outstanding_payables)} accent="text-red-600" />
          <SummaryCard label="Pending expenses" value={overview.pending_expenses} accent={overview.pending_expenses > 0 ? 'text-amber-600' : undefined} />
          <SummaryCard label="Unposted journal entries" value={overview.unposted_journal_entries} accent={overview.unposted_journal_entries > 0 ? 'text-amber-600' : undefined} />
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
