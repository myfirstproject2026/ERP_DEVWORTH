import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Loader2 } from 'lucide-react'
import { companyApi } from  "../api/services";

export default function CompanyProfileEditPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    companyApi.getProfile().then((res) => setForm(res.data))
  }, [])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await companyApi.updateProfile(form)
      navigate('/company-profile')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="p-8 text-slate-400 text-sm">Loading…</div>

  const initials = form.company_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <p className="text-xs text-slate-400 mb-1">
        Login &amp; Company Setup / Company Profile / <span className="text-brand-600 font-medium">Edit</span>
      </p>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Edit company profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">Update business, address and tax details for {form.company_name}.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/company-profile')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            form="edit-company-form"
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

      <form id="edit-company-form" onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg">
            {initials}
          </div>
          <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Upload size={14} /> Change logo
          </button>
          <p className="text-xs text-slate-400">PNG or SVG, min 256×256px, up to 2MB</p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Business details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name" required>
              <input className="input" value={form.company_name} onChange={(e) => update('company_name', e.target.value)} />
            </Field>
            <Field label="Business type" required>
              <input className="input" value={form.business_type} onChange={(e) => update('business_type', e.target.value)} />
            </Field>
            <Field label="Industry" required>
              <input className="input" value={form.industry} onChange={(e) => update('industry', e.target.value)} />
            </Field>
            <Field label="CIN">
              <input className="input" value={form.cin || ''} onChange={(e) => update('cin', e.target.value)} />
            </Field>
            <Field label="Contact number" required>
              <input className="input" value={form.contact_number} onChange={(e) => update('contact_number', e.target.value)} />
            </Field>
            <Field label="Business email" required>
              <input type="email" className="input" value={form.business_email} onChange={(e) => update('business_email', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Registered address</h3>
          <div className="space-y-4">
            <Field label="Address line" required>
              <input className="input" value={form.address_line} onChange={(e) => update('address_line', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" required>
                <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
              </Field>
              <Field label="State" required>
                <input className="input" value={form.state} onChange={(e) => update('state', e.target.value)} />
              </Field>
              <Field label="PIN code" required>
                <input className="input" value={form.pin_code} onChange={(e) => update('pin_code', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Tax &amp; compliance</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="GSTIN" required>
              <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} />
            </Field>
            <Field label="PAN">
              <input className="input" value={form.pan} onChange={(e) => update('pan', e.target.value.toUpperCase())} />
            </Field>
            <Field label="Default GST rate">
              <select className="input" value={form.default_gst_rate} onChange={(e) => update('default_gst_rate', e.target.value)}>
                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
            <Field label="Financial year start">
              <select className="input" value={form.financial_year_start} onChange={(e) => update('financial_year_start', e.target.value)}>
                {['January', 'April'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 1px #60a5fa;
        }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
