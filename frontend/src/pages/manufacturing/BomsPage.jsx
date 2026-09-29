import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { manufacturingApi, inventoryApi } from '../../api/services'
import { StatusPill } from './ManufacturingOverviewPage'

export default function BomsPage() {
  const [boms, setBoms] = useState([])
  const [products, setProducts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    manufacturingApi.listBoms().then((res) => setBoms(res.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { inventoryApi.listProducts().then((res) => setProducts(res.data)) }, [])

  const handleDelete = async (bom) => {
    if (!window.confirm(`Delete BOM "${bom.bom_name}"?`)) return
    try {
      await manufacturingApi.removeBom(bom.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete BOM')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => { setEditingId(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New BOM
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">BOM</th>
              <th className="px-5 py-3 font-medium">FINISHED PRODUCT</th>
              <th className="px-5 py-3 font-medium">VERSION</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && boms.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{b.bom_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{b.product_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{b.version}</td>
                <td className="px-5 py-3.5"><StatusPill status={b.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Pencil} onClick={() => { setEditingId(b.id); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(b)} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && boms.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No bills of materials yet.</p>
        )}
      </div>

      {modalOpen && (
        <BomModal
          bomId={editingId}
          products={products}
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

function BomModal({ bomId, products, onClose, onSaved }) {
  const isEdit = Boolean(bomId)
  const [form, setForm] = useState({
    product_id: '', bom_name: '', version: 'v1', notes: '',
    components: [{ component_product_id: '', quantity_required: 1, unit: 'unit' }],
  })
  const [loadingBom, setLoadingBom] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEdit) {
      manufacturingApi.getBom(bomId).then((res) => {
        const b = res.data
        setForm({
          product_id: b.product_id, bom_name: b.bom_name, version: b.version, notes: b.notes || '',
          components: b.components.map((c) => ({
            component_product_id: c.component_product_id, quantity_required: c.quantity_required, unit: c.unit,
          })),
        })
        setLoadingBom(false)
      })
    }
  }, [isEdit, bomId])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const updateComponent = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      components: f.components.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }))
  }

  const addComponent = () => {
    setForm((f) => ({ ...f, components: [...f.components, { component_product_id: '', quantity_required: 1, unit: 'unit' }] }))
  }

  const removeComponent = (idx) => {
    setForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        bom_name: form.bom_name,
        version: form.version,
        notes: form.notes,
        components: form.components
          .filter((c) => c.component_product_id)
          .map((c) => ({
            component_product_id: Number(c.component_product_id),
            quantity_required: Number(c.quantity_required),
            unit: c.unit,
          })),
      }
      if (isEdit) {
        await manufacturingApi.updateBom(bomId, payload)
      } else {
        await manufacturingApi.createBom({ ...payload, product_id: Number(form.product_id) })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save BOM')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit bill of materials' : 'New bill of materials'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {loadingBom ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Finished product" required>
                <select className="input" value={form.product_id} onChange={(e) => update('product_id', e.target.value)} disabled={isEdit}>
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </select>
              </Field>
              <Field label="BOM name" required>
                <input className="input" value={form.bom_name} onChange={(e) => update('bom_name', e.target.value)} placeholder="e.g. Standard v1" />
              </Field>
            </div>
            <Field label="Version">
              <input className="input" value={form.version} onChange={(e) => update('version', e.target.value)} />
            </Field>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Components</label>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-slate-400 bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 font-medium w-[50%]">COMPONENT</th>
                      <th className="px-3 py-2 font-medium">QTY REQUIRED</th>
                      <th className="px-3 py-2 font-medium">UNIT</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.components.map((c, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1.5">
                          <select
                            className="cell"
                            value={c.component_product_id}
                            onChange={(e) => updateComponent(idx, 'component_product_id', e.target.value)}
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" step="0.01" className="cell w-24" value={c.quantity_required} onChange={(e) => updateComponent(idx, 'quantity_required', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="cell w-20" value={c.unit} onChange={(e) => updateComponent(idx, 'unit', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => removeComponent(idx)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={addComponent} className="flex items-center gap-1.5 mt-2 text-xs text-brand-600 font-medium hover:underline">
                <Plus size={13} /> Add component
              </button>
            </div>

            <Field label="Notes">
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || loadingBom || !form.bom_name || (!isEdit && !form.product_id) || form.components.every((c) => !c.component_product_id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create BOM'}
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
        .input:disabled { background: #f8fafc; color: #94a3b8; }
        .cell { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.35rem 0.5rem; font-size: 0.8125rem; outline: none; }
        .cell:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
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
