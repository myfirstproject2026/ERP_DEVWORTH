import React, { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { inventoryApi } from '../api/services'

function formatINR(value) {
  const n = Number(value || 0)
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export default function LineItemsEditor({ items, onChange, products = null }) {
  const update = (idx, field, value) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(next)
  }

  const selectProduct = (idx, p) => {
    const next = items.map((it, i) =>
      i === idx
        ? {
            ...it,
            product_id: p.id,
            product_name: p.product_name,
            unit: p.unit_of_measure,
            unit_price: p.cost_price,
            tax_rate: p.tax_rate,
          }
        : it
    )
    onChange(next)
  }

  // Typing edits the name only; the line stays unlinked until an existing product is picked.
  const typeProduct = (idx, text) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, product_name: text, product_id: null } : it)))
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
                    <ProductSearchInput
                      value={it.product_name}
                      linked={!!it.product_id}
                      initialProducts={products}
                      onType={(text) => typeProduct(idx, text)}
                      onSelect={(p) => selectProduct(idx, p)}
                    />
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

// Typeable product field; suggestions come from the existing inventory products search API.
function ProductSearchInput({ value, linked, initialProducts, onType, onSelect }) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState(initialProducts)
  const [pos, setPos] = useState(null)
  const inputRef = useRef(null)
  const reqId = useRef(0)

  useEffect(() => {
    if (!open) return
    const q = (value || '').trim()
    if (!q) { setResults(initialProducts); return }
    const id = ++reqId.current
    const t = setTimeout(() => {
      inventoryApi.listProducts({ search: q }).then((res) => {
        if (id === reqId.current) setResults(res.data)
      }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [value, open, initialProducts])

  const show = () => {
    const r = inputRef.current.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 260) })
    setOpen(true)
  }

  const pick = (p) => { onSelect(p); setOpen(false) }

  const handleBlur = () => {
    // Link automatically when the typed text exactly matches an existing product name.
    if (!linked) {
      const exact = results.find((p) => p.product_name.toLowerCase() === (value || '').trim().toLowerCase())
      if (exact) onSelect(exact)
    }
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div>
      <input
        ref={inputRef}
        className="cell"
        value={value}
        placeholder="Type product name..."
        autoComplete="off"
        onFocus={show}
        onChange={(e) => { onType(e.target.value); if (!open) show() }}
        onBlur={handleBlur}
      />
      {open && pos && (
        <ul
          className="fixed z-[60] max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          {results.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">No matching products</li>}
          {results.map((p) => (
            <li
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); pick(p) }}
              className="px-3 py-1.5 cursor-pointer hover:bg-slate-50 flex justify-between gap-3"
            >
              <span className="text-slate-800">{p.product_name}</span>
              <span className="text-xs text-slate-400">{p.sku}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
