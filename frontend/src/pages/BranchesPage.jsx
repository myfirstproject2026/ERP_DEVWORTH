import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Eye, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { branchesApi, usersApi } from  "../api/services";

const BRANCH_TYPES = ['Head Office', 'Warehouse', 'Sales Office', 'Plant', 'Depot', 'Other']
const STATES = ['Tamil Nadu', 'Karnataka', 'Telangana', 'Maharashtra', 'Delhi', 'Gujarat', 'Kerala', 'Other']

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      branchesApi.list({ search: search || undefined, status: statusFilter }),
      branchesApi.stats(),
    ])
      .then(([b, s]) => {
        setBranches(b.data)
        setStats(s.data)
      })
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { usersApi.list().then((res) => setUsers(res.data)) }, [])

  const handleDelete = async (branch) => {
    if (!window.confirm(`Delete ${branch.branch_name}? This cannot be undone.`)) return
    try {
      await branchesApi.remove(branch.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete branch')
    }
  }

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Login &amp; Company Setup / <span className="text-brand-600 font-medium">Branches</span>
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Branches</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats?.total_branches ?? 0} branches across your operating states.
          </p>
        </div>
        <button
          onClick={() => { setEditingBranch(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> Add branch
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard label="Total branches" value={stats?.total_branches} />
        <StatCard label="Active" value={stats?.active_branches} valueColor="text-green-600" />
        <StatCard label="Inactive" value={stats?.inactive_branches} valueColor="text-amber-600" />
        <StatCard label="Total staff across branches" value={stats?.total_staff} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branches..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
          >
            <option value="All">Status: All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">MANAGER</th>
              <th className="px-5 py-3 font-medium">USERS</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && branches.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {b.branch_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{b.branch_name}</p>
                      <p className="text-xs text-slate-400">{b.address}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-700">{b.manager_name || '—'}</td>
                <td className="px-5 py-3.5 text-slate-700">{b.users_count}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    b.status === 'active' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    {b.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Eye} />
                    <IconButton icon={Pencil} onClick={() => { setEditingBranch(b); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(b)} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && (
          <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-400">
            <span>Showing 1–{branches.length} of {branches.length} branches</span>
          </div>
        )}
      </div>

      {modalOpen && (
        <BranchModal
          branch={editingBranch}
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

function BranchModal({ branch, users, onClose, onSaved }) {
  const isEdit = Boolean(branch)
  const [form, setForm] = useState({
    branch_name: branch?.branch_name || '',
    branch_type: branch?.branch_type || 'Warehouse',
    address: branch?.address || '',
    city: branch?.city || '',
    state: branch?.state || STATES[0],
    manager_user_id: branch?.manager_user_id || '',
    gstin: branch?.gstin || '',
    is_default: branch?.is_default || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, manager_user_id: form.manager_user_id || null }
      if (isEdit) {
        await branchesApi.update(branch.id, payload)
      } else {
        await branchesApi.create(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save branch')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit branch' : 'Add branch'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <Field label="Branch name" required>
            <input className="input" value={form.branch_name} onChange={(e) => update('branch_name', e.target.value)} placeholder="e.g. Madurai Warehouse" />
          </Field>
          <Field label="Branch type">
            <select className="input" value={form.branch_type} onChange={(e) => update('branch_type', e.target.value)}>
              {BRANCH_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Address" required>
            <textarea className="input" rows={2} value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street, area, landmark" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" required>
              <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </Field>
            <Field label="State" required>
              <select className="input" value={form.state} onChange={(e) => update('state', e.target.value)}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Branch manager">
            <select className="input" value={form.manager_user_id} onChange={(e) => update('manager_user_id', e.target.value)}>
              <option value="">Select user...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
          <Field label="GSTIN for this branch (if different)">
            <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value)} placeholder="Optional — inherits company GSTIN" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.is_default} onChange={(e) => update('is_default', e.target.checked)} className="rounded border-slate-300" />
            Set as active branch
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.branch_name || !form.address || !form.city}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save branch
          </button>
        </div>
      </div>
      <style>{`
        .input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
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
