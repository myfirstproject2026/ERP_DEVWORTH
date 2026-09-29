import React, { useEffect, useState } from 'react'
import { Plus, X, Loader2, Tags } from 'lucide-react'
import { serviceDeskApi } from '../../api/services'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = () => {
    setLoading(true)
    serviceDeskApi.listCategories().then((res) => setCategories(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Organize tickets by issue type so trends are easy to spot.</p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> Add category
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {!loading && categories.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <Tags size={17} />
            </div>
            <p className="font-semibold text-slate-900">{c.name}</p>
            {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
            <p className="text-xs text-slate-500 mt-3">
              <span className="font-semibold text-slate-800">{c.open_ticket_count}</span> open tickets
            </p>
          </div>
        ))}
      </div>
      {!loading && categories.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-10">No categories yet.</p>
      )}

      {modalOpen && (
        <CreateCategoryModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load() }} />
      )}
    </div>
  )
}

function CreateCategoryModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setSaving(true)
    setError('')
    try {
      await serviceDeskApi.createCategory({ name, description })
      onCreated()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Add category</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warranty Claim" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving || !name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Add category
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
