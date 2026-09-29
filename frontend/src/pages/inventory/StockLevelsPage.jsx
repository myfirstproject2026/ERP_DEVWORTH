import React, { useEffect, useState, useCallback } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import { inventoryApi, branchesApi } from '../../api/services'

export default function StockLevelsPage() {
  const [levels, setLevels] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('All')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = { search: search || undefined, low_stock_only: lowStockOnly }
    if (branchFilter !== 'All') params.branch_id = branchFilter
    inventoryApi.listStockLevels(params).then((res) => setLevels(res.data)).finally(() => setLoading(false))
  }, [search, branchFilter, lowStockOnly])

  useEffect(() => { load() }, [load])
  useEffect(() => { branchesApi.list().then((res) => setBranches(res.data)) }, [])

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-brand-300 text-sm"
            />
          </div>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
            <option value="All">Branch: All</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 ml-auto">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} className="rounded border-slate-300" />
            Low stock only
          </label>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">PRODUCT</th>
              <th className="px-5 py-3 font-medium">BRANCH</th>
              <th className="px-5 py-3 font-medium text-right">ON HAND</th>
              <th className="px-5 py-3 font-medium text-right">RESERVED</th>
              <th className="px-5 py-3 font-medium text-right">AVAILABLE</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && levels.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{l.product_name}</p>
                  <p className="text-xs text-slate-400">{l.sku || '—'}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{l.branch_name}</td>
                <td className="px-5 py-3.5 text-right text-slate-700">{Number(l.quantity_on_hand).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3.5 text-right text-slate-500">{Number(l.quantity_reserved).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3.5 text-right font-medium text-slate-800">{Number(l.quantity_available).toLocaleString('en-IN')}</td>
                <td className="px-5 py-3.5">
                  {l.is_low_stock ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-red-600 bg-red-50">
                      <AlertTriangle size={11} /> Low stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-green-600 bg-green-50">
                      In stock
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && levels.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No stock records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
