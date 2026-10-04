import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react'
import client from '../../api/client'
import { companyApi, salesCrmApi } from '../../api/services'

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const label = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function InvoiceViewPage() {
  const { invoiceId } = useParams()
  const navigate = useNavigate()
  const sheetRef = useRef(null)
  const [invoice, setInvoice] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [company, setCompany] = useState(null)
  const [logoSrc, setLogoSrc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    setLoading(true)
    Promise.all([salesCrmApi.getInvoice(invoiceId), companyApi.getProfile()])
      .then(async ([invRes, coRes]) => {
        if (cancelled) return
        setInvoice(invRes.data)
        setCompany(coRes.data)
        salesCrmApi.getCustomer(invRes.data.customer_id).then((r) => !cancelled && setCustomer(r.data)).catch(() => {})
        if (coRes.data.logo_url) {
          // Load as a blob so the logo is same-origin for PDF capture.
          try {
            const img = await client.get(coRes.data.logo_url, { responseType: 'blob' })
            objectUrl = URL.createObjectURL(img.data)
            if (!cancelled) setLogoSrc(objectUrl)
          } catch { /* logo is optional */ }
        }
      })
      .catch((err) => !cancelled && setError(err.response?.data?.detail || 'Could not load invoice'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [invoiceId])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const canvas = await html2canvas(sheetRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width
      const img = canvas.toDataURL('image/png')
      let offset = 0
      pdf.addImage(img, 'PNG', 0, 0, pageW, imgH)
      while (imgH - offset > pageH) {
        offset += pageH
        pdf.addPage()
        pdf.addImage(img, 'PNG', 0, -offset, pageW, imgH)
      }
      pdf.save(`${invoice.invoice_number}.pdf`)
    } catch {
      alert('Could not generate the PDF')
    } finally {
      setDownloading(false)
    }
  }

  const back = () => navigate('/sales/invoices')

  if (loading) return <p className="py-10 text-center text-sm text-slate-400">Loading invoice…</p>
  if (error || !invoice) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-red-600 mb-3">{error || 'Invoice not found'}</p>
        <button onClick={back} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Back to invoices</button>
      </div>
    )
  }

  const companyAddress = company && [company.address_line, company.city, company.state, company.pin_code, company.country].filter(Boolean).join(', ')
  const customerAddress = customer?.city

  return (
    <div>
      <div className="invoice-toolbar flex items-center justify-between mb-4">
        <button onClick={back} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Printer size={15} /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download
          </button>
        </div>
      </div>

      <div id="invoice-print-area" ref={sheetRef} className="bg-white border border-slate-200 rounded-xl p-10 max-w-[800px] mx-auto text-slate-800 text-sm">
        <div className="flex items-start justify-between gap-6 pb-6 border-b-2 border-slate-800">
          <div className="flex items-start gap-4">
            {logoSrc && <img src={logoSrc} alt="Company logo" className="h-16 w-16 object-contain" />}
            {company && (
              <div>
                <h1 className="text-lg font-bold text-slate-900">{company.company_name}</h1>
                {companyAddress && <p className="text-xs text-slate-500 mt-1 max-w-xs">{companyAddress}</p>}
                {company.contact_number && <p className="text-xs text-slate-500">Phone: {company.contact_number}</p>}
                {company.business_email && <p className="text-xs text-slate-500">Email: {company.business_email}</p>}
                {company.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
                {company.pan && <p className="text-xs text-slate-500">PAN: {company.pan}</p>}
                {company.cin && <p className="text-xs text-slate-500">CIN: {company.cin}</p>}
              </div>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold tracking-wide text-slate-900">INVOICE</h2>
            <p className="text-sm font-semibold mt-1">{invoice.invoice_number}</p>
            <p className="text-xs text-slate-500 mt-2">Status: <span className="font-semibold text-slate-800">{label(invoice.status)}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-1">BILL TO</p>
            <p className="font-semibold text-slate-900">{invoice.customer_name}</p>
            {customerAddress && <p className="text-xs text-slate-500">{customerAddress}</p>}
            {customer?.phone && <p className="text-xs text-slate-500">Phone: {customer.phone}</p>}
            {customer?.email && <p className="text-xs text-slate-500">Email: {customer.email}</p>}
            {customer?.gstin && <p className="text-xs text-slate-500">GSTIN: {customer.gstin}</p>}
          </div>
          <div className="text-right text-xs space-y-1">
            <p><span className="text-slate-500">Invoice date: </span><span className="font-medium">{invoice.invoice_date}</span></p>
            <p><span className="text-slate-500">Due date: </span><span className="font-medium">{invoice.due_date || '—'}</span></p>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-600">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold text-right">Qty</th>
              <th className="px-3 py-2 font-semibold text-right">Price</th>
              <th className="px-3 py-2 font-semibold text-right">Tax</th>
              <th className="px-3 py-2 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-slate-800">{it.product_name}</p>
                  {it.description && <p className="text-slate-500">{it.description}</p>}
                </td>
                <td className="px-3 py-2.5 text-right">{Number(it.quantity)} {it.unit}</td>
                <td className="px-3 py-2.5 text-right">{money(it.unit_price)}</td>
                <td className="px-3 py-2.5 text-right">{Number(it.tax_rate)}%</td>
                <td className="px-3 py-2.5 text-right font-medium">{money(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-6">
          <div className="w-64 text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{money(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>{money(invoice.tax_amount)}</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-bold"><span>Total</span><span>{money(invoice.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Paid amount</span><span>{money(invoice.amount_paid)}</span></div>
            <div className="flex justify-between text-sm font-bold"><span>Balance due</span><span>{money(invoice.balance_due)}</span></div>
          </div>
        </div>

        {invoice.payments.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold text-slate-400 mb-1">PAYMENTS</p>
            <table className="w-full text-xs">
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1.5">{p.payment_date}</td>
                    <td className="py-1.5">{label(p.payment_method)}</td>
                    <td className="py-1.5 text-slate-500">{p.reference_number || ''}</td>
                    <td className="py-1.5 text-right font-medium">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invoice.notes && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold text-slate-400 mb-1">NOTES</p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: absolute; left: 0; top: 0; width: 100%; max-width: none !important;
            margin: 0 !important; border: none !important; border-radius: 0 !important; padding: 0 !important;
          }
          .invoice-toolbar { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
