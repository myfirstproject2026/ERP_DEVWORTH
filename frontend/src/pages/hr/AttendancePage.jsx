import React, { useEffect, useState, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { hrApi, branchesApi } from '../../api/services'

const STATUSES = ['present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off']

function label(v) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState([])
  const [employees, setEmployees] = useState([])
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      hrApi.attendanceSummary(date),
      hrApi.listAttendance({ attendance_date: date }),
      hrApi.listEmployees({ status: 'active' }),
    ]).then(([s, att, emp]) => {
      setSummary(s.data)
      setEmployees(emp.data)
      const map = {}
      emp.data.forEach((e) => { map[e.id] = 'present' })
      att.data.forEach((r) => { map[r.employee_id] = r.status })
      setRecords(map)
    }).finally(() => setLoading(false))
  }, [date])

  useEffect(() => { load() }, [load])
  useEffect(() => { branchesApi.list().then((res) => { setBranches(res.data); setBranchId(res.data[0]?.id || '') }) }, [])

  const setStatus = (empId, status) => setRecords((r) => ({ ...r, [empId]: status }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await hrApi.bulkMarkAttendance({
        branch_id: Number(branchId),
        attendance_date: date,
        records: employees.map((e) => ({ employee_id: e.id, attendance_date: date, status: records[e.id] || 'present' })),
      })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save attendance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input type="date" className="px-3 py-2 rounded-lg border border-slate-200 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save attendance
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-5 gap-4 mb-5">
          <SummaryCard label="Present" value={summary.present_count} accent="text-green-600" />
          <SummaryCard label="Absent" value={summary.absent_count} accent="text-red-600" />
          <SummaryCard label="On leave" value={summary.on_leave_count} accent="text-amber-600" />
          <SummaryCard label="Half day" value={summary.half_day_count} />
          <SummaryCard label="Present %" value={`${summary.present_pct}%`} />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">EMPLOYEE</th>
              <th className="px-5 py-3 font-medium">DESIGNATION</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && employees.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{e.full_name}</td>
                <td className="px-5 py-3.5 text-slate-500">{e.designation}</td>
                <td className="px-5 py-3.5">
                  <select
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700"
                    value={records[e.id] || 'present'}
                    onChange={(ev) => setStatus(e.id, ev.target.value)}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && employees.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No active employees found.</p>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <p className={`text-xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
