import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building2, CalendarDays, Wallet, Check, XCircle } from 'lucide-react'
import { hrApi } from '../../api/services'

export default function HrOverviewPage() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  const load = () => {
    setLoading(true)
    hrApi.listLeaveRequests({ status: 'pending' }).then((res) => setPending(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const decide = async (id, status) => {
    setActioning(id)
    try {
      await hrApi.decideLeaveRequest(id, { status })
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not update request')
    } finally {
      setActioning(null)
    }
  }

  const quickLinks = [
    { to: '/hr/employees', label: 'Employees', icon: Users, desc: 'View and manage employee records' },
    { to: '/hr/departments', label: 'Departments', icon: Building2, desc: 'Organize teams and department heads' },
    { to: '/hr/attendance', label: 'Attendance', icon: CalendarDays, desc: 'Mark daily attendance by branch' },
    { to: '/hr/payslips', label: 'Payslips', icon: Wallet, desc: 'Generate and track monthly payslips' },
  ]

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Pending leave requests</h3>
          <Link to="/hr/leave" className="text-xs text-brand-600 font-medium">View all</Link>
        </div>
        {!loading && pending.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No pending requests — all caught up.</p>
        )}
        <div>
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50 last:border-0">
              <div>
                <p className="font-medium text-slate-800 text-sm">{r.employee_name}</p>
                <p className="text-xs text-slate-400">
                  {r.leave_type_name} · {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`} · {r.total_days} day{r.total_days == 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => decide(r.id, 'approved')}
                  disabled={actioning === r.id}
                  className="h-8 w-8 rounded-lg border border-green-200 text-green-600 flex items-center justify-center hover:bg-green-50 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => decide(r.id, 'rejected')}
                  disabled={actioning === r.id}
                  className="h-8 w-8 rounded-lg border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <q.icon size={16} />
            </div>
            <div>
              <p className="font-medium text-slate-800 text-sm">{q.label}</p>
              <p className="text-xs text-slate-400">{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
