import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Landmark, AlertTriangle, Download, ChevronDown, FileText, FileSpreadsheet, Sparkles, MessageCircle } from 'lucide-react'
import { dashboardApi, companyApi } from  "../api/services";
import { useAuth } from '../context/AuthContext'

function formatINR(value) {
  const n = Number(value)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [pl, setPl] = useState([])
  const [production, setProduction] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [followup, setFollowup] = useState([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportError, setExportError] = useState('')
  const exportRef = useRef(null)

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      dashboardApi.profitLoss(),
      dashboardApi.production(),
      dashboardApi.attendance(),
      dashboardApi.customerFollowup(),
      companyApi.getProfile(),
    ])
      .then(([s, p, prod, att, fu, comp]) => {
        setSummary(s.data)
        setPl(p.data)
        setProduction(prod.data)
        setAttendance(att.data)
        setFollowup(fu.data)
        setCompanyName(comp.data.company_name)
      })
      .catch((err) => setLoadError(err.response?.data?.detail || 'Could not load dashboard data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const close = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleExport = async (kind) => {
    setExportOpen(false)
    setExportError('')
    try {
      const res = await dashboardApi.exportFile(kind)
      const filename = kind === 'pdf' ? 'DevWorth_Dashboard_Data.pdf' : 'DevWorth_Dashboard_Data.xlsx'
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(`${kind} export failed`, err)
      setExportError(`Could not download the ${kind === 'pdf' ? 'PDF' : 'Excel file'}. Please try again.`)
    }
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) {
    return <div className="p-8 text-slate-400 text-sm">Loading dashboard…</div>
  }

  if (loadError) {
    return <div className="p-8 text-red-600 text-sm">{loadError}</div>
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Good morning, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here's how {companyName} is doing today — {today}.
          </p>
        </div>
        <div className="flex items-center gap-3">
<div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download size={15} /> Export report <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <FileText size={15} className="text-red-500" /> Download PDF
                </button>
                <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <FileSpreadsheet size={15} className="text-green-600" /> Download Excel
                </button>
              </div>
            )}
          </div>
          <Link
            to="/ai-assistant"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Sparkles size={15} /> Ask AI Assistant
          </Link>
        </div>
      </div>

      {exportError && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{exportError}</div>
      )}

      {/* AI Insight banner */}
      <div className="bg-navy-800 text-white rounded-xl px-5 py-4 mb-5 flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-brand-500/30 flex items-center justify-center shrink-0">
          <Sparkles size={15} />
        </div>
        <p className="text-sm text-navy-50 flex-1">
          <span className="text-slate-400 mr-1">AI INSIGHT</span>
          {summary?.ai_insight}
        </p>
        <Link to="/ai-assistant" className="h-9 w-9 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center shrink-0">
          <Sparkles size={15} />
        </Link>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <MetricCard
          icon={<TrendingUp size={16} className="text-green-600" />}
          iconBg="bg-green-50"
          label="Today's sales"
          value={formatINR(summary?.todays_sales)}
          change={`${summary?.sales_change_pct >= 0 ? '+' : ''}${summary?.sales_change_pct}% vs yesterday`}
          positive={summary?.sales_change_pct >= 0}
        />
        <MetricCard
          icon={<TrendingDown size={16} className="text-red-600" />}
          iconBg="bg-red-50"
          label="Today's purchase"
          value={formatINR(summary?.todays_purchase)}
          change={`${summary?.purchase_change_pct}% vs yesterday`}
          positive={summary?.purchase_change_pct >= 0}
        />
        <MetricCard
          icon={<Landmark size={16} className="text-amber-600" />}
          iconBg="bg-amber-50"
          label="Pending payments"
          value={formatINR(summary?.pending_payments)}
          footer={`${summary?.overdue_invoice_count} invoices overdue`}
        />
        <MetricCard
          icon={<AlertTriangle size={16} className="text-red-600" />}
          iconBg="bg-red-50"
          label="Stock alerts"
          value={summary?.stock_alert_count}
          footer={`${summary?.below_reorder_count} items below reorder level`}
          footerColor="text-red-500"
        />
      </div>

      {/* P&L CHART */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 text-sm">Profit &amp; loss — last 6 months</h3>
          <span className="text-xs text-slate-400">₹ in lakhs</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pl} barGap={4}>
            <XAxis dataKey="month_label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip cursor={{ fill: '#f8fafc' }} />
            <Legend
              verticalAlign="bottom"
              iconType="square"
              wrapperStyle={{ fontSize: 12, color: '#64748b' }}
              formatter={(v) => (v === 'revenue_lakhs' ? 'Revenue' : 'Net profit')}
            />
            <Bar dataKey="revenue_lakhs" fill="#dbeafe" radius={[3, 3, 0, 0]} />
            <Bar dataKey="net_profit_lakhs" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* PRODUCTION */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 text-sm">Production status</h3>
            <span className="text-xs text-slate-400">Live work orders</span>
          </div>
          <div className="space-y-4">
            {production.map((p) => (
              <div key={p.wo_number}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{p.wo_number} — {p.product_name} ({p.units.toLocaleString()} units)</span>
                  <span className="text-slate-500">{p.progress_pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.progress_pct > 60 ? 'bg-green-500' : p.progress_pct > 25 ? 'bg-blue-500' : 'bg-amber-500'}`}
                    style={{ width: `${p.progress_pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Stage: {p.stage}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ATTENDANCE */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 text-sm">Employee attendance</h3>
            <span className="text-xs text-slate-400">Today · all branches</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative h-28 w-28 shrink-0">
              <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="#16a34a" strokeWidth="3.5"
                  strokeDasharray={`${(attendance?.present_pct || 0) * 0.973} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-slate-900">{attendance?.present_pct}%</span>
                <span className="text-[10px] text-slate-400">Present</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Present</span><span className="font-semibold text-slate-900">{attendance?.present_count}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">On leave</span><span className="font-semibold text-slate-900">{attendance?.on_leave_count}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Absent</span><span className="font-semibold text-slate-900">{attendance?.absent_count}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMER FOLLOW-UP */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Customer follow-up</h3>
          <button className="text-xs text-brand-600 font-medium">View all</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">CUSTOMER</th>
              <th className="px-5 py-2.5 font-medium">AMOUNT</th>
              <th className="px-5 py-2.5 font-medium">STATUS</th>
              <th className="px-5 py-2.5 font-medium text-right">SEND REMINDER</th>
            </tr>
          </thead>
          <tbody>
            {followup.map((c) => (
              <tr key={c.customer_name} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {c.customer_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{c.customer_name}</p>
                      <p className="text-xs text-slate-400">{c.customer_type} · {c.city}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 font-medium text-slate-800">{formatINR(c.amount)}</td>
                <td className="px-5 py-3">
                  <StatusPill status={c.status} daysOverdue={c.days_overdue} />
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="h-8 w-8 rounded-full bg-green-50 text-green-600 inline-flex items-center justify-center hover:bg-green-100">
                    <MessageCircle size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({ icon, iconBg, label, value, change, positive, footer, footerColor }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {change && (
        <p className={`text-xs mt-1 font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>{change}</p>
      )}
      {footer && <p className={`text-xs mt-1 ${footerColor || 'text-slate-400'}`}>{footer}</p>}
    </div>
  )
}

function StatusPill({ status, daysOverdue }) {
  if (status === 'overdue') {
    return <span className="px-2 py-1 rounded-md bg-red-50 text-red-600 text-xs font-medium">{daysOverdue} days overdue</span>
  }
  if (status === 'due_soon') {
    return <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-600 text-xs font-medium">Due soon</span>
  }
  return <span className="px-2 py-1 rounded-md bg-green-50 text-green-600 text-xs font-medium">Payment received</span>
}
