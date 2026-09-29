import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Lock } from 'lucide-react'
import { financeApi } from '../../api/services'

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense']
const TYPE_COLORS = {
  asset: 'text-blue-700 bg-blue-50',
  liability: 'text-red-700 bg-red-50',
  equity: 'text-purple-700 bg-purple-50',
  income: 'text-green-700 bg-green-50',
  expense: 'text-amber-700 bg-amber-50',
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [typeFilter, setTypeFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = typeFilter !== 'All' ? { account_type: typeFilter } : {}
    financeApi.listAccounts(params).then((res) => setAccounts(res.data)).finally(() => setLoading(false))
  }, [typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Type: All</option>
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
          <Plus size={15} /> Add account
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">CODE</th>
              <th className="px-5 py-3 font-medium">ACCOUNT NAME</th>
              <th className="px-5 py-3 font-medium">TYPE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && accounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-mono text-slate-500">{a.account_code}</td>
                <td className="px-5 py-3 font-medium text-slate-800 flex items-center gap-1.5">
                  {a.account_name}
                  {a.is_system && <Lock size={11} className="text-slate-300" title="System account" />}
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${TYPE_COLORS[a.account_type]}`}>{a.account_type}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${a.is_active ? 'text-green-600' : 'text-slate-400'}`}>{a.is_active ? 'Active' : 'Inactive'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && <div className="px-5 py-3 text-xs text-slate-400">Showing {accounts.length} accounts</div>}
      </div>

      {modalOpen && <AccountModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />}
    </div>
  )
}

function AccountModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ account_code: '', account_name: '', account_type: 'expense' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await financeApi.createAccount(form)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Add account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account code *</label>
            <input className="input" value={form.account_code} onChange={(e) => setForm((f) => ({ ...f, account_code: e.target.value }))} placeholder="e.g. 5500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account name *</label>
            <input className="input" value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} placeholder="e.g. Marketing Expense" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <select className="input" value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.account_code || !form.account_name} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create account
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
