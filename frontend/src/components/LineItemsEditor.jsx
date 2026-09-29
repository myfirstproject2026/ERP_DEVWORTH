import React from 'react'
import { Plus, Trash2 } from 'lucide-react'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function LineItemsEditor({ items, onChange, products = null }) {
  const update = (idx, field, value) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(next)
  }

  const selectProduct = (idx, productId) => {
    const p = products?.find((p) => String(p.id) === String(productId))
    const next = items.map((it, i) =>
      i === idx
        ? {
            ...it,
            product_id: p ? p.id : null,
            product_name: p ? p.product_name : it.product_name,
            unit: p ? p.unit_of_measure : it.unit,
            unit_price: p ? p.cost_price : it.unit_price,
            tax_rate: p ? p.tax_rate : it.tax_rate,
          }
        : it
    )
    onChange(next)
  }

  const addRow = () => {
    onChange([...items, { product_name: '', product_id: null, quantity: 1, unit: 'unit', unit_price: 0, tax_rate: 18 }])
  }

  const removeRow = (idx) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  const lineTotal = (it) => {
    const base = Number(it.quantity || 0) * Number(it.unit_price || 0)
    return base + (base * Number(it.tax_rate || 0)) / 100
  }

  const subtotal = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0)
  const taxTotal = items.reduce((sum, it) => {
    const base = Number(it.quantity || 0) * Number(it.unit_price || 0)
    return sum + (base * Number(it.tax_rate || 0)) / 100
  }, 0)
  const grandTotal = subtotal + taxTotal

  return (
    <div>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] text-slate-400 bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 font-medium w-[32%]">PRODUCT</th>
              <th className="px-3 py-2 font-medium">QTY</th>
              <th className="px-3 py-2 font-medium">UNIT</th>
              <th className="px-3 py-2 font-medium">PRICE</th>
              <th className="px-3 py-2 font-medium">TAX %</th>
              <th className="px-3 py-2 font-medium text-right">TOTAL</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5">
                  {products ? (
                    <select
                      className="cell"
                      value={it.product_id || ''}
                      onChange={(e) => selectProduct(idx, e.target.value)}
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="cell"
                      value={it.product_name}
                      onChange={(e) => update(idx, 'product_name', e.target.value)}
                      placeholder="Product name"
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" step="0.01" className="cell w-16" value={it.quantity} onChange={(e) => update(idx, 'quantity', e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <input className="cell w-16" value={it.unit} onChange={(e) => update(idx, 'unit', e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" step="0.01" className="cell w-20" value={it.unit_price} onChange={(e) => update(idx, 'unit_price', e.target.value)} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" step="0.01" className="cell w-16" value={it.tax_rate} onChange={(e) => update(idx, 'tax_rate', e.target.value)} />
                </td>
                <td className="px-3 py-1.5 text-right font-medium text-slate-700">{formatINR(lineTotal(it))}</td>
                <td className="px-2 py-1.5 text-center">
                  <button type="button" onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 mt-2 text-xs text-brand-600 font-medium hover:underline"
      >
        <Plus size={13} /> Add line item
      </button>

      <div className="flex justify-end mt-3">
        <div className="w-56 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span><span>{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax</span><span>{formatINR(taxTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-900 pt-1.5 border-t border-slate-100">
            <span>Total</span><span>{formatINR(grandTotal)}</span>
          </div>
        </div>
      </div>

      <style>{`
        .cell { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.35rem 0.5rem; font-size: 0.8125rem; outline: none; }
        .cell:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
      `}</style>
    </div>
  )
}
