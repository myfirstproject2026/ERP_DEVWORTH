import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Check } from 'lucide-react'
import { financeApi, branchesApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other']

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [stats, setStats] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = statusFilter !== 'All' ? { status: statusFilter } : {}
    Promise.all([financeApi.listExpenses(params), financeApi.expenseStats()])
      .then(([e, s]) => { setExpenses(e.data); setStats(s.data) })
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleMarkPaid = async (id) => {
    try {
      await financeApi.markExpensePaid(id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not mark expense as paid')
    }
  }

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <StatCard label="Total this month" value={formatINR(stats.total_this_month)} />
          <StatCard label="Paid this month" value={formatINR(stats.paid_this_month)} accent="text-green-600" />
          <StatCard label="Pending" value={stats.pending_count} accent={stats.pending_count > 0 ? 'text-amber-600' : undefined} />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
          <Plus size={15} /> Add expense
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">EXPENSE</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium">VENDOR</th>
              <th className="px-5 py-3 font-medium">AMOUNT</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && expenses.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{e.expense_number}</p>
                  <p className="text-xs text-slate-400">{e.expense_date} · {e.branch_name}</p>
                </td>
                <td className="px-5 py-3 text-slate-600">{e.category}</td>
                <td className="px-5 py-3 text-slate-600">{e.vendor_name || '—'}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{formatINR(e.total_amount)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${e.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end">
                    {e.status === 'pending' && (
                      <button onClick={() => handleMarkPaid(e.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-green-600 hover:bg-green-50">
                        <Check size={12} /> Mark paid
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && <div className="px-5 py-3 text-xs text-slate-400">Showing {expenses.length} expenses</div>}
      </div>

      {modalOpen && <ExpenseModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />}
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <p className={`text-xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function ExpenseModal({ onClose, onSaved }) {
  const [branches, setBranches] = useState([])
  const [accounts, setAccounts] = useState([])
  const [banks, setBanks] = useState([])
  const [form, setForm] = useState({
    branch_id: '', expense_date: new Date().toISOString().slice(0, 10), category: '', account_id: '',
    vendor_name: '', description: '', amount: '', tax_rate: 18, payment_method: 'bank_transfer', bank_account_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    branchesApi.list().then((res) => { setBranches(res.data); if (res.data[0]) update('branch_id', res.data[0].id) })
    financeApi.listAccounts({ account_type: 'expense' }).then((res) => setAccounts(res.data))
    financeApi.listBankAccounts().then((res) => setBanks(res.data))
  }, [])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await financeApi.createExpense({
        ...form,
        branch_id: Number(form.branch_id),
        account_id: Number(form.account_id),
        amount: Number(form.amount),
        tax_rate: Number(form.tax_rate),
        bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : undefined,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Add expense</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch" required>
              <select className="input" value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Date" required>
              <input type="date" className="input" value={form.expense_date} onChange={(e) => update('expense_date', e.target.value)} />
            </Field>
          </div>
          <Field label="Category" required>
            <input className="input" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="e.g. Travel, Utilities, Office Supplies" />
          </Field>
          <Field label="Expense account" required>
            <select className="input" value={form.account_id} onChange={(e) => update('account_id', e.target.value)}>
              <option value="">Select account...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
            </select>
          </Field>
          <Field label="Vendor name"><input className="input" value={form.vendor_name} onChange={(e) => update('vendor_name', e.target.value)} /></Field>
          <Field label="Description"><input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" required><input type="number" className="input" value={form.amount} onChange={(e) => update('amount', e.target.value)} /></Field>
            <Field label="Tax rate %"><input type="number" className="input" value={form.tax_rate} onChange={(e) => update('tax_rate', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment method">
              <select className="input" value={form.payment_method} onChange={(e) => update('payment_method', e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Bank account">
              <select className="input" value={form.bank_account_id} onChange={(e) => update('bank_account_id', e.target.value)}>
                <option value="">None</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.account_name}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.branch_id || !form.category || !form.account_id || !form.amount} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save expense
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
