import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Globe2, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import { Country, State } from "country-state-city";
import { authApi } from  "../api/services";
import { useAuth } from '../context/AuthContext'

const STEPS = ['Business Info', 'Address & Tax', 'Branding', 'Review']

const INDUSTRIES = ['Manufacturing', 'Retail', 'Trading', 'Services', 'IT / Software', 'Healthcare', 'Construction', 'Other']
const BUSINESS_TYPES = ['Private Limited Company', 'Public Limited Company', 'Partnership', 'LLP', 'Proprietorship']
const STATES = ['Tamil Nadu', 'Karnataka', 'Telangana', 'Maharashtra', 'Delhi', 'Gujarat', 'Kerala', 'Other']
const COUNTRIES = Country.getAllCountries();

const getStates = (countryName) => {
  const country = COUNTRIES.find((c) => c.name === countryName);
  if (!country) return [];

  return State.getStatesOfCountry(country.isoCode);
};

export default function RegisterCompanyPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    company_name: '',
    business_type: BUSINESS_TYPES[0],
    industry: INDUSTRIES[0],
    cin: '',
    contact_number: '',
    business_email: '',
    address_line: '',
    city: '',
    state: STATES[0],
    pin_code: '',
    country: 'India',
    gstin: '',
    pan: '',
    default_gst_rate: 18,
    financial_year_start: 'April',
    owner_full_name: '',
    owner_password: '',
  })

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

const next = () => {
  let newErrors = {};

  if (step === 0) {
    if (!form.company_name.trim()) newErrors.company_name = "Company Name is required";
    if (!form.contact_number.trim()) newErrors.contact_number = "Contact Number is required";
    if (!form.business_email.trim()) newErrors.business_email = "Business Email is required";
    if (!form.owner_full_name.trim()) newErrors.owner_full_name = "Owner Name is required";
    if (!form.owner_password.trim()) newErrors.owner_password = "Password is required";
  }

  if (step === 1) {
    if (!form.address_line.trim()) newErrors.address_line = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.state.trim()) newErrors.state = "State is required";
    if (!form.pin_code.trim()) newErrors.pin_code = "PIN Code is required";
    if (!form.country.trim()) newErrors.country = "Country is required";
    if (!form.gstin.trim()) newErrors.gstin = "GSTIN is required";
    if (!form.pan.trim()) newErrors.pan = "PAN is required";
  }

  setErrors(newErrors);

  if (Object.keys(newErrors).length > 0) return;

  setStep((s) => Math.min(s + 1, STEPS.length - 1));
};

const back = () => {
  setErrors({});
  setStep((s) => Math.max(s - 1, 0));
};

const handleSubmit = async () => {
  try {
    setLoading(true);
    setError("");

    const response = await authApi.registerCompany(form);

    login(response);

    navigate("/dashboard");
  } catch (err) {
    setError(
      err?.response?.data?.detail ||
      "Unable to register company."
    );
  } finally {
    setLoading(false);
  }
};
return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-14 border-b border-slate-200 bg-white flex items-center px-6 gap-2">
        <div className="h-7 w-7 rounded bg-navy-700 text-white flex items-center justify-center font-bold text-xs">DW</div>
        <span className="font-semibold text-sm text-slate-900"> Devworth ERP</span>
        <span className="text-slate-300">—</span>
        <span className="text-sm text-slate-500">Company Registration</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Register your company</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">Set up your first company. You can add more companies anytime from Settings.</p>

        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    i < step ? 'bg-green-500 text-white' :
                    i === step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] ${i === step ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Building2 size={18} /> Business details
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Company name" required>
                  <input className="input" value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="Sundar Precision Pvt Ltd" />
                </Field>
                <Field label="Business type" required>
                  <select className="input" value={form.business_type} onChange={(e) => update('business_type', e.target.value)}>
                    {BUSINESS_TYPES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Industry" required>
                  <select className="input" value={form.industry} onChange={(e) => update('industry', e.target.value)}>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Registration / CIN number">
                  <input className="input" value={form.cin} onChange={(e) => update('cin', e.target.value)} placeholder="U29100TN2015PTC098234" />
                </Field>
                <Field label="Primary contact number" required>
                  <input className="input" value={form.contact_number} onChange={(e) => update('contact_number', e.target.value)} placeholder="+91 98410 22456" />
                </Field>
                <Field label="Business email" required>
                  <input type="email" className="input" value={form.business_email} onChange={(e) => update('business_email', e.target.value)} placeholder="accounts@company.com" />
                </Field>
              </div>
              <Field label="Owner full name" required>
                <input className="input" value={form.owner_full_name} onChange={(e) => update('owner_full_name', e.target.value)} placeholder="Your full name" />
              </Field>
              <Field label="Set a password" required>
                <input type="password" className="input" value={form.owner_password} onChange={(e) => update('owner_password', e.target.value)} placeholder="Minimum 8 characters" />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Globe2 size={18} /> Registered address
              </div>
              <Field label="Address line" required>
                <input className="input" value={form.address_line} onChange={(e) => update('address_line', e.target.value)} placeholder="Plot 14, SIDCO Industrial Estate, Ambattur" />
              </Field>
              {errors.address_line && (
  <p className="text-red-600 text-sm mt-1">
    {errors.address_line}
  </p>
)}
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" required>
                  <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Chennai" />
                </Field>
                {errors.city && (
<p className="text-red-600 text-sm mt-1">
{errors.city}
</p>
)}
                
               <Field label="State" required>
  <select
    className="input"
    value={form.state}
    onChange={(e) => update('state', e.target.value)}
  >
    <option value="">Select State</option>

    {getStates(form.country).map((state) => (
      <option
        key={state.isoCode}
        value={state.name}
      >
        {state.name}
      </option>
    ))}
  </select>
</Field>
                <Field label="PIN code" required>
                  <input className="input" value={form.pin_code} onChange={(e) => update('pin_code', e.target.value)} placeholder="600058" />
                </Field>
                {errors.pin_code && (
<p className="text-red-600 text-sm mt-1">
{errors.pin_code}
</p>
)}
                <Field label="Country">
  <select
    className="input"
    value={form.country}
    onChange={(e) => update('country', e.target.value)}
  >
    {COUNTRIES.map((country) => (
      <option
        key={country.isoCode}
        value={country.name}
      >
        {country.name}
      </option>
    ))}
  </select>
</Field>
              </div>

              <div className="flex items-center gap-2 text-slate-900 font-semibold pt-2">
                <ShieldCheck size={18} /> Tax &amp; compliance
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="GSTIN" required>
                  <input className="input" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} placeholder="33AAECS1234F1Z5" />
                </Field>
                {errors.gstin && (
<p className="text-red-600 text-sm mt-1">
{errors.gstin}
</p>
)}
                <Field label="PAN" required>
                  <input className="input" value={form.pan} onChange={(e) => update('pan', e.target.value.toUpperCase())} placeholder="AAECS1234F" />
                </Field>
                {errors.pan && (
<p className="text-red-600 text-sm mt-1">
{errors.pan}
</p>
)}
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
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">Branding</div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg">
                  {form.company_name ? form.company_name.slice(0, 2).toUpperCase() : 'SP'}
                </div>
                <div className="border border-dashed border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-500 flex-1">
                  Upload company logo
                  <p className="text-xs text-slate-400 mt-0.5">PNG or SVG, min 256×256px, up to 2MB</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">You can update branding anytime from Company Profile → Branding after setup.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-slate-900 mb-2">Review your details</p>
              <ReviewRow label="Company" value={form.company_name} />
              <ReviewRow label="Type" value={form.business_type} />
              <ReviewRow label="Industry" value={form.industry} />
              <ReviewRow label="Email" value={form.business_email} />
              <ReviewRow label="Address" value={`${form.address_line}, ${form.city}, ${form.state} ${form.pin_code}`} />
              <ReviewRow label="GSTIN" value={form.gstin} />
              <ReviewRow label="PAN" value={form.pan} />
              <ReviewRow label="Owner" value={form.owner_full_name} />
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
            <button
              onClick={back}
              disabled={step === 0}
              className="flex items-center gap-1 text-sm text-slate-500 disabled:opacity-0 hover:text-slate-800"
            >
              <ArrowLeft size={15} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <div className="flex items-center gap-3">
                <button className="text-sm text-slate-500 hover:text-slate-800">Save as draft</button>
                <button
                  onClick={next}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
                >
                  Continue
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Create company &amp; sign in
              </button>
            )}
          </div>
        </div>
      </div>

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

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  )
}
