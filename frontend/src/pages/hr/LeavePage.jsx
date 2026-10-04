import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Check, XCircle } from 'lucide-react'
import { hrApi } from '../../api/services'

export default function LeavePage() {
  const [requests, setRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [leaveTypes, setLeaveTypes] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = statusFilter !== 'All' ? { status: statusFilter } : {}
    hrApi.listLeaveRequests(params).then((res) => setRequests(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    hrApi.listEmployees().then((res) => setEmployees(res.data))
    hrApi.listLeaveTypes().then((res) => setLeaveTypes(res.data))
  }, [])

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {['All', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            hrApi.listLeaveTypes().then((res) => setLeaveTypes(res.data)).finally(() => setModalOpen(true))
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New leave request
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">EMPLOYEE</th>
              <th className="px-5 py-3 font-medium">TYPE</th>
              <th className="px-5 py-3 font-medium">DATES</th>
              <th className="px-5 py-3 font-medium">DAYS</th>
              <th className="px-5 py-3 font-medium">REASON</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{r.employee_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{r.leave_type_name}</td>
                <td className="px-5 py-3.5 text-slate-600">
                  {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`}
                </td>
                <td className="px-5 py-3.5 text-slate-700">{r.total_days}</td>
                <td className="px-5 py-3.5 text-slate-500 max-w-[180px] truncate">{r.reason || '—'}</td>
                <td className="px-5 py-3.5"><StatusPill status={r.status} /></td>
                <td className="px-5 py-3.5">
                  {r.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-1.5">
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
                  ) : (
                    <span className="text-xs text-slate-400 block text-right">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && requests.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No leave requests found.</p>
        )}
      </div>

      {modalOpen && (
        <LeaveRequestModal
          employees={employees}
          leaveTypes={leaveTypes}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    pending: 'text-amber-600 bg-amber-50',
    approved: 'text-green-600 bg-green-50',
    rejected: 'text-red-600 bg-red-50',
    cancelled: 'text-slate-500 bg-slate-100',
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function LeaveRequestModal({ employees, leaveTypes, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    leave_type_id: leaveTypes[0]?.id || '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await hrApi.createLeaveRequest({
        ...form,
        employee_id: Number(form.employee_id),
        leave_type_id: Number(form.leave_type_id),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit leave request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New leave request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee *</label>
            <select className="input" value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Leave type *</label>
            <select className="input" value={form.leave_type_id} onChange={(e) => update('leave_type_id', e.target.value)}>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.leave_type_name} ({t.annual_quota} days/yr)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start date *</label>
              <input type="date" className="input" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End date *</label>
              <input type="date" className="input" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
            <textarea className="input" rows={2} value={form.reason} onChange={(e) => update('reason', e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.employee_id || !form.leave_type_id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Submit request
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
