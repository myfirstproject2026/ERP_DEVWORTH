import React, { useEffect, useState } from 'react'
import { Timer, Loader2, Check } from 'lucide-react'
import { serviceDeskApi } from '../../api/services'

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low']
const PRIORITY_LABELS = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_COLORS = {
  urgent: 'text-red-600 bg-red-50',
  high: 'text-amber-600 bg-amber-50',
  medium: 'text-blue-600 bg-blue-50',
  low: 'text-slate-600 bg-slate-100',
}

export default function SlaPoliciesPage() {
  const [policies, setPolicies] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingPriority, setSavingPriority] = useState(null)
  const [savedFlash, setSavedFlash] = useState(null)

  const load = () => {
    setLoading(true)
    serviceDeskApi.listSlaPolicies().then((res) => {
      const byPriority = {}
      res.data.forEach((p) => { byPriority[p.priority] = p })
      setPolicies(byPriority)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const updateField = (priority, field, value) => {
    setPolicies((prev) => ({
      ...prev,
      [priority]: { ...(prev[priority] || { priority }), [field]: value },
    }))
  }

  const savePolicy = async (priority) => {
    const p = policies[priority]
    setSavingPriority(priority)
    try {
      await serviceDeskApi.upsertSlaPolicy({
        priority,
        response_hours: Number(p.response_hours),
        resolution_hours: Number(p.resolution_hours),
      })
      setSavedFlash(priority)
      setTimeout(() => setSavedFlash(null), 1500)
      load()
    } finally {
      setSavingPriority(null)
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Set how quickly a first response and full resolution are expected for each ticket priority.
        Tickets past these targets are flagged as an SLA breach automatically.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">PRIORITY</th>
              <th className="px-5 py-3 font-medium">RESPONSE TARGET (HOURS)</th>
              <th className="px-5 py-3 font-medium">RESOLUTION TARGET (HOURS)</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && PRIORITY_ORDER.map((priority) => {
              const p = policies[priority] || { response_hours: '', resolution_hours: '' }
              return (
                <tr key={priority} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${PRIORITY_COLORS[priority]}`}>
                      <Timer size={12} /> {PRIORITY_LABELS[priority]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <input
                      type="number"
                      min="0"
                      className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-300"
                      value={p.response_hours}
                      onChange={(e) => updateField(priority, 'response_hours', e.target.value)}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <input
                      type="number"
                      min="0"
                      className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-300"
                      value={p.resolution_hours}
                      onChange={(e) => updateField(priority, 'resolution_hours', e.target.value)}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => savePolicy(priority)}
                      disabled={savingPriority === priority || !p.response_hours || !p.resolution_hours}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      {savingPriority === priority ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : savedFlash === priority ? (
                        <Check size={13} className="text-green-600" />
                      ) : null}
                      {savedFlash === priority ? 'Saved' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
