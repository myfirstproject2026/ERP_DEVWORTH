import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { hrApi, usersApi } from '../../api/services'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    hrApi.listDepartments().then((res) => setDepartments(res.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { usersApi.list().then((res) => setUsers(res.data)) }, [])

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete department "${d.department_name}"?`)) return
    try {
      await hrApi.removeDepartment(d.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete department')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{departments.length} departments configured.</p>
        <button
          onClick={() => { setEditingDept(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New department
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {!loading && departments.map((d) => (
          <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                {d.department_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex items-center gap-1.5">
                <IconButton icon={Pencil} onClick={() => { setEditingDept(d); setModalOpen(true) }} />
                <IconButton icon={Trash2} onClick={() => handleDelete(d)} danger />
              </div>
            </div>
            <p className="font-semibold text-slate-900">{d.department_name}</p>
            <p className="text-xs text-slate-400 mb-3">Head: {d.head_name || 'Unassigned'}</p>
            <p className="text-sm text-slate-600">{d.employee_count} employee{d.employee_count === 1 ? '' : 's'}</p>
          </div>
        ))}
      </div>
      {!loading && departments.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No departments yet.</p>
      )}

      {modalOpen && (
        <DepartmentModal
          department={editingDept}
          users={users}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
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

function DepartmentModal({ department, users, onClose, onSaved }) {
  const isEdit = Boolean(department)
  const [name, setName] = useState(department?.department_name || '')
  const [headUserId, setHeadUserId] = useState(department?.head_user_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { department_name: name, head_user_id: headUserId || null }
      if (isEdit) {
        await hrApi.updateDepartment(department.id, payload)
      } else {
        await hrApi.createDepartment(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save department')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit department' : 'New department'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Department name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quality Control" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Department head</label>
            <select className="input" value={headUserId} onChange={(e) => setHeadUserId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create department'}
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
