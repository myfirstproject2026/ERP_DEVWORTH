import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building2, CalendarDays, Wallet, Check, XCircle, Plus, Pencil, Trash2 } from 'lucide-react'
import { hrApi } from '../../api/services'

export default function HrOverviewPage() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  const load = () => {
    setLoading(true)
    hrApi.listLeaveRequests({ status: 'pending' }).then((res) => setPending(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const decide = async (id, status) => {
    setActioning(id)
    try {
      await hrApi.decideLeaveRequest(id, { status })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update request')
    } finally {
      setActioning(null)
    }
  }

  const quickLinks = [
    { to: '/hr/employees', label: 'Employees', icon: Users, desc: 'View and manage employee records' },
    { to: '/hr/departments', label: 'Departments', icon: Building2, desc: 'Organize teams and department heads' },
    { to: '/hr/attendance', label: 'Attendance', icon: CalendarDays, desc: 'Mark daily attendance by branch' },
    { to: '/hr/payslips', label: 'Payslips', icon: Wallet, desc: 'Generate and track monthly payslips' },
  ]

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Pending leave requests</h3>
          <Link to="/hr/leave" className="text-xs text-brand-600 font-medium">View all</Link>
        </div>
        {!loading && pending.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No pending requests — all caught up.</p>
        )}
        <div>
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 last:border-0">
              <div>
                <p className="font-medium text-slate-800 text-sm">{r.employee_name}</p>
                <p className="text-xs text-slate-400">
                  {r.leave_type_name} · {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`} · {r.total_days} day{r.total_days == 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => decide(r.id, 'approved')}
                  disabled={actioning === r.id}
                  className="h-8 w-8 rounded-lg border border-green-200 text-green-600 flex items-center justify-center hover:bg-green-50 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => decide(r.id, 'rejected')}
                  disabled={actioning === r.id}
                  className="h-8 w-8 rounded-lg border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>
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

      <CompanyLeaveTypes />
    </div>
  )
}

function CompanyLeaveTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ leave_type_name: '', annual_quota: '0', is_paid: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)

  const load = () => {
    setLoading(true)
    hrApi.listLeaveTypes().then((res) => setTypes(res.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const emptyForm = { leave_type_name: '', annual_quota: '0', is_paid: true }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm((v) => !v)
  }

  const openEdit = (t) => {
    setEditingId(t.id)
    setForm({ leave_type_name: t.leave_type_name, annual_quota: String(t.annual_quota), is_paid: t.is_paid })
    setError('')
    setShowForm(true)
  }

  const remove = async (t) => {
    if (!window.confirm(`Delete leave type "${t.leave_type_name}"?`)) return
    try {
      await hrApi.deleteLeaveType(t.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete leave type')
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        leave_type_name: form.leave_type_name.trim(),
        annual_quota: Number(form.annual_quota) || 0,
        is_paid: form.is_paid,
      }
      if (editingId) await hrApi.updateLeaveType(editingId, payload)
      else await hrApi.createLeaveType(payload)
      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create leave type')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">Company Leave Types</h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium"
        >
          <Plus size={14} /> Create Leave Type
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div className="grid grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Leave type name *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                maxLength={60}
                value={form.leave_type_name}
                onChange={(e) => setForm((f) => ({ ...f, leave_type_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Annual quota (days)</label>
              <input
                type="number" min="0" step="0.5"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={form.annual_quota}
                onChange={(e) => setForm((f) => ({ ...f, annual_quota: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
              <input
                type="checkbox" checked={form.is_paid}
                onChange={(e) => setForm((f) => ({ ...f, is_paid: e.target.checked }))}
              />
              Paid leave
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.leave_type_name.trim()}
                className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && types.length === 0 && (
        <p className="px-5 py-8 text-sm text-slate-400 text-center">No leave types yet. Create one to get started.</p>
      )}
      {types.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">LEAVE TYPE</th>
              <th className="px-5 py-3 font-medium">ANNUAL QUOTA</th>
              <th className="px-5 py-3 font-medium">PAID</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{t.leave_type_name}</td>
                <td className="px-5 py-3 text-slate-600">{t.annual_quota} days/yr</td>
                <td className="px-5 py-3 text-slate-600">{t.is_paid ? 'Paid' : 'Unpaid'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openEdit(t)}
                      title="Edit"
                      className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(t)}
                      title="Delete"
                      className="h-8 w-8 rounded-lg border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
