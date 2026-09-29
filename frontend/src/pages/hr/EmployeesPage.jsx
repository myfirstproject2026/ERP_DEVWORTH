import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { hrApi, branchesApi } from '../../api/services'

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern']
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say']
const STATUSES = ['active', 'on_leave', 'resigned', 'terminated']

function label(v) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [stats, setStats] = useState(null)
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = { search: search || undefined }
    if (deptFilter !== 'All') params.department_id = deptFilter
    if (statusFilter !== 'All') params.status = statusFilter
    Promise.all([hrApi.listEmployees(params), hrApi.employeeStats()])
      .then(([e, s]) => { setEmployees(e.data); setStats(s.data) })
      .finally(() => setLoading(false))
  }, [search, deptFilter, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    hrApi.listDepartments().then((res) => setDepartments(res.data))
    branchesApi.list().then((res) => setBranches(res.data))
  }, [])

  const handleDelete = async (emp) => {
    if (!window.confirm(`Remove ${emp.full_name} from employee records?`)) return
    try {
      await hrApi.removeEmployee(emp.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not remove employee')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-4 gap-4 flex-1 mr-4">
          <StatCard label="Total employees" value={stats?.total_employees} />
          <StatCard label="Active" value={stats?.active_employees} valueColor="text-green-600" />
          <StatCard label="On leave today" value={stats?.on_leave_today} valueColor="text-amber-600" />
          <StatCard label="New hires this month" value={stats?.new_hires_this_month} />
        </div>
        <button
          onClick={() => { setEditingEmployee(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium h-fit"
        >
          <Plus size={15} /> Add employee
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
            />
          </div>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Department: All</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Status: All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">EMPLOYEE</th>
              <th className="px-5 py-3 font-medium">DESIGNATION</th>
              <th className="px-5 py-3 font-medium">DEPARTMENT</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && employees.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {e.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{e.full_name}</p>
                      <p className="text-xs text-slate-400">{e.employee_code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-700">{e.designation}</td>
                <td className="px-5 py-3.5 text-slate-600">{e.department_name || '—'}</td>
                <td className="px-5 py-3.5 text-slate-600">{e.branch_name}</td>
                <td className="px-5 py-3.5">
                  <StatusPill status={e.status} />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Pencil} onClick={() => { setEditingEmployee(e); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(e)} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && employees.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No employees found.</p>
        )}
      </div>

      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          departments={departments}
          branches={branches}
          employees={employees}
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

function IconButton({ icon: Icon, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500'
      }`}
    >
      <Icon size={14} />
    </button>
  )
}

function StatusPill({ status }) {
  const map = {
    active: 'text-green-600 bg-green-50',
    on_leave: 'text-amber-600 bg-amber-50',
    resigned: 'text-slate-500 bg-slate-100',
    terminated: 'text-red-600 bg-red-50',
  }
  const dot = { active: 'bg-green-500', on_leave: 'bg-amber-500', resigned: 'bg-slate-400', terminated: 'bg-red-500' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {label(status)}
    </span>
  )
}

function EmployeeModal({ employee, departments, branches, employees, onClose, onSaved }) {
  const isEdit = Boolean(employee)
  const [form, setForm] = useState({
    full_name: employee?.full_name || '',
    designation: employee?.designation || '',
    branch_id: employee?.branch_id || branches[0]?.id || '',
    department_id: employee?.department_id || '',
    employment_type: employee?.employment_type || 'full_time',
    date_of_joining: employee?.date_of_joining || new Date().toISOString().slice(0, 10),
    gender: employee?.gender || '',
    phone: employee?.phone || '',
    personal_email: employee?.personal_email || '',
    reporting_manager_id: employee?.reporting_manager_id || '',
    ctc_annual: employee?.ctc_annual || '',
    status: employee?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        branch_id: Number(form.branch_id),
        department_id: form.department_id ? Number(form.department_id) : null,
        reporting_manager_id: form.reporting_manager_id ? Number(form.reporting_manager_id) : null,
        gender: form.gender || null,
        ctc_annual: form.ctc_annual ? Number(form.ctc_annual) : null,
      }
      if (isEdit) {
        await hrApi.updateEmployee(employee.id, payload)
      } else {
        delete payload.status
        await hrApi.createEmployee(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit employee' : 'Add employee'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name" required>
              <input className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="e.g. Suresh Babu" />
            </Field>
            <Field label="Designation" required>
              <input className="input" value={form.designation} onChange={(e) => update('designation', e.target.value)} placeholder="e.g. Production Operator" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch" required>
              <select className="input" value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select className="input" value={form.department_id} onChange={(e) => update('department_id', e.target.value)}>
                <option value="">Unassigned</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employment type">
              <select className="input" value={form.employment_type} onChange={(e) => update('employment_type', e.target.value)}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </Field>
            <Field label="Date of joining" required>
              <input type="date" className="input" value={form.date_of_joining} onChange={(e) => update('date_of_joining', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 90000 00000" />
            </Field>
            <Field label="Personal email">
              <input type="email" className="input" value={form.personal_email} onChange={(e) => update('personal_email', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Gender">
              <select className="input" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
                {GENDERS.map((g) => <option key={g} value={g}>{label(g)}</option>)}
              </select>
            </Field>
            <Field label="Reporting manager">
              <select className="input" value={form.reporting_manager_id} onChange={(e) => update('reporting_manager_id', e.target.value)}>
                <option value="">None</option>
                {employees.filter((e) => e.id !== employee?.id).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Annual CTC (₹)">
            <input type="number" className="input" value={form.ctc_annual} onChange={(e) => update('ctc_annual', e.target.value)} placeholder="e.g. 480000" />
          </Field>
          {isEdit && (
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.full_name || !form.designation}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Add employee'}
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
