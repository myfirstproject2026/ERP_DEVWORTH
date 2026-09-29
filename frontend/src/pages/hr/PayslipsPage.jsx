import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, CheckCircle2 } from 'lucide-react'
import { hrApi } from '../../api/services'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState([])
  const [employees, setEmployees] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    hrApi.listPayslips().then((res) => setPayslips(res.data)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { hrApi.listEmployees({ status: 'active' }).then((res) => setEmployees(res.data)) }, [])

  const handleMarkPaid = async (id) => {
    setMarking(id)
    try {
      await hrApi.markPayslipPaid(id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update payslip')
    } finally {
      setMarking(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{payslips.length} payslips generated.</p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> Generate payslip
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">EMPLOYEE</th>
              <th className="px-5 py-3 font-medium">PERIOD</th>
              <th className="px-5 py-3 font-medium">BASIC</th>
              <th className="px-5 py-3 font-medium">HRA</th>
              <th className="px-5 py-3 font-medium">DEDUCTIONS</th>
              <th className="px-5 py-3 font-medium">NET PAY</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && payslips.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{p.employee_name}</td>
                <td className="px-5 py-3.5 text-slate-600">{MONTHS[p.pay_month - 1]} {p.pay_year}</td>
                <td className="px-5 py-3.5 text-slate-600">{formatINR(p.basic)}</td>
                <td className="px-5 py-3.5 text-slate-600">{formatINR(p.hra)}</td>
                <td className="px-5 py-3.5 text-red-500">-{formatINR(p.deductions)}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-900">{formatINR(p.net_pay)}</td>
                <td className="px-5 py-3.5"><StatusPill status={p.status} /></td>
                <td className="px-5 py-3.5 text-right">
                  {p.status !== 'paid' && (
                    <button
                      onClick={() => handleMarkPaid(p.id)}
                      disabled={marking === p.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-200 text-green-600 text-xs font-medium hover:bg-green-50 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} /> Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && payslips.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No payslips generated yet.</p>
        )}
      </div>

      {modalOpen && (
        <PayslipModal
          employees={employees}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function StatusPill({ status }) {
  const map = { draft: 'text-slate-500 bg-slate-100', finalized: 'text-blue-600 bg-blue-50', paid: 'text-green-600 bg-green-50' }
  return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${map[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

function PayslipModal({ employees, onClose, onSaved }) {
  const now = new Date()
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    pay_month: now.getMonth() + 1,
    pay_year: now.getFullYear(),
    basic: '',
    hra: '',
    other_allowances: '',
    deductions: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const netPay = (Number(form.basic) || 0) + (Number(form.hra) || 0) + (Number(form.other_allowances) || 0) - (Number(form.deductions) || 0)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await hrApi.createPayslip({
        employee_id: Number(form.employee_id),
        pay_month: Number(form.pay_month),
        pay_year: Number(form.pay_year),
        basic: Number(form.basic) || 0,
        hra: Number(form.hra) || 0,
        other_allowances: Number(form.other_allowances) || 0,
        deductions: Number(form.deductions) || 0,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not generate payslip')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Generate payslip</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee *</label>
            <select className="input" value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Month</label>
              <select className="input" value={form.pay_month} onChange={(e) => update('pay_month', e.target.value)}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Year</label>
              <input type="number" className="input" value={form.pay_year} onChange={(e) => update('pay_year', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Basic (₹)</label>
              <input type="number" className="input" value={form.basic} onChange={(e) => update('basic', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">HRA (₹)</label>
              <input type="number" className="input" value={form.hra} onChange={(e) => update('hra', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Other allowances (₹)</label>
              <input type="number" className="input" value={form.other_allowances} onChange={(e) => update('other_allowances', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Deductions (₹)</label>
              <input type="number" className="input" value={form.deductions} onChange={(e) => update('deductions', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-sm">
            <span className="text-slate-500">Net pay</span>
            <span className="font-semibold text-slate-900">{formatINR(netPay)}</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.employee_id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Generate
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
