import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { inventoryApi, branchesApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [stats, setStats] = useState(null)
  const [branches, setBranches] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      inventoryApi.listProducts({ search: search || undefined, status: statusFilter }),
      inventoryApi.productStats(),
    ])
      .then(([p, s]) => { setProducts(p.data); setStats(s.data) })
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { branchesApi.list().then((res) => setBranches(res.data)) }, [])

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete ${product.product_name}?`)) return
    try {
      await inventoryApi.removeProduct(product.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete product')
    }
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard label="Total products" value={stats?.total_products} />
        <StatCard label="Active" value={stats?.active_products} valueColor="text-green-600" />
        <StatCard label="Low stock" value={stats?.low_stock_count} valueColor="text-red-600" />
        <StatCard label="Total stock value" value={formatINR(stats?.total_stock_value)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
              <option value="All">Status: All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            onClick={() => { setEditingProduct(null); setModalOpen(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Plus size={15} /> Add product
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">PRODUCT</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium text-right">COST</th>
              <th className="px-5 py-3 font-medium text-right">SELLING PRICE</th>
              <th className="px-5 py-3 font-medium text-right">STOCK</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && products.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{p.product_name}</p>
                  <p className="text-xs text-slate-400">{p.sku || '—'}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{p.category || '—'}</td>
                <td className="px-5 py-3.5 text-right text-slate-700">{formatINR(p.cost_price)}</td>
                <td className="px-5 py-3.5 text-right text-slate-700">{formatINR(p.selling_price)}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className={Number(p.total_stock) <= p.reorder_level ? 'text-red-600 font-medium' : 'text-slate-700'}>
                    {Number(p.total_stock).toLocaleString('en-IN')} {p.unit_of_measure}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.status === 'active' ? 'text-green-600 bg-green-50' : 'text-slate-500 bg-slate-100'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {p.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Pencil} onClick={() => { setEditingProduct(p); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(p)} danger />
                  </div>
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-400">No products yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ProductModal
          product={editingProduct}
          branches={branches}
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

const CATEGORIES = ['Fasteners', 'Couplings', 'Brackets', 'Raw Material', 'Packaging', 'Misc']

function ProductModal({ product, branches, onClose, onSaved }) {
  const isEdit = Boolean(product)
  const [form, setForm] = useState({
    product_name: product?.product_name || '',
    sku: product?.sku || '',
    category: product?.category || CATEGORIES[0],
    unit_of_measure: product?.unit_of_measure || 'pcs',
    hsn_code: product?.hsn_code || '',
    cost_price: product?.cost_price || 0,
    selling_price: product?.selling_price || 0,
    tax_rate: product?.tax_rate || 18,
    reorder_level: product?.reorder_level || 0,
    reorder_quantity: product?.reorder_quantity || 0,
    primary_branch_id: product?.primary_branch_id || '',
    status: product?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, primary_branch_id: form.primary_branch_id || null }
      if (isEdit) {
        await inventoryApi.updateProduct(product.id, payload)
      } else {
        await inventoryApi.createProduct(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit product' : 'Add product'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product name" required>
              <input className="input" value={form.product_name} onChange={(e) => update('product_name', e.target.value)} placeholder="e.g. Hex Bolt M8 Series" />
            </Field>
            <Field label="SKU">
              <input className="input" value={form.sku} onChange={(e) => update('sku', e.target.value)} placeholder="e.g. HB-M8-001" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => update('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Unit of measure">
              <input className="input" value={form.unit_of_measure} onChange={(e) => update('unit_of_measure', e.target.value)} placeholder="pcs, kg, box..." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cost price">
              <input type="number" step="0.01" className="input" value={form.cost_price} onChange={(e) => update('cost_price', e.target.value)} />
            </Field>
            <Field label="Selling price">
              <input type="number" step="0.01" className="input" value={form.selling_price} onChange={(e) => update('selling_price', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tax rate (%)">
              <input type="number" step="0.01" className="input" value={form.tax_rate} onChange={(e) => update('tax_rate', e.target.value)} />
            </Field>
            <Field label="HSN code">
              <input className="input" value={form.hsn_code} onChange={(e) => update('hsn_code', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Reorder level">
              <input type="number" className="input" value={form.reorder_level} onChange={(e) => update('reorder_level', e.target.value)} />
            </Field>
            <Field label="Reorder quantity">
              <input type="number" className="input" value={form.reorder_quantity} onChange={(e) => update('reorder_quantity', e.target.value)} />
            </Field>
          </div>
          <Field label="Primary branch">
            <select className="input" value={form.primary_branch_id} onChange={(e) => update('primary_branch_id', e.target.value)}>
              <option value="">None</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </Field>
          {isEdit && (
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.product_name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save product
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
