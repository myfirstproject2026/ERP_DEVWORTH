import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Pencil } from 'lucide-react'
import { companyApi } from  "../api/services";

const TABS = ['Overview', 'Tax & Compliance', 'Branding', 'Subscription']

export default function CompanyProfilePage() {
  const [company, setCompany] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [tab, setTab] = useState('Overview')

  useEffect(() => {
    companyApi.getProfile().then((res) => setCompany(res.data))
    companyApi.getSnapshot().then((res) => setSnapshot(res.data))
  }, [])

  if (!company) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  const initials = company.company_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        <span>Login &amp; Company Setup</span> / <span className="text-brand-600 font-medium">Company Profile</span>
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Company profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">View registered details for {company.company_name}.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Download size={15} /> Export as PDF
          </button>
          <Link
            to="/company-profile/edit"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            <Pencil size={15} /> Edit profile
          </Link>
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          {tab === 'Overview' && (
            <>
              <h3 className="font-semibold text-slate-900 text-sm mb-4">Business details</h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm mb-6">
                <InfoField label="Company name" value={company.company_name} />
                <InfoField label="Business type" value={company.business_type} />
                <InfoField label="Industry" value={company.industry} />
                <InfoField label="CIN" value={company.cin} />
                <InfoField label="Contact number" value={company.contact_number} />
                <InfoField label="Business email" value={company.business_email} />
              </div>

              <h3 className="font-semibold text-slate-900 text-sm mb-4 pt-4 border-t border-slate-100">Registered address</h3>
              <div className="text-sm mb-2">
                <p className="text-slate-400 text-xs mb-1">Address</p>
                <p className="text-slate-800 font-medium">
                  {company.address_line}, {company.city}, {company.state} {company.pin_code}, {company.country}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm mt-4">
                <InfoField label="GSTIN" value={company.gstin} />
                <InfoField label="PAN" value={company.pan} />
                <InfoField label="Financial year" value={company.financial_year_start === 'April' ? 'April – March' : company.financial_year_start} />
                <InfoField label="Default GST rate" value={`${company.default_gst_rate}%`} />
              </div>
            </>
          )}
          {tab === 'Tax & Compliance' && (
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <InfoField label="GSTIN" value={company.gstin} />
              <InfoField label="PAN" value={company.pan} />
              <InfoField label="Default GST rate" value={`${company.default_gst_rate}%`} />
              <InfoField label="Financial year start" value={company.financial_year_start} />
            </div>
          )}
          {tab === 'Branding' && (
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Company logo</p>
                <p className="text-xs text-slate-400">Edit from the profile editor to upload a new logo.</p>
              </div>
            </div>
          )}
          {tab === 'Subscription' && (
            <div className="text-sm">
              <p className="text-slate-400 text-xs mb-1">Current plan</p>
              <p className="text-slate-800 font-medium mb-4">{company.plan_name} — {company.plan_billing}</p>
              <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">
                Manage subscription
              </button>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="h-14 w-14 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg mb-3">
              {initials}
            </div>
            <p className="font-semibold text-slate-900">{company.company_name}</p>
            <p className="text-xs text-slate-400 mb-2">{company.industry.split('—')[0].trim()} · {company.city} HQ</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Company snapshot</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Branches</span><span className="font-semibold text-slate-900">{snapshot?.branches ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Active users</span><span className="font-semibold text-slate-900">{snapshot?.active_users ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Roles configured</span><span className="font-semibold text-slate-900">{snapshot?.roles_configured ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Member since</span><span className="font-semibold text-slate-900">{snapshot?.member_since ?? '—'}</span></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">Plan</h3>
            <p className="text-sm text-slate-600 mb-3">{company.plan_name} — {company.plan_billing}</p>
            <button className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">
              Manage subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-slate-800 font-medium">{value || '—'}</p>
    </div>
  )
}
