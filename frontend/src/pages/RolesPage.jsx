import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { rolesApi } from '../api/services'

const ACCESS_LABELS = {
  full: { label: 'Full access', className: 'text-purple-700 bg-purple-50' },
  high: { label: 'High access', className: 'text-blue-700 bg-blue-50' },
  medium: { label: 'Medium access', className: 'text-amber-700 bg-amber-50' },
  limited: { label: 'Limited access', className: 'text-slate-600 bg-slate-100' },
}

export default function RolesPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    rolesApi.list().then((res) => setRoles(res.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.role_name}"?`)) return
    try {
      await rolesApi.remove(role.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete role')
    }
  }

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Login &amp; Company Setup / <span className="text-brand-600 font-medium">Roles &amp; Permissions</span>
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Roles &amp; permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{roles.length} roles configured for your company.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> Create role
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">ROLE</th>
              <th className="px-5 py-3 font-medium">ASSIGNED</th>
              <th className="px-5 py-3 font-medium">ACCESS LEVEL</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && roles.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{r.role_name}</p>
                  <p className="text-xs text-slate-400">{r.description}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-700">{r.assigned_users} users</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ACCESS_LABELS[r.access_level]?.className}`}>
                    {ACCESS_LABELS[r.access_level]?.label}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => navigate(`/roles/${r.id}`)}
                      className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                    >
                      <Pencil size={14} />
                    </button>
                    {r.role_name !== 'Owner' && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateRoleModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => { setCreateOpen(false); navigate(`/roles/${id}`) }}
        />
      )}
    </div>
  )
}

function CreateRoleModal({ onClose, onCreated }) {
  const [roleName, setRoleName] = useState('')
  const [description, setDescription] = useState('')
  const [accessLevel, setAccessLevel] = useState('limited')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await rolesApi.create({ role_name: roleName, description, access_level: accessLevel })
      onCreated(res.data.id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Create role</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role name *</label>
            <input className="input" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Warehouse Supervisor" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role can do" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Access level</label>
            <select className="input" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
              <option value="limited">Limited access</option>
              <option value="medium">Medium access</option>
              <option value="high">High access</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !roleName}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create &amp; configure
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
