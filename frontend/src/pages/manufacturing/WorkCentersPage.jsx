import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { manufacturingApi, branchesApi } from '../../api/services'
import { StatusPill } from './ManufacturingOverviewPage'

export default function WorkCentersPage() {
  const [centers, setCenters] = useState([])
  const [branches, setBranches] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    manufacturingApi.listWorkCenters().then((res) => setCenters(res.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { branchesApi.list().then((res) => setBranches(res.data)) }, [])

  const handleDelete = async (wc) => {
    if (!window.confirm(`Delete work center "${wc.name}"?`)) return
    try {
      await manufacturingApi.removeWorkCenter(wc.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete work center')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New work center
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">WORK CENTER</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium">CAPACITY / DAY</th>
              <th className="px-5 py-3 font-medium">ACTIVE WORK ORDERS</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && centers.map((wc) => (
              <tr key={wc.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{wc.name}</p>
                  <p className="text-xs text-slate-400">{wc.code}{wc.description ? ` · ${wc.description}` : ''}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{wc.branch_name}</td>
                <td className="px-5 py-3.5 text-slate-700">{wc.capacity_per_day} units</td>
                <td className="px-5 py-3.5 text-slate-700">{wc.active_work_orders}</td>
                <td className="px-5 py-3.5"><StatusPill status={wc.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Pencil} onClick={() => { setEditing(wc); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(wc)} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && centers.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No work centers yet.</p>
        )}
      </div>

      {modalOpen && (
        <WorkCenterModal
          workCenter={editing}
          branches={branches}
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

function WorkCenterModal({ workCenter, branches, onClose, onSaved }) {
  const isEdit = Boolean(workCenter)
  const [form, setForm] = useState({
    name: workCenter?.name || '',
    code: workCenter?.code || '',
    branch_id: workCenter?.branch_id || branches[0]?.id || '',
    description: workCenter?.description || '',
    capacity_per_day: workCenter?.capacity_per_day || 0,
    status: workCenter?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await manufacturingApi.updateWorkCenter(workCenter.id, {
          name: form.name, description: form.description,
          capacity_per_day: Number(form.capacity_per_day), status: form.status,
        })
      } else {
        await manufacturingApi.createWorkCenter({
          name: form.name, code: form.code, branch_id: Number(form.branch_id),
          description: form.description, capacity_per_day: Number(form.capacity_per_day),
        })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save work center')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit work center' : 'New work center'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" required>
              <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. CNC Line 1" />
            </Field>
            <Field label="Code" required>
              <input className="input" value={form.code} onChange={(e) => update('code', e.target.value.toUpperCase())} placeholder="e.g. CNC-01" disabled={isEdit} />
            </Field>
          </div>
          {!isEdit && (
            <Field label="Branch" required>
              <select className="input" value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Description">
            <input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} />
          </Field>
          <Field label="Capacity per day (units)">
            <input type="number" className="input" value={form.capacity_per_day} onChange={(e) => update('capacity_per_day', e.target.value)} />
          </Field>
          {isEdit && (
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.code}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create work center'}
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
        .input:disabled { background: #f8fafc; color: #94a3b8; }
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
