import React, { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, PackageCheck, ArrowRightCircle, CheckCircle2, XCircle } from 'lucide-react'
import { manufacturingApi, branchesApi, inventoryApi } from '../../api/services'
import { StatusPill, PriorityPill } from './ManufacturingOverviewPage'

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState([])
  const [branches, setBranches] = useState([])
  const [products, setProducts] = useState([])
  const [boms, setBoms] = useState([])
  const [workCenters, setWorkCenters] = useState([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [stageModalOrder, setStageModalOrder] = useState(null)
  const [completeModalOrder, setCompleteModalOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = {}
    if (statusFilter !== 'All') params.status = statusFilter
    manufacturingApi.listWorkOrders(params).then((res) => setOrders(res.data)).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    branchesApi.list().then((res) => setBranches(res.data))
    inventoryApi.listProducts().then((res) => setProducts(res.data))
    manufacturingApi.listBoms().then((res) => setBoms(res.data))
    manufacturingApi.listWorkCenters().then((res) => setWorkCenters(res.data))
  }, [])

  const handleIssueMaterials = async (wo) => {
    if (!window.confirm(`Issue materials for ${wo.wo_number} per its BOM? This will consume stock.`)) return
    setBusyId(wo.id)
    try {
      await manufacturingApi.issueMaterials(wo.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not issue materials')
    } finally {
      setBusyId(null)
    }
  }

  const handleCancel = async (wo) => {
    if (!window.confirm(`Cancel ${wo.wo_number}?`)) return
    setBusyId(wo.id)
    try {
      await manufacturingApi.cancelWorkOrder(wo.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not cancel work order')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">
          <option value="All">Status: All</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
        >
          <Plus size={15} /> New work order
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">WO NUMBER</th>
              <th className="px-5 py-3 font-medium">PRODUCT</th>
              <th className="px-5 py-3 font-medium">STAGE</th>
              <th className="px-5 py-3 font-medium">PRIORITY</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading && orders.map((wo) => (
              <tr key={wo.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">{wo.wo_number}</p>
                  <p className="text-xs text-slate-400">{wo.branch_name}</p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {wo.product_name}
                  <p className="text-xs text-slate-400">
                    {wo.quantity_completed}/{wo.quantity_planned} units
                    {wo.materials_issued && <span className="text-green-600"> · materials issued</span>}
                  </p>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{wo.current_stage}</td>
                <td className="px-5 py-3.5"><PriorityPill priority={wo.priority} /></td>
                <td className="px-5 py-3.5"><StatusPill status={wo.status} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {(wo.status === 'draft' || wo.status === 'scheduled') && !wo.materials_issued && (
                      <ActionButton
                        icon={PackageCheck}
                        label="Issue materials"
                        busy={busyId === wo.id}
                        onClick={() => handleIssueMaterials(wo)}
                      />
                    )}
                    {wo.status === 'in_progress' && (
                      <>
                        <ActionButton icon={ArrowRightCircle} label="Advance stage" onClick={() => setStageModalOrder(wo)} />
                        <ActionButton icon={CheckCircle2} label="Complete" onClick={() => setCompleteModalOrder(wo)} />
                      </>
                    )}
                    {wo.status !== 'completed' && wo.status !== 'cancelled' && (
                      <ActionButton icon={XCircle} label="Cancel" danger busy={busyId === wo.id} onClick={() => handleCancel(wo)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No work orders found.</p>
        )}
      </div>

      {modalOpen && (
        <CreateWorkOrderModal
          branches={branches}
          products={products}
          boms={boms}
          workCenters={workCenters}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load() }}
        />
      )}
      {stageModalOrder && (
        <AdvanceStageModal
          workOrder={stageModalOrder}
          onClose={() => setStageModalOrder(null)}
          onSaved={() => { setStageModalOrder(null); load() }}
        />
      )}
      {completeModalOrder && (
        <CompleteWorkOrderModal
          workOrder={completeModalOrder}
          onClose={() => setCompleteModalOrder(null)}
          onSaved={() => { setCompleteModalOrder(null); load() }}
        />
      )}
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick, danger, busy }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={label}
      className={`h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-50 ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500'
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
    </button>
  )
}

function CreateWorkOrderModal({ branches, products, boms, workCenters, onClose, onSaved }) {
  const [form, setForm] = useState({
    branch_id: branches[0]?.id || '', product_id: '', bom_id: '', work_center_id: '',
    quantity_planned: 100, priority: 'medium', start_date: '', due_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const availableBoms = boms.filter((b) => !form.product_id || String(b.product_id) === String(form.product_id))
  const availableWorkCenters = workCenters.filter((wc) => !form.branch_id || String(wc.branch_id) === String(form.branch_id));

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await manufacturingApi.createWorkOrder({
        branch_id: Number(form.branch_id),
        product_id: Number(form.product_id),
        bom_id: form.bom_id || null,
        work_center_id: form.work_center_id || null,
        quantity_planned: Number(form.quantity_planned),
        priority: form.priority,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        notes: form.notes,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create work order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">New work order</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch" required>
              <select className="input" value={form.branch_id} onChange={(e) => update('branch_id', e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            </Field>
            <Field label="Product to build" required>
              <select className="input" value={form.product_id} onChange={(e) => update('product_id', e.target.value)}>
                <option value="">Select product...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bill of materials">
              <select className="input" value={form.bom_id} onChange={(e) => update('bom_id', e.target.value)}>
                <option value="">Auto (active BOM for product)</option>
                {availableBoms.map((b) => <option key={b.id} value={b.id}>{b.bom_name} ({b.version})</option>)}
              </select>
            </Field>
            <Field label="Work center">
              <select className="input" value={form.work_center_id} onChange={(e) => update('work_center_id', e.target.value)}>
                <option value="">Unassigned</option>
                {availableWorkCenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity to produce" required>
              <input type="number" className="input" value={form.quantity_planned} onChange={(e) => update('quantity_planned', e.target.value)} />
            </Field>
            <Field label="Priority">
              <select className="input" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <input type="date" className="input" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
            </Field>
            <Field label="Due date">
              <input type="date" className="input" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.branch_id || !form.product_id || !form.quantity_planned}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create work order
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #60a5fa; box-shadow: 0 0 0 1px #60a5fa; }
      `}</style>
    </div>
  )
}

const STAGES = ['Raw Material Prep', 'Machining', 'Assembly', 'Quality Checking', 'Packaging', 'Completed']

function AdvanceStageModal({ workOrder, onClose, onSaved }) {
  const [stage, setStage] = useState(workOrder.current_stage)
  const [progress, setProgress] = useState(workOrder.progress_pct)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await manufacturingApi.advanceStage(workOrder.id, { current_stage: stage, progress_pct: Number(progress) })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not advance stage')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Advance stage — {workOrder.wo_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-4">
          <Field label="Current stage">
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={`Progress: ${progress}%`}>
            <input type="range" min={0} max={100} className="w-full" value={progress} onChange={(e) => setProgress(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save progress
          </button>
        </div>
      </div>
      <style>{`.input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }`}</style>
    </div>
  )
}

function CompleteWorkOrderModal({ workOrder, onClose, onSaved }) {
  const remaining = workOrder.quantity_planned - workOrder.quantity_completed
  const [qty, setQty] = useState(remaining)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await manufacturingApi.completeWorkOrder(workOrder.id, { quantity_completed: Number(qty) })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not complete work order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-900">Complete — {workOrder.wo_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <p className="text-xs text-slate-500 mb-3">
          This adds finished goods to stock at {workOrder.branch_name} and marks the work order completed.
        </p>
        <Field label="Quantity produced" required>
          <input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !qty || qty <= 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Mark completed
          </button>
        </div>
      </div>
      <style>{`.input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }`}</style>
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
