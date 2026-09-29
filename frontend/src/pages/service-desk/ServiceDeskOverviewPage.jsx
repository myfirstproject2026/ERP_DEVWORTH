import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket as TicketIcon, Tags, Timer, AlertTriangle } from 'lucide-react'
import { serviceDeskApi } from '../../api/services'
import { PriorityPill, StatusPill } from './TicketsPage'

export default function ServiceDeskOverviewPage() {
  const [urgentTickets, setUrgentTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    serviceDeskApi.listTickets({ status: 'All' }).then((res) => {
      const openOnes = res.data.filter((t) => ['open', 'in_progress', 'on_hold'].includes(t.status))
      const sorted = openOnes.sort((a, b) => {
        const aFlag = (a.is_response_breached || a.is_resolution_breached) ? 1 : 0
        const bFlag = (b.is_response_breached || b.is_resolution_breached) ? 1 : 0
        if (aFlag !== bFlag) return bFlag - aFlag
        const order = { urgent: 0, high: 1, medium: 2, low: 3 }
        return order[a.priority] - order[b.priority]
      })
      setUrgentTickets(sorted.slice(0, 6))
    }).finally(() => setLoading(false))
  }, [])

  const quickLinks = [
    { to: '/service-desk/tickets', label: 'Tickets', icon: TicketIcon, desc: 'View, create, and triage support tickets' },
    { to: '/service-desk/categories', label: 'Categories', icon: Tags, desc: 'Organize tickets by issue type' },
    { to: '/service-desk/sla-policies', label: 'SLA Policies', icon: Timer, desc: 'Response and resolution time targets by priority' },
  ]

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Needs attention</h3>
          <Link to="/service-desk/tickets" className="text-xs text-brand-600 font-medium">View all</Link>
        </div>
        {!loading && urgentTickets.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No open tickets — all caught up.</p>
        )}
        <div>
          {urgentTickets.map((t) => (
            <Link
              key={t.id}
              to="/service-desk/tickets"
              className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                {(t.is_response_breached || t.is_resolution_breached) && (
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                )}
                <div>
                  <p className="font-medium text-slate-800 text-sm">{t.ticket_number} — {t.subject}</p>
                  <p className="text-xs text-slate-400">{t.customer_name || 'Internal'} · {t.category_name || 'Uncategorized'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PriorityPill priority={t.priority} />
                <StatusPill status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <q.icon size={16} />
            </div>
            <div>
              <p className="font-medium text-slate-800 text-sm">{q.label}</p>
              <p className="text-xs text-slate-400">{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
