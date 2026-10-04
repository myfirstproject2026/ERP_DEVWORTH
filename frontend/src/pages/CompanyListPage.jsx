import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { companyApi } from '../api/services'
import client from '../api/client'

export default function CompanyListPage() {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    companyApi.list()
      .then((res) => setCompanies(res.data))
      .catch(() => setError('Unable to load companies.'))
  }, [])

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        <span>Login &amp; Company Setup</span> / <span className="text-brand-600 font-medium">Company List</span>
      </p>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-3"
      >
        <ArrowLeft size={15} /> Back
      </button>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Company List</h1>
        <p className="text-sm text-slate-500 mt-0.5">Select a company to view its details.</p>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
      {!companies && !error && <div className="text-slate-400 text-sm">Loading…</div>}

      {companies && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Business type</th>
                <th className="px-4 py-3 font-medium">Industry</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">GSTIN</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const initials = c.company_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to="/company-profile" className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold overflow-hidden">
                          {c.logo_url ? (
                            <img src={`${client.defaults.baseURL}${c.logo_url}`} alt="" className="h-full w-full object-contain" />
                          ) : initials}
                        </div>
                        <span className="font-semibold text-slate-900">{c.company_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.business_type}</td>
                    <td className="px-4 py-3 text-slate-600">{c.industry}</td>
                    <td className="px-4 py-3 text-slate-600">{c.city}, {c.state}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{c.business_email}</div>
                      <div className="text-xs text-slate-400">{c.contact_number}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.gstin}</td>
                    <td className="px-4 py-3 text-slate-600">{c.plan_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-medium capitalize">{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/company-profile" className="inline-flex items-center gap-1 text-brand-600 text-xs font-medium">
                        View <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {companies.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No companies found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
