import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { purchaseApi, usersApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      purchaseApi.listSuppliers({ search: search || undefined, status: statusFilter }),
      purchaseApi.supplierStats(),
    ])
      .then(([s, st]) => { setSuppliers(s.data); setStats(st.data) })
      .finally(() => setLoading(false))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { usersApi.list().then((res) => setUsers(res.data)) }, [])

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete supplier "${s.supplier_name}"?`)) return
    try {
      await purchaseApi.removeSupplier(s.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete supplier')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-4 gap-4 flex-1 mr-4">
          <StatCard label="Total suppliers" value={stats?.total_suppliers} />
          <StatCard label="Active" value={stats?.active_suppliers} valueColor="text-green-600" />
          <StatCard label="Open POs" value={stats?.open_purchase_orders} valueColor="text-blue-600" />
          <StatCard label="Bills due" value={formatINR(stats?.bills_due)} />
        </div>
        <button
          onClick={() => { setEditingSupplier(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium h-fit"
        >
          <Plus size={15} /> New supplier
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Status: All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">SUPPLIER</th>
              <th className="px-5 py-3 font-medium">CONTACT</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium">OPEN POS</th>
              <th className="px-5 py-3 font-medium">TOTAL SPEND</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && suppliers.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {s.supplier_name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{s.supplier_name}</p>
                      <p className="text-xs text-slate-400">{s.payment_terms} · ★ {Number(s.rating).toFixed(1)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  <p>{s.contact_person || '—'}</p>
                  <p className="text-xs text-slate-400">{s.phone || s.email || ''}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{s.category || '—'}</td>
                <td className="px-5 py-3.5 text-slate-700">{s.open_po_count}</td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{formatINR(s.total_spend)}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    s.status === 'active' ? 'text-green-600 bg-green-50' : 'text-slate-500 bg-slate-100'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`} />
                    {s.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={Pencil} onClick={() => { setEditingSupplier(s); setModalOpen(true) }} />
                    <IconButton icon={Trash2} onClick={() => handleDelete(s)} danger />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && suppliers.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No suppliers found.</p>
        )}
      </div>

      {modalOpen && (
        <SupplierModal
          supplier={editingSupplier}
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

function SupplierModal({ supplier, users, onClose, onSaved }) {
  const isEdit = Boolean(supplier)
  const [form, setForm] = useState({
    supplier_name: supplier?.supplier_name || '',
    contact_person: supplier?.contact_person || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    gstin: supplier?.gstin || '',
    billing_address: supplier?.billing_address || '',
    category: supplier?.category || '',
    payment_terms: supplier?.payment_terms || 'Net 30',
    assigned_to_user_id: supplier?.assigned_to_user_id || '',
    status: supplier?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, assigned_to_user_id: form.assigned_to_user_id || null }
      if (isEdit) {
        await purchaseApi.updateSupplier(supplier.id, payload)
      } else {
        delete payload.status
        await purchaseApi.createSupplier(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit supplier' : 'New supplier'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier name" required>
              <input className="input" value={form.supplier_name} onChange={(e) => update('supplier_name', e.target.value)} placeholder="e.g. Sundaram Steel & Alloys" />
            </Field>
            <Field label="Category">
              <input className="input" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="e.g. Raw Material" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact person">
              <input className="input" value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 90000 00000" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" className="input" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </Field>
            <Field label="GSTIN">
              <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} />
            </Field>
          </div>
          <Field label="Billing address">
            <textarea className="input" rows={2} value={form.billing_address} onChange={(e) => update('billing_address', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment terms">
              <select className="input" value={form.payment_terms} onChange={(e) => update('payment_terms', e.target.value)}>
                {['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on receipt'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Assigned to">
              <select className="input" value={form.assigned_to_user_id} onChange={(e) => update('assigned_to_user_id', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
          </div>
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
            disabled={saving || !form.supplier_name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create supplier'}
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
