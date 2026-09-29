import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { rolesApi } from  "../api/services";

const COLUMNS = ['can_view', 'can_add', 'can_edit', 'can_delete', 'can_approve']
const COLUMN_LABELS = { can_view: 'VIEW', can_add: 'ADD', can_edit: 'EDIT', can_delete: 'DELETE', can_approve: 'APPROVE' }

export default function RoleEditPage() {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [roleName, setRoleName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    rolesApi.get(roleId).then((res) => {
      setRole(res.data)
      setRoleName(res.data.role_name)
      setDescription(res.data.description || '')
      setPermissions(res.data.permissions)
    })
  }, [roleId])

  const isOwnerRole = role?.role_name === 'Owner'

  const togglePermission = (moduleId, column) => {
    if (isOwnerRole) return
    setPermissions((prev) =>
      prev.map((p) => (p.module_id === moduleId ? { ...p, [column]: !p[column] } : p))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (roleName !== role.role_name || description !== role.description) {
        await rolesApi.update(roleId, { role_name: roleName, description })
      }
      await rolesApi.updatePermissions(roleId, permissions)
      navigate('/roles')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save permissions')
    } finally {
      setSaving(false)
    }
  }

  if (!role) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Login &amp; Company Setup / Roles &amp; Permissions / <span className="text-brand-600 font-medium">{role.role_name}</span>
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Edit role — {role.role_name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Assigned to {role.assigned_users} users · controls module-level access for this role.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/roles')} className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isOwnerRole}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save permissions
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      {isOwnerRole && (
        <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          The Owner role always has full access and cannot be modified.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role name *</label>
            <input
              className="input"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              disabled={isOwnerRole}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isOwnerRole}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Module permissions</h3>
          <span className="text-xs text-slate-400">Toggle access per module</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-6 py-3 font-medium">MODULE</th>
              {COLUMNS.map((c) => (
                <th key={c} className="px-4 py-3 font-medium text-center">{COLUMN_LABELS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.module_id} className="border-b border-slate-50 last:border-0">
                <td className="px-6 py-3.5 font-medium text-slate-800">{p.module_name}</td>
                {COLUMNS.map((c) => (
                  <td key={c} className="px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={p[c]}
                      onChange={() => togglePermission(p.module_id, c)}
                      disabled={isOwnerRole}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400 disabled:opacity-50"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.55rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
        .input:disabled { background: #f8fafc; color: #94a3b8; }
      `}</style>
    </div>
  )
}
