import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, GitBranch, Users, ShieldCheck, ChevronRight } from 'lucide-react'
import { companyApi } from '../api/services'
import client from '../api/client'

const SECTIONS = [
  { to: '/company-profile', label: 'Company Profile', desc: 'Registered details, tax and branding', icon: Building2 },
  { to: '/branches', label: 'Branches', desc: 'Offices, warehouses and plants', icon: GitBranch },
  { to: '/users', label: 'Users', desc: 'Invite and manage team members', icon: Users },
  { to: '/roles', label: 'Roles & Permissions', desc: 'Control access to each module', icon: ShieldCheck },
]

export default function CompanyPage() {
  const [company, setCompany] = useState(null)
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    companyApi.getProfile().then((res) => setCompany(res.data))
    companyApi.getSnapshot().then((res) => setSnapshot(res.data))
  }, [])

  if (!company) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  const initials = company.company_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const stats = [
    { label: 'Branches', value: snapshot?.branches },
    { label: 'Active users', value: snapshot?.active_users },
    { label: 'Roles configured', value: snapshot?.roles_configured },
    { label: 'Member since', value: snapshot?.member_since },
  ]

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        <span>Login &amp; Company Setup</span> / <span className="text-brand-600 font-medium">Company</span>
      </p>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-14 w-14 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg overflow-hidden">
          {company.logo_url ? (
            <img src={`${client.defaults.baseURL}${company.logo_url}`} alt="Company logo" className="h-full w-full object-contain" />
          ) : initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{company.company_name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {company.industry} · {company.city}, {company.state}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className="text-lg font-semibold text-slate-900">{s.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {SECTIONS.map(({ to, label, desc, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 hover:border-brand-600 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Icon size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
