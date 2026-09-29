import React, { useEffect, useState } from 'react'
import { FileCheck, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { financeApi } from '../../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function GstPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [summary, setSummary] = useState(null)
  const [filings, setFilings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filing, setFiling] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([financeApi.gstSummary(month, year), financeApi.listGstFilings()])
      .then(([s, f]) => { setSummary(s.data); setFilings(f.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [month, year])

  const shiftMonth = (delta) => {
    let m = month + delta, y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setMonth(m); setYear(y)
  }

  const handleFile = async () => {
    setFiling(true)
    setError('')
    try {
      await financeApi.fileGstReturn({ return_month: month, return_year: year })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not file GST return')
    } finally {
      setFiling(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => shiftMonth(-1)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronLeft size={15} /></button>
            <h3 className="font-semibold text-slate-900 text-sm w-40 text-center">{MONTH_NAMES[month - 1]} {year}</h3>
            <button onClick={() => shiftMonth(1)} className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronRight size={15} /></button>
          </div>
          {summary && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${summary.filing_status === 'filed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              {summary.filing_status === 'filed' ? 'Filed' : 'Not filed'}
            </span>
          )}
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {loading ? (
          <div className="text-slate-400 text-sm py-6 text-center">Loading…</div>
        ) : summary && (
          <>
            <div className="grid grid-cols-2 gap-6 mb-5">
              <div className="border border-slate-100 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 mb-3">Outward supplies (Sales)</p>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Taxable value</span>
                  <span className="font-medium text-slate-800">{formatINR(summary.taxable_outward_supplies)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Output tax</span>
                  <span className="font-medium text-slate-800">{formatINR(summary.output_tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoices</span>
                  <span className="font-medium text-slate-800">{summary.invoice_count}</span>
                </div>
              </div>
              <div className="border border-slate-100 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 mb-3">Inward supplies (Purchases)</p>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Taxable value</span>
                  <span className="font-medium text-slate-800">{formatINR(summary.taxable_inward_supplies)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Input tax credit</span>
                  <span className="font-medium text-slate-800">{formatINR(summary.input_tax_credit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Bills</span>
                  <span className="font-medium text-slate-800">{summary.bill_count}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-navy-800 text-white mb-4">
              <span className="text-sm">Net tax payable (Output − Input Credit)</span>
              <span className="text-lg font-bold">{formatINR(summary.net_tax_payable)}</span>
            </div>

            {summary.filing_status === 'filed' ? (
              <p className="text-xs text-slate-500">
                Filed on {summary.filed_on} {summary.arn && <>· ARN: <span className="font-mono">{summary.arn}</span></>}
              </p>
            ) : (
              <button onClick={handleFile} disabled={filing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50">
                {filing ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                File GST return for {MONTH_NAMES[month - 1]}
              </button>
            )}
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Filing history</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">PERIOD</th>
              <th className="px-5 py-2.5 font-medium">NET TAX PAYABLE</th>
              <th className="px-5 py-2.5 font-medium">FILED ON</th>
              <th className="px-5 py-2.5 font-medium">ARN</th>
            </tr>
          </thead>
          <tbody>
            {filings.map((f) => (
              <tr key={f.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-800">{MONTH_NAMES[f.return_month - 1]} {f.return_year}</td>
                <td className="px-5 py-3 text-slate-600">{formatINR(f.net_tax_payable)}</td>
                <td className="px-5 py-3 text-slate-600">{f.filed_on || '—'}</td>
                <td className="px-5 py-3 text-slate-500 font-mono text-xs">{f.arn || '—'}</td>
              </tr>
            ))}
            {filings.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400 text-sm">No returns filed yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
