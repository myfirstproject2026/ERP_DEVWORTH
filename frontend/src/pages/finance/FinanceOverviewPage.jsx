import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { financeApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const now = new Date()

export default function FinanceOverviewPage() {
  const [pl, setPl] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      financeApi.profitAndLoss(now.getMonth() + 1, now.getFullYear()),
      financeApi.listJournalEntries(),
    ])
      .then(([plRes, jeRes]) => {
        setPl(plRes.data)
        setEntries(jeRes.data.slice(0, 6))
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-slate-400 text-sm py-10 text-center">Loading…</div>

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 text-sm">Profit &amp; loss — {pl?.period_label}</h3>
          <Link to="/finance/gst" className="text-xs text-brand-600 font-medium">View GST →</Link>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-xs text-green-700 mb-1 flex items-center gap-1"><TrendingUp size={13} /> Income</p>
            <p className="text-lg font-bold text-green-800">{formatINR(pl?.total_income)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-xs text-red-700 mb-1 flex items-center gap-1"><TrendingDown size={13} /> Expense</p>
            <p className="text-lg font-bold text-red-800">{formatINR(pl?.total_expense)}</p>
          </div>
          <div className={`rounded-lg p-4 ${Number(pl?.net_profit) >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
            <p className={`text-xs mb-1 ${Number(pl?.net_profit) >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>Net profit</p>
            <p className={`text-lg font-bold ${Number(pl?.net_profit) >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>{formatINR(pl?.net_profit)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Income breakdown</p>
            {pl?.income_breakdown?.length ? pl.income_breakdown.map((r) => (
              <div key={r.account_name} className="flex justify-between text-sm py-1 border-b border-slate-50">
                <span className="text-slate-600">{r.account_name}</span>
                <span className="font-medium text-slate-800">{formatINR(r.amount)}</span>
              </div>
            )) : <p className="text-xs text-slate-400">No income posted this period.</p>}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Expense breakdown</p>
            {pl?.expense_breakdown?.length ? pl.expense_breakdown.map((r) => (
              <div key={r.account_name} className="flex justify-between text-sm py-1 border-b border-slate-50">
                <span className="text-slate-600">{r.account_name}</span>
                <span className="font-medium text-slate-800">{formatINR(r.amount)}</span>
              </div>
            )) : <p className="text-xs text-slate-400">No expenses posted this period.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Recent journal entries</h3>
          <Link to="/finance/journal-entries" className="text-xs text-brand-600 font-medium">View all</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">ENTRY</th>
              <th className="px-5 py-2.5 font-medium">DATE</th>
              <th className="px-5 py-2.5 font-medium">NARRATION</th>
              <th className="px-5 py-2.5 font-medium">AMOUNT</th>
              <th className="px-5 py-2.5 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{e.entry_number}</td>
                <td className="px-5 py-3 text-slate-600">{e.entry_date}</td>
                <td className="px-5 py-3 text-slate-600">{e.narration || '—'}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{formatINR(e.total_debit)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${e.status === 'posted' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
