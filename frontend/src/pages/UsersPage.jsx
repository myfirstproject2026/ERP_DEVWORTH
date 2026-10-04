import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { usersApi } from  "../api/services";

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [branches, setBranches] = useState([])
  const [roles, setRoles] = useState([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const [branchFilter, setBranchFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = { search: search || undefined }
    if (activeTab !== 'All') params.status = activeTab
    if (branchFilter !== 'All') params.branch_id = branchFilter
    if (roleFilter !== 'All') params.role_id = roleFilter

    Promise.all([usersApi.list(params), usersApi.stats()])
      .then(([u, s]) => { setUsers(u.data); setStats(s.data) })
      .finally(() => setLoading(false))
  }, [search, activeTab, branchFilter, roleFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    usersApi.options().then((res) => {
      setBranches(res.data.branches)
      setRoles(res.data.roles)
    })
  }, [])

  const handleDelete = async (user) => {
    if (!window.confirm(`Remove ${user.full_name}?`)) return
    try {
      await usersApi.remove(user.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not remove user')
    }
  }

  const tabs = [
    { key: 'All', label: `All users (${stats?.total_users ?? 0})` },
    { key: 'active', label: `Active (${stats?.active_users ?? 0})` },
    { key: 'invited', label: `Invited (${stats?.invited_users ?? 0})` },
    { key: 'suspended', label: `Suspended (${stats?.suspended_users ?? 0})` },
  ]

  return (
    <div className="p-6 max-w-[1300px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Login &amp; Company Setup / <span className="text-brand-600 font-medium">Users</span>
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats?.total_users ?? 0} users across {branches.length} branches.
          </p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> Invite user
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex gap-6 px-5 pt-4 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 p-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
            />
          </div>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Branch: All</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Role: All</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">USER</th>
              <th className="px-5 py-3 font-medium">ROLE</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {u.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.full_name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-medium">{u.role_name}</span>
                </td>
                <td className="px-5 py-3.5 text-slate-700">{u.branch_name || '—'}</td>
                <td className="px-5 py-3.5">
                  <StatusPill status={u.status} />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Pencil} onClick={() => { setEditingUser(u); setModalOpen(true) }} />
                    {!u.is_owner && <IconButton icon={Trash2} onClick={() => handleDelete(u)} danger />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && (
          <div className="px-5 py-3 text-xs text-slate-400">Showing 1–{users.length} of {users.length} users</div>
        )}
      </div>

      {modalOpen && (
        <UserModal
          user={editingUser}
          branches={branches}
          roles={roles}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    active: 'text-green-600 bg-green-50',
    invited: 'text-amber-600 bg-amber-50',
    suspended: 'text-red-600 bg-red-50',
  }
  const dot = {
    active: 'bg-green-500',
    invited: 'bg-amber-500',
    suspended: 'bg-red-500',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
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

function UserModal({ user, branches, roles, onClose, onSaved }) {
  const isEdit = Boolean(user)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    mobile_number: user?.mobile_number || '',
    email: user?.email || '',
    password: '',
    role_id: user?.role_id || roles[0]?.id || '',
    branch_id: user?.branch_id || branches[0]?.id || '',
    login_method: 'email_invite',
    send_whatsapp_notification: true,
    status: user?.status,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await usersApi.update(user.id, {
          full_name: form.full_name,
          mobile_number: form.mobile_number,
          email: form.email,
          role_id: Number(form.role_id),
          branch_id: Number(form.branch_id),
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await usersApi.invite({
          full_name: form.full_name,
          mobile_number: form.mobile_number,
          email: form.email,
          password: form.password,
          role_id: Number(form.role_id),
          branch_id: Number(form.branch_id),
          login_method: form.login_method,
          send_whatsapp_notification: form.send_whatsapp_notification,
        })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit user' : 'Invite user'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name" required>
              <input className="input" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="e.g. Suresh Babu" />
            </Field>
            <Field label="Mobile number">
              <input className="input" value={form.mobile_number} onChange={(e) => update('mobile_number', e.target.value)} placeholder="+91 90000 00000" />
            </Field>
          </div>
          <Field label="Email address" required>
            <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label={isEdit ? 'New password' : 'Password'} required={!isEdit}>
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" required>
              <select className="input" value={form.role_id} onChange={(e) => update('role_id', e.target.value)}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
              </select>
            </Field>
            <Field label="Branch" required>
              <select className="input" value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
          </div>

          {isEdit ? (
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
          ) : (
            <>
              <Field label="Login method">
                <select className="input" value={form.login_method} onChange={(e) => update('login_method', e.target.value)}>
                  <option value="email_invite">Email + password</option>
                  <option value="password">Password only</option>
                  <option value="otp">OTP login (password kept as fallback)</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.send_whatsapp_notification}
                  onChange={(e) => update('send_whatsapp_notification', e.target.checked)}
                  className="rounded border-slate-300"
                />
                Send WhatsApp notification with login link
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.full_name || !form.email || !form.role_id || !form.branch_id || (!isEdit && form.password.length < 8) || (isEdit && form.password && form.password.length < 8)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Send invite'}
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
