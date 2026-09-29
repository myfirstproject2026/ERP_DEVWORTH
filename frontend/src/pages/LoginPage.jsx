import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { authApi } from  "../api/services";
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [mode, setMode] = useState('password') // 'password' | 'otp'
  const [identifier, setIdentifier] = useState('prasannaranganathan.2001@gmail.com')
  const [password, setPassword] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [demoOtp, setDemoOtp] = useState('')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(identifier, password, keepSignedIn)
      login(res.data.access_token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await authApi.sendOtp(identifier)
      setOtpSent(true)
      setDemoOtp(res.data.demo_otp || '')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.verifyOtp(identifier, otpCode)
      login(res.data.access_token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-800 to-navy-600 text-white flex-col justify-center px-16 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-white/5 -mb-24 -ml-24" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-16">
            <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm">DW</div>
            <span className="font-semibold">DevWorth Technologies ERP</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            One ERP.<br />Every company you run.
          </h1>
          <p className="text-navy-100 text-[15px] leading-relaxed max-w-md mb-16">
            Switch between companies, branches and teams in one login. Sales, inventory,
            manufacturing, HR and finance — with an AI assistant watching the numbers for you.
          </p>

          <div className="flex gap-10">
            <div>
              <p className="text-2xl font-bold">12</p>
              <p className="text-[11px] tracking-wide text-navy-200 font-medium">COMPANIES LIVE</p>
            </div>
            <div>
              <p className="text-2xl font-bold">₹4.8Cr</p>
              <p className="text-[11px] tracking-wide text-navy-200 font-medium">TRACKED THIS MONTH</p>
            </div>
            <div>
              <p className="text-2xl font-bold">99.9%</p>
              <p className="text-[11px] tracking-wide text-navy-200 font-medium">UPTIME</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-6">Sign in to continue to your workspace.</p>

          <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('password'); setOtpSent(false); setError('') }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'password' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => { setMode('otp'); setError('') }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'otp' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
            >
              OTP
            </button>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">User ID or email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Email or user ID"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 focus:outline-none text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Keep me signed in
                </label>
                <a href="#" className="text-brand-600 font-medium hover:underline">Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Sign in
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">User ID or mobile</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ravi.kumar or +91 90000 00000"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 focus:outline-none text-sm"
                />
              </div>

              {!otpSent ? (
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Send OTP to registered mobile
                </button>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {demoOtp && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      Demo mode — your OTP is <span className="font-mono font-semibold">{demoOtp}</span>
                    </p>
                  )}
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="6-digit OTP"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 focus:outline-none text-sm tracking-widest text-center"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Verify &amp; sign in
                  </button>
                </form>
              )}
            </div>
          )}

          {/* <p className="text-center text-sm text-slate-500 mt-6">
            New company?{' '}
            <Link to="/register" className="text-brand-600 font-medium hover:underline">
              Register your business →
            </Link>
          </p> */}
        </div>
      </div>
    </div>
  )
}
