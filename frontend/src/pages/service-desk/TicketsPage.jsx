import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Send, Lock, AlertTriangle } from 'lucide-react'
import { serviceDeskApi, branchesApi, usersApi, salesCrmApi } from '../../api/services'

export function PriorityPill({ priority }) {
  const map = {
    urgent: 'text-red-700 bg-red-50',
    high: 'text-orange-700 bg-orange-50',
    medium: 'text-amber-700 bg-amber-50',
    low: 'text-slate-600 bg-slate-100',
  }
  return <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${map[priority] || map.low}`}>{priority}</span>
}

export function StatusPill({ status }) {
  const map = {
    open: 'text-blue-700 bg-blue-50',
    in_progress: 'text-amber-700 bg-amber-50',
    on_hold: 'text-slate-600 bg-slate-100',
    resolved: 'text-green-700 bg-green-50',
    closed: 'text-slate-500 bg-slate-100',
  }
  const label = status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${map[status] || map.open}`}>{label}</span>
}

const STATUSES = ['open', 'in_progress', 'on_hold', 'resolved', 'closed']
const PRIORITIES = ['urgent', 'high', 'medium', 'low']

export default function TicketsPage() {
  const [tickets, setTickets] = useState([])
  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [activeTicketId, setActiveTicketId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = { search: search || undefined }
    if (statusFilter !== 'All') params.status = statusFilter
    if (priorityFilter !== 'All') params.priority = priorityFilter
    serviceDeskApi.listTickets(params).then((res) => setTickets(res.data)).finally(() => setLoading(false))
  }, [search, statusFilter, priorityFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    branchesApi.list().then((res) => setBranches(res.data))
    serviceDeskApi.listCategories().then((res) => setCategories(res.data))
    usersApi.list().then((res) => setUsers(res.data))
    salesCrmApi.listCustomers({}).then((res) => setCustomers(res.data)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="flex-1 max-w-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Status: All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Priority: All</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Plus size={15} /> New ticket
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">TICKET</th>
              <th className="px-5 py-3 font-medium">CUSTOMER</th>
              <th className="px-5 py-3 font-medium">ASSIGNEE</th>
              <th className="px-5 py-3 font-medium">PRIORITY</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {!loading && tickets.map((t) => (
              <tr
                key={t.id}
                onClick={() => setActiveTicketId(t.id)}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{t.ticket_number} — {t.subject}</p>
                  <p className="text-xs text-slate-400">{t.category_name || 'Uncategorized'} · {t.branch_name}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{t.customer_name || '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">{t.assignee_name || 'Unassigned'}</td>
                <td className="px-5 py-3.5"><PriorityPill priority={t.priority} /></td>
                <td className="px-5 py-3.5"><StatusPill status={t.status} /></td>
                <td className="px-5 py-3.5">
                  {(t.is_response_breached || t.is_resolution_breached) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <AlertTriangle size={13} /> Breached
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">On track</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && tickets.length === 0 && (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">No tickets match these filters.</p>
        )}
      </div>

      {createOpen && (
        <CreateTicketModal
          branches={branches}
          categories={categories}
          customers={customers}
          users={users}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load() }}
        />
      )}

      {activeTicketId && (
        <TicketDetailModal
          ticketId={activeTicketId}
          users={users}
          onClose={() => setActiveTicketId(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  )
}

function CreateTicketModal({ branches, categories, customers, users, onClose, onCreated }) {
  const [form, setForm] = useState({
    branch_id: branches[0]?.id || '',
    customer_id: '',
    category_id: '',
    subject: '',
    description: '',
    priority: 'medium',
    assigned_to_user_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleCreate = async () => {
    setSaving(true)
    setError('')
    try {
      await serviceDeskApi.createTicket({
        branch_id: Number(form.branch_id),
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        assigned_to_user_id: form.assigned_to_user_id ? Number(form.assigned_to_user_id) : null,
      })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <Field label="Subject" required>
            <input className="input" value={form.subject} onChange={(e) => update('subject', e.target.value)} placeholder="Short summary of the issue" />
          </Field>
          <Field label="Description">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Details" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch" required>
              <select className="input" value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className="input" value={form.category_id} onChange={(e) => update('category_id', e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Customer">
              <select className="input" value={form.customer_id} onChange={(e) => update('customer_id', e.target.value)}>
                <option value="">Internal</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Assign to">
            <select className="input" value={form.assigned_to_user_id} onChange={(e) => update('assigned_to_user_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !form.subject || !form.branch_id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create ticket
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
      `}</style>
    </div>
  )
}

function TicketDetailModal({ ticketId, users, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null)
  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  const load = useCallback(() => {
    serviceDeskApi.getTicket(ticketId).then((res) => setTicket(res.data))
  }, [ticketId])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (status) => {
    await serviceDeskApi.updateTicketStatus(ticketId, { status })
    load()
    onChanged()
  }

  const handleSendComment = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      await serviceDeskApi.addComment(ticketId, { message, is_internal: isInternal })
      setMessage('')
      load()
      onChanged()
    } finally {
      setSending(false)
    }
  }

  if (!ticket) return null

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-400">{ticket.ticket_number}</p>
            <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityPill priority={ticket.priority} />
            <StatusPill status={ticket.status} />
            {(ticket.is_response_breached || ticket.is_resolution_breached) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangle size={13} /> SLA breached
              </span>
            )}
          </div>
          {ticket.description && <p className="text-sm text-slate-600">{ticket.description}</p>}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Status:</label>
            <select
              className="text-sm border border-slate-200 rounded-lg px-2 py-1"
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {ticket.comments.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No comments yet.</p>}
          {ticket.comments.map((c) => (
            <div key={c.id} className={`rounded-lg px-3 py-2.5 text-sm ${c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-medium text-slate-800 text-xs">{c.user_name}</span>
                {c.is_internal && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                    <Lock size={10} /> Internal note
                  </span>
                )}
              </div>
              <p className="text-slate-700">{c.message}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a reply or internal note..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm mb-2"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded border-slate-300" />
              Internal note (not visible to customer)
            </label>
            <button
              onClick={handleSendComment}
              disabled={sending || !message.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
            >
              <Send size={13} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
