import { jsPDF } from 'jspdf'
import client from '../api/client'
import { companyApi, hrApi } from '../api/services'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// jsPDF's built-in fonts have no rupee glyph, so amounts are prefixed "Rs."
const money = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const label = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '')

// Fetch the stored logo through the API client and re-encode as PNG (handles svg/webp too).
async function loadLogo(logoUrl) {
  if (!logoUrl) return null
  try {
    const res = await client.get(logoUrl, { responseType: 'blob' })
    const bitmapUrl = URL.createObjectURL(res.data)
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = bitmapUrl
    })
    const w = img.naturalWidth || 300
    const h = img.naturalHeight || 300
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(bitmapUrl)
    return { data: canvas.toDataURL('image/png'), w, h }
  } catch {
    return null
  }
}

export async function downloadPayslipPdf(payslipId) {
  const [detailRes, companyRes] = await Promise.all([hrApi.getPayslipDetail(payslipId), companyApi.getProfile()])
  const p = detailRes.data
  const c = companyRes.data
  const logo = await loadLogo(c.logo_url)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  let y = 14

  // ---- Header: logo, company name, address/contact
  let textX = M
  if (logo) {
    const box = 22
    const ratio = Math.min(box / logo.w, box / logo.h)
    const lw = logo.w * ratio
    const lh = logo.h * ratio
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
    textX = M + box + 5
  }
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(15, 23, 42)
  doc.text(c.company_name, textX, y + 6)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139)
  const addr = [c.address_line, [c.city, c.state].filter(Boolean).join(', '), [c.country, c.pin_code].filter(Boolean).join(' - ')]
    .filter(Boolean).join(', ')
  const addrLines = doc.splitTextToSize(addr, W - textX - M)
  doc.text(addrLines, textX, y + 11)
  let cy = y + 11 + addrLines.length * 4
  const contact = [c.contact_number && `Phone: ${c.contact_number}`, c.business_email && `Email: ${c.business_email}`].filter(Boolean).join('   ')
  if (contact) { doc.text(contact, textX, cy); cy += 4 }
  const ids = [c.gstin && `GSTIN: ${c.gstin}`, c.cin && `CIN: ${c.cin}`].filter(Boolean).join('   ')
  if (ids) { doc.text(ids, textX, cy); cy += 4 }

  y = Math.max(cy, y + 24) + 2
  doc.setDrawColor(203, 213, 225).line(M, y, W - M, y)
  y += 8

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(15, 23, 42)
  doc.text(`Payslip for ${MONTHS[p.pay_month - 1]} ${p.pay_year}`, W / 2, y, { align: 'center' })
  y += 8

  // ---- Key/value block helper (two columns)
  const kvBlock = (title, rows) => {
    doc.setFillColor(241, 245, 249).rect(M, y, W - 2 * M, 7, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(51, 65, 85)
    doc.text(title, M + 3, y + 5)
    y += 11
    const colW = (W - 2 * M) / 2
    rows.forEach((r, i) => {
      const x = M + 3 + (i % 2) * colW
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139)
      doc.text(`${r[0]}:`, x, y)
      doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
      doc.text(String(r[1]), x + 34, y)
      if (i % 2 === 1 || i === rows.length - 1) y += 6
    })
    y += 3
  }

  kvBlock('Employee Details', [
    ['Employee Name', p.employee_name],
    ['Employee ID', p.employee_code],
    ['Department', p.department_name || '-'],
    ['Designation', p.designation],
    ['Joining Date', fmtDate(p.date_of_joining)],
    ['Pay Period', `${MONTHS[p.pay_month - 1]} ${p.pay_year}`],
    ['Branch', p.branch_name],
    ['Employment Type', label(p.employment_type)],
    ...(p.pan ? [['PAN', p.pan]] : []),
    ...(p.bank_account_number ? [['Bank A/C', p.bank_account_number]] : []),
    ...(p.bank_ifsc ? [['IFSC', p.bank_ifsc]] : []),
    ['Status', label(p.status) + (p.paid_on ? ` (${fmtDate(p.paid_on)})` : '')],
  ])

  // ---- Attendance & leave (only values present in the system)
  const att = []
  if (p.attendance_recorded > 0) {
    att.push(['Days Recorded', p.attendance_recorded], ['Present Days', p.present_days], ['Half Days', p.half_days],
      ['Absent Days', p.absent_days], ['On Leave Days', p.on_leave_days])
    if (p.holiday_days) att.push(['Holidays', p.holiday_days])
    if (p.week_off_days) att.push(['Week Offs', p.week_off_days])
  }
  p.leave_lines.forEach((l) => att.push([`${l.leave_type_name} (${l.is_paid ? 'Paid' : 'Unpaid'})`, `${Number(l.days)} day(s)`]))
  if (att.length) kvBlock('Attendance & Leave', att)

  // ---- Earnings | Deductions side by side
  const half = (W - 2 * M - 6) / 2
  const earnings = [['Basic Salary', p.basic], ['HRA', p.hra], ['Other Allowances', p.other_allowances]]
  const totalEarnings = earnings.reduce((s, r) => s + Number(r[1] || 0), 0)
  const drawTable = (x, title, rows, totalLabel, total) => {
    let ty = y
    doc.setFillColor(241, 245, 249).rect(x, ty, half, 7, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(51, 65, 85)
    doc.text(title, x + 3, ty + 5)
    doc.text('Amount', x + half - 3, ty + 5, { align: 'right' })
    ty += 12
    rows.forEach((r) => {
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(51, 65, 85)
      doc.text(r[0], x + 3, ty)
      doc.text(money(r[1]), x + half - 3, ty, { align: 'right' })
      ty += 6
    })
    doc.setDrawColor(203, 213, 225).line(x, ty - 2, x + half, ty - 2)
    ty += 3
    doc.setFont('helvetica', 'bold').setTextColor(15, 23, 42)
    doc.text(totalLabel, x + 3, ty)
    doc.text(money(total), x + half - 3, ty, { align: 'right' })
    return ty
  }
  const e = drawTable(M, 'Earnings', earnings, 'Total Earnings', totalEarnings)
  const d = drawTable(M + half + 6, 'Deductions', [['Total Deductions', p.deductions]], 'Total Deductions', p.deductions)
  y = Math.max(e, d) + 10

  // ---- Net pay
  doc.setFillColor(15, 23, 42).rect(M, y, W - 2 * M, 12, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255)
  doc.text('Net Pay', M + 4, y + 8)
  doc.text(money(p.net_pay), W - M - 4, y + 8, { align: 'right' })

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(148, 163, 184)
  doc.text('This is a system-generated payslip.', W / 2, 287, { align: 'center' })

  const safeName = p.employee_name.replace(/[^a-z0-9]+/gi, '_')
  doc.save(`Payslip_${safeName}_${MONTHS[p.pay_month - 1]}_${p.pay_year}.pdf`)
}
