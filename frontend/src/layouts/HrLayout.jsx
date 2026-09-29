import React, { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Users, Building2, CalendarDays, Wallet } from 'lucide-react'
import { hrApi } from '../api/services'

const TABS = [
  { to: '/hr', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/hr/employees', label: 'Employees', icon: Users },
  { to: '/hr/departments', label: 'Departments', icon: Building2 },
  { to: '/hr/leave', label: 'Leave', icon: CalendarDays },
  { to: '/hr/attendance', label: 'Attendance', icon: CalendarDays },
  { to: '/hr/payslips', label: 'Payslips', icon: Wallet },
]

export default function HrLayout() {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    hrApi.overview().then((res) => setOverview(res.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Workspace Modules / <span className="text-brand-600 font-medium">HR & Employee</span>
      </p>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">HR & Employee</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employees, departments, leave, attendance, and payslips.</p>
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-5 gap-4 mb-5">
          <SummaryCard label="Total employees" value={overview.total_employees} />
          <SummaryCard label="Active" value={overview.active_employees} accent="text-green-600" />
          <SummaryCard label="Pending leave requests" value={overview.pending_leave_requests} accent={overview.pending_leave_requests > 0 ? 'text-amber-600' : undefined} />
          <SummaryCard label="On leave today" value={overview.on_leave_today} />
          <SummaryCard label="Departments" value={overview.open_departments} />
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                isActive ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <t.icon size={15} />
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
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
