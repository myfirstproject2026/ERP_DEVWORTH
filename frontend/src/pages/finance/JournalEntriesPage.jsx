import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Check, Trash2 } from 'lucide-react'
import { financeApi, branchesApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = statusFilter !== 'All' ? { status: statusFilter } : {}
    financeApi.listJournalEntries(params).then((res) => setEntries(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handlePost = async (id) => {
    try {
      await financeApi.postJournalEntry(id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not post entry')
    }
  }

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete ${entry.entry_number}?`)) return
    try {
      await financeApi.removeJournalEntry(entry.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not delete entry')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
          <Plus size={15} /> New journal entry
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">ENTRY</th>
              <th className="px-5 py-3 font-medium">DATE</th>
              <th className="px-5 py-3 font-medium">NARRATION</th>
              <th className="px-5 py-3 font-medium">SOURCE</th>
              <th className="px-5 py-3 font-medium">AMOUNT</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{e.entry_number}</td>
                <td className="px-5 py-3 text-slate-600">{e.entry_date}</td>
                <td className="px-5 py-3 text-slate-600">{e.narration || '—'}</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{e.source_type.replace('_', ' ')}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{formatINR(e.total_debit)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${e.status === 'posted' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {e.status === 'draft' && (
                      <button onClick={() => handlePost(e.id)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-green-600 hover:bg-green-50" title="Post entry">
                        <Check size={14} />
                      </button>
                    )}
                    {e.source_type === 'manual' && (
                      <button onClick={() => handleDelete(e)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-red-500 hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && <div className="px-5 py-3 text-xs text-slate-400">Showing {entries.length} entries</div>}
      </div>

      {modalOpen && <JournalEntryModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load() }} />}
    </div>
  )
}

function JournalEntryModal({ onClose, onSaved }) {
  const [branches, setBranches] = useState([])
  const [accounts, setAccounts] = useState([])
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [branchId, setBranchId] = useState('')
  const [reference, setReference] = useState('')
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState([
    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
    { account_id: '', debit_amount: 0, credit_amount: 0, description: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    branchesApi.list().then((res) => { setBranches(res.data); if (res.data[0]) setBranchId(res.data[0].id) })
    financeApi.listAccounts().then((res) => setAccounts(res.data))
  }, [])

  const updateLine = (idx, field, value) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }
  const addLine = () => setLines((prev) => [...prev, { account_id: '', debit_amount: 0, credit_amount: 0, description: '' }])
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx))

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0)
  const balanced = totalDebit === totalCredit && totalDebit > 0

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await financeApi.createJournalEntry({
        branch_id: Number(branchId),
        entry_date: entryDate,
        reference: reference || undefined,
        narration: narration || undefined,
        lines: lines.map((l) => ({
          account_id: Number(l.account_id),
          debit_amount: Number(l.debit_amount || 0),
          credit_amount: Number(l.credit_amount || 0),
          description: l.description || undefined,
        })),
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create journal entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New journal entry</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Branch</label>
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Entry date</label>
            <input type="date" className="input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Narration</label>
          <input className="input" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this entry for?" />
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-2">Lines</label>
        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="text-left text-[11px] text-slate-400">
              <th className="pb-1.5 font-medium">ACCOUNT</th>
              <th className="pb-1.5 font-medium w-28">DEBIT</th>
              <th className="pb-1.5 font-medium w-28">CREDIT</th>
              <th className="pb-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={idx}>
                <td className="pr-2 pb-2">
                  <select className="cell" value={l.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}>
                    <option value="">Select account...</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
                  </select>
                </td>
                <td className="pr-2 pb-2">
                  <input type="number" className="cell" value={l.debit_amount} onChange={(e) => updateLine(idx, 'debit_amount', e.target.value)} />
                </td>
                <td className="pr-2 pb-2">
                  <input type="number" className="cell" value={l.credit_amount} onChange={(e) => updateLine(idx, 'credit_amount', e.target.value)} />
                </td>
                <td className="pb-2">
                  {lines.length > 2 && (
                    <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addLine} className="flex items-center gap-1 text-xs text-brand-600 font-medium mb-4">
          <Plus size={13} /> Add line
        </button>

        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 mb-2 text-sm">
          <span className="text-slate-500">Total debit: <strong className="text-slate-800">{formatINR(totalDebit)}</strong></span>
          <span className="text-slate-500">Total credit: <strong className="text-slate-800">{formatINR(totalCredit)}</strong></span>
          <span className={`font-medium ${balanced ? 'text-green-600' : 'text-red-500'}`}>{balanced ? 'Balanced ✓' : 'Not balanced'}</span>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !balanced || !branchId || lines.some((l) => !l.account_id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save as draft
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
        .cell { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.4rem; padding: 0.4rem 0.5rem; font-size: 0.8rem; outline: none; }
        .cell:focus { border-color: #60a5fa; }
      `}</style>
    </div>
  )
}
