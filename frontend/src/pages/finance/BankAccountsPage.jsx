import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Star, Landmark } from 'lucide-react'
import { financeApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    financeApi.listBankAccounts().then((res) => setAccounts(res.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
          <Plus size={15} /> Add bank account
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {!loading && accounts.map((a) => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Landmark size={18} /></div>
              {a.is_primary && <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"><Star size={11} /> Primary</span>}
            </div>
            <p className="font-semibold text-slate-900">{a.account_name}</p>
            <p className="text-xs text-slate-400 mb-3">{a.bank_name} · {a.account_number.slice(-4).padStart(a.account_number.length, '•')}</p>
            <p className="text-2xl font-bold text-slate-900">{formatINR(a.current_balance)}</p>
            <p className="text-xs text-slate-400 mt-1">Opening balance: {formatINR(a.opening_balance)}</p>
            <span className={`inline-block mt-3 text-xs font-medium px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
              {a.status}
            </span>
          </div>
        ))}
      </div>

      {modalOpen && <BankAccountModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />}
    </div>
  )
}

function BankAccountModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    account_name: '', bank_name: '', account_number: '', ifsc_code: '',
    account_type: 'current', opening_balance: 0, is_primary: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await financeApi.createBankAccount(form)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create bank account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Add bank account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <Field label="Account name" required><input className="input" value={form.account_name} onChange={(e) => update('account_name', e.target.value)} placeholder="e.g. ICICI Current Account" /></Field>
          <Field label="Bank name" required><input className="input" value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} placeholder="e.g. ICICI Bank" /></Field>
          <Field label="Account number" required><input className="input" value={form.account_number} onChange={(e) => update('account_number', e.target.value)} /></Field>
          <Field label="IFSC code"><input className="input" value={form.ifsc_code} onChange={(e) => update('ifsc_code', e.target.value)} /></Field>
          <Field label="Opening balance">
            <input type="number" className="input" value={form.opening_balance} onChange={(e) => update('opening_balance', e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => update('is_primary', e.target.checked)} className="rounded border-slate-300" />
            Set as primary account
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.account_name || !form.bank_name || !form.account_number} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
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
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
    </div>
  )
}
