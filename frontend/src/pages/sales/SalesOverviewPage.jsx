import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users2, FileText, ShoppingCart, Receipt, ArrowRight } from 'lucide-react'
import { salesCrmApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function SalesOverviewPage() {
  const [leads, setLeads] = useState([])
  const [quotations, setQuotations] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      salesCrmApi.listLeads(),
      salesCrmApi.listQuotations(),
      salesCrmApi.listInvoices(),
    ])
      .then(([l, q, i]) => {
        setLeads(l.data.slice(0, 5))
        setQuotations(q.data.slice(0, 5))
        setInvoices(i.data.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  const quickLinks = [
    { to: '/sales/leads', label: 'New lead', icon: UserPlus, color: 'bg-blue-50 text-blue-600' },
    { to: '/sales/customers', label: 'New customer', icon: Users2, color: 'bg-purple-50 text-purple-600' },
    { to: '/sales/quotations', label: 'New quotation', icon: FileText, color: 'bg-amber-50 text-amber-600' },
    { to: '/sales/orders', label: 'New sales order', icon: ShoppingCart, color: 'bg-green-50 text-green-600' },
    { to: '/sales/invoices', label: 'New invoice', icon: Receipt, color: 'bg-red-50 text-red-600' },
  ]

  return (
    <div>
      <div className="grid grid-cols-5 gap-4 mb-6">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className={`h-9 w-9 rounded-lg ${q.color} flex items-center justify-center mb-3`}>
              <q.icon size={16} />
            </div>
            <p className="text-sm font-medium text-slate-800">{q.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <ActivityCard
          title="Recent leads"
          viewAllTo="/sales/leads"
          loading={loading}
          rows={leads.map((l) => ({
            id: l.id,
            title: l.lead_name,
            subtitle: l.company_name || '—',
            right: <StagePill status={l.status} />,
          }))}
          empty="No leads yet"
        />
        <ActivityCard
          title="Recent quotations"
          viewAllTo="/sales/quotations"
          loading={loading}
          rows={quotations.map((q) => ({
            id: q.id,
            title: q.quotation_number,
            subtitle: q.customer_name,
            right: <span className="text-sm font-medium text-slate-700">{formatINR(q.total_amount)}</span>,
          }))}
          empty="No quotations yet"
        />
        <ActivityCard
          title="Recent invoices"
          viewAllTo="/sales/invoices"
          loading={loading}
          rows={invoices.map((i) => ({
            id: i.id,
            title: i.invoice_number,
            subtitle: i.customer_name,
            right: <InvoiceStatusPill status={i.status} />,
          }))}
          empty="No invoices yet"
        />
      </div>
    </div>
  )
}

function ActivityCard({ title, viewAllTo, rows, loading, empty }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        <Link to={viewAllTo} className="text-xs text-brand-600 font-medium flex items-center gap-1">
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="divide-y divide-slate-50">
        {!loading && rows.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400 text-center">{empty}</p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{r.title}</p>
              <p className="text-xs text-slate-400">{r.subtitle}</p>
            </div>
            {r.right}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StagePill({ status }) {
  const map = {
    new: 'bg-blue-50 text-blue-600',
    contacted: 'bg-amber-50 text-amber-600',
    qualified: 'bg-purple-50 text-purple-600',
    proposal: 'bg-indigo-50 text-indigo-600',
    won: 'bg-green-50 text-green-600',
    lost: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || map.new}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export function InvoiceStatusPill({ status }) {
  const map = {
    draft: 'bg-slate-100 text-slate-500',
    sent: 'bg-blue-50 text-blue-600',
    partially_paid: 'bg-amber-50 text-amber-600',
    paid: 'bg-green-50 text-green-600',
    overdue: 'bg-red-50 text-red-600',
    cancelled: 'bg-slate-100 text-slate-400',
  }
  const labels = {
    draft: 'Draft', sent: 'Sent', partially_paid: 'Partially paid',
    paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || map.draft}`}>
      {labels[status] || status}
    </span>
  )
}
