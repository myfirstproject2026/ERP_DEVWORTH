import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, X, Loader2, ArrowRightCircle } from 'lucide-react'
import { salesCrmApi, usersApi } from '../../api/services'
import { StagePill } from './SalesOverviewPage'

const SOURCES = ['website', 'referral', 'cold_call', 'social_media', 'trade_show', 'other']
const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      salesCrmApi.listLeads({ search: search || undefined, status: statusFilter }),
      salesCrmApi.leadStats(),
    ])
      .then(([l, s]) => { setLeads(l.data); setStats(s.data) })
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { usersApi.list().then((res) => setUsers(res.data)) }, [])

  const handleConvert = async (lead) => {
    if (!window.confirm(`Convert "${lead.lead_name}" into a customer?`)) return
    try {
      await salesCrmApi.convertLead(lead.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not convert lead')
    }
  }

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead "${lead.lead_name}"?`)) return
    try {
      await salesCrmApi.removeLead(lead.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete lead')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-4 gap-4 flex-1 mr-4">
          <StatCard label="Total leads" value={stats?.total_leads} />
          <StatCard label="New" value={stats?.new_leads} valueColor="text-blue-600" />
          <StatCard label="Qualified" value={stats?.qualified_leads} valueColor="text-purple-600" />
          <StatCard label="Won" value={stats?.won_leads} valueColor="text-green-600" />
        </div>
        <button
          onClick={() => { setEditingLead(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium h-fit"
        >
          <Plus size={15} /> New lead
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Stage: All</option>
            {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">LEAD</th>
              <th className="px-5 py-3 font-medium">CONTACT</th>
              <th className="px-5 py-3 font-medium">SOURCE</th>
              <th className="px-5 py-3 font-medium">EST. VALUE</th>
              <th className="px-5 py-3 font-medium">STAGE</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && leads.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{l.lead_name}</p>
                  <p className="text-xs text-slate-400">{l.company_name || '—'}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  <p>{l.phone || '—'}</p>
                  <p className="text-xs text-slate-400">{l.email || ''}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600 capitalize">{l.source.replace('_', ' ')}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(l.estimated_value)}</td>
                <td className="px-5 py-3.5"><StagePill status={l.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {!l.converted_customer_id && l.status !== 'lost' && (
                      <IconButton icon={ArrowRightCircle} onClick={() => handleConvert(l)} title="Convert to customer" />
                    )}
                    <IconButton icon={Pencil} onClick={() => { setEditingLead(l); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(l)} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && leads.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No leads found.</p>
        )}
      </div>

      {modalOpen && (
        <LeadModal
          lead={editingLead}
          users={users}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, valueColor }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <p className={`text-2xl font-bold ${valueColor || 'text-slate-900'}`}>{value ?? '—'}</p>
    </div>
  )
}

function IconButton({ icon: Icon, onClick, danger, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500'
      }`}
    >
      <Icon size={14} />
    </button>
  )
}

function LeadModal({ lead, users, onClose, onSaved }) {
  const isEdit = Boolean(lead)
  const [form, setForm] = useState({
    lead_name: lead?.lead_name || '',
    company_name: lead?.company_name || '',
    contact_person: lead?.contact_person || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    source: lead?.source || 'website',
    status: lead?.status || 'new',
    estimated_value: lead?.estimated_value || 0,
    assigned_to_user_id: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, assigned_to_user_id: form.assigned_to_user_id || null, estimated_value: Number(form.estimated_value) }
      if (isEdit) {
        const { lead_name, company_name, contact_person, email, phone, source, status, estimated_value, assigned_to_user_id, notes } = payload
        await salesCrmApi.updateLead(lead.id, { lead_name, company_name, contact_person, email, phone, source, status, estimated_value, assigned_to_user_id, notes })
      } else {
        await salesCrmApi.createLead(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit lead' : 'New lead'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <Field label="Lead / contact name" required>
            <input className="input" value={form.lead_name} onChange={(e) => update('lead_name', e.target.value)} placeholder="e.g. Vikram Shah" />
          </Field>
          <Field label="Company name">
            <input className="input" value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="e.g. Shah Industries" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 90000 00000" />
            </Field>
            <Field label="Email">
              <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Source">
              <select className="input" value={form.source} onChange={(e) => update('source', e.target.value)}>
                {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Estimated value (₹)">
              <input type="number" className="input" value={form.estimated_value} onChange={(e) => update('estimated_value', e.target.value)} />
            </Field>
          </div>
          {isEdit && (
            <Field label="Stage">
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
          )}
          <Field label="Assigned to">
            <select className="input" value={form.assigned_to_user_id} onChange={(e) => update('assigned_to_user_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.lead_name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create lead'}
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
