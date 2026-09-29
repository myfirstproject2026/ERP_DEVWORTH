import client from './client'

// ============================================================
// AUTH
// ============================================================
export const authApi = {
  login: (identifier, password, keepSignedIn = true) =>
    client.post('/api/auth/login', { identifier, password, keep_signed_in: keepSignedIn }),

  sendOtp: (identifier) => client.post('/api/auth/send-otp', { identifier }),

  verifyOtp: (identifier, otp_code) => client.post('/api/auth/verify-otp', { identifier, otp_code }),

  registerCompany: (payload) => client.post('/api/auth/register-company', payload),

  me: () => client.get('/api/auth/me'),
}

// ============================================================
// COMPANY
// ============================================================
export const companyApi = {
  getProfile: () => client.get('/api/company/profile'),
  updateProfile: (payload) => client.put('/api/company/profile', payload),
  getSnapshot: () => client.get('/api/company/snapshot'),
}

// ============================================================
// BRANCHES
// ============================================================
export const branchesApi = {
  list: (params = {}) => client.get('/api/branches', { params }),
  stats: () => client.get('/api/branches/stats'),
  create: (payload) => client.post('/api/branches', payload),
  get: (id) => client.get(`/api/branches/${id}`),
  update: (id, payload) => client.put(`/api/branches/${id}`, payload),
  remove: (id) => client.delete(`/api/branches/${id}`),
}

// ============================================================
// USERS
// ============================================================
export const usersApi = {
  list: (params = {}) => client.get('/api/users', { params }),
  stats: () => client.get('/api/users/stats'),
  invite: (payload) => client.post('/api/users/invite', payload),
  get: (id) => client.get(`/api/users/${id}`),
  update: (id, payload) => client.put(`/api/users/${id}`, payload),
  remove: (id) => client.delete(`/api/users/${id}`),
}

// ============================================================
// ROLES
// ============================================================
export const rolesApi = {
  list: () => client.get('/api/roles'),
  create: (payload) => client.post('/api/roles', payload),
  get: (id) => client.get(`/api/roles/${id}`),
  update: (id, payload) => client.put(`/api/roles/${id}`, payload),
  updatePermissions: (id, permissions) => client.put(`/api/roles/${id}/permissions`, { permissions }),
  remove: (id) => client.delete(`/api/roles/${id}`),
  modules: () => client.get('/api/roles/meta/modules'),
}

// ============================================================
// DASHBOARD
// ============================================================
export const dashboardApi = {
  summary: () => client.get('/api/dashboard/summary'),
  profitLoss: () => client.get('/api/dashboard/profit-loss'),
  production: () => client.get('/api/dashboard/production'),
  attendance: () => client.get('/api/dashboard/attendance'),
  customerFollowup: () => client.get('/api/dashboard/customer-followup'),
}

// ============================================================
// AI ASSISTANT
// ============================================================
export const aiApi = {
  channels: () => client.get('/api/ai/channels'),
  latestConversation: () => client.get('/api/ai/conversations/latest'),
  ask: (message, conversationId = null) =>
    client.post('/api/ai/ask', { message, conversation_id: conversationId }),
}

// ============================================================
// SALES + CRM
// ============================================================
export const salesCrmApi = {
  // Customers
  listCustomers: (params = {}) => client.get('/api/sales/customers', { params }),
  customerStats: () => client.get('/api/sales/customers/stats'),
  createCustomer: (payload) => client.post('/api/sales/customers', payload),
  getCustomer: (id) => client.get(`/api/sales/customers/${id}`),
  updateCustomer: (id, payload) => client.put(`/api/sales/customers/${id}`, payload),
  removeCustomer: (id) => client.delete(`/api/sales/customers/${id}`),

  // Leads
  listLeads: (params = {}) => client.get('/api/sales/leads', { params }),
  leadStats: () => client.get('/api/sales/leads/stats'),
  createLead: (payload) => client.post('/api/sales/leads', payload),
  updateLead: (id, payload) => client.put(`/api/sales/leads/${id}`, payload),
  convertLead: (id) => client.post(`/api/sales/leads/${id}/convert`),
  removeLead: (id) => client.delete(`/api/sales/leads/${id}`),

  // Quotations
  listQuotations: (params = {}) => client.get('/api/sales/quotations', { params }),
  getQuotation: (id) => client.get(`/api/sales/quotations/${id}`),
  createQuotation: (payload) => client.post('/api/sales/quotations', payload),
  updateQuotation: (id, payload) => client.put(`/api/sales/quotations/${id}`, payload),
  convertQuotationToOrder: (id) => client.post(`/api/sales/quotations/${id}/convert-to-order`),
  removeQuotation: (id) => client.delete(`/api/sales/quotations/${id}`),

  // Sales Orders
  listOrders: (params = {}) => client.get('/api/sales/orders', { params }),
  getOrder: (id) => client.get(`/api/sales/orders/${id}`),
  createOrder: (payload) => client.post('/api/sales/orders', payload),
  updateOrder: (id, payload) => client.put(`/api/sales/orders/${id}`, payload),
  removeOrder: (id) => client.delete(`/api/sales/orders/${id}`),

  // Invoices
  listInvoices: (params = {}) => client.get('/api/sales/invoices', { params }),
  getInvoice: (id) => client.get(`/api/sales/invoices/${id}`),
  createInvoice: (payload) => client.post('/api/sales/invoices', payload),
  updateInvoice: (id, payload) => client.put(`/api/sales/invoices/${id}`, payload),
  recordPayment: (id, payload) => client.post(`/api/sales/invoices/${id}/payments`, payload),
  removeInvoice: (id) => client.delete(`/api/sales/invoices/${id}`),

  // Pipeline summary (for the module's own dashboard strip)
  pipelineSummary: () => client.get('/api/sales/pipeline-summary'),
}

// ============================================================
// INVENTORY
// ============================================================
export const inventoryApi = {
  overview: () => client.get('/api/inventory/overview'),

  // Products
  listProducts: (params = {}) => client.get('/api/inventory/products', { params }),
  productStats: () => client.get('/api/inventory/products/stats'),
  createProduct: (payload) => client.post('/api/inventory/products', payload),
  getProduct: (id) => client.get(`/api/inventory/products/${id}`),
  updateProduct: (id, payload) => client.put(`/api/inventory/products/${id}`, payload),
  removeProduct: (id) => client.delete(`/api/inventory/products/${id}`),

  // Stock levels
  listStockLevels: (params = {}) => client.get('/api/inventory/stock-levels', { params }),

  // Movements (read-only ledger)
  listMovements: (params = {}) => client.get('/api/inventory/movements', { params }),

  // Transfers
  listTransfers: (params = {}) => client.get('/api/inventory/transfers', { params }),
  getTransfer: (id) => client.get(`/api/inventory/transfers/${id}`),
  createTransfer: (payload) => client.post('/api/inventory/transfers', payload),
  updateTransfer: (id, payload) => client.put(`/api/inventory/transfers/${id}`, payload),
  removeTransfer: (id) => client.delete(`/api/inventory/transfers/${id}`),

  // Adjustments
  listAdjustments: (params = {}) => client.get('/api/inventory/adjustments', { params }),
  getAdjustment: (id) => client.get(`/api/inventory/adjustments/${id}`),
  createAdjustment: (payload) => client.post('/api/inventory/adjustments', payload),
  completeAdjustment: (id) => client.put(`/api/inventory/adjustments/${id}/complete`),
  removeAdjustment: (id) => client.delete(`/api/inventory/adjustments/${id}`),
}

// ============================================================
// PURCHASE
// ============================================================
export const purchaseApi = {
  overview: () => client.get('/api/purchase/overview'),

  // Suppliers
  listSuppliers: (params = {}) => client.get('/api/purchase/suppliers', { params }),
  supplierStats: () => client.get('/api/purchase/suppliers/stats'),
  createSupplier: (payload) => client.post('/api/purchase/suppliers', payload),
  getSupplier: (id) => client.get(`/api/purchase/suppliers/${id}`),
  updateSupplier: (id, payload) => client.put(`/api/purchase/suppliers/${id}`, payload),
  removeSupplier: (id) => client.delete(`/api/purchase/suppliers/${id}`),

  // Purchase Orders
  listOrders: (params = {}) => client.get('/api/purchase/orders', { params }),
  getOrder: (id) => client.get(`/api/purchase/orders/${id}`),
  createOrder: (payload) => client.post('/api/purchase/orders', payload),
  updateOrder: (id, payload) => client.put(`/api/purchase/orders/${id}`, payload),
  removeOrder: (id) => client.delete(`/api/purchase/orders/${id}`),

  // Goods Receipts (GRN)
  listReceipts: (params = {}) => client.get('/api/purchase/receipts', { params }),
  getReceipt: (id) => client.get(`/api/purchase/receipts/${id}`),
  createReceipt: (payload) => client.post('/api/purchase/receipts', payload),
  completeReceipt: (id) => client.put(`/api/purchase/receipts/${id}/complete`),

  // Bills
  listBills: (params = {}) => client.get('/api/purchase/bills', { params }),
  getBill: (id) => client.get(`/api/purchase/bills/${id}`),
  createBill: (payload) => client.post('/api/purchase/bills', payload),
  removeBill: (id) => client.delete(`/api/purchase/bills/${id}`),
  recordPayment: (id, payload) => client.post(`/api/purchase/bills/${id}/payments`, payload),
}

// ============================================================
// MANUFACTURING
// ============================================================
export const manufacturingApi = {
  overview: () => client.get('/api/manufacturing/overview'),
  stages: () => client.get('/api/manufacturing/stages'),

  // Work Centers
  listWorkCenters: () => client.get('/api/manufacturing/work-centers'),
  createWorkCenter: (payload) => client.post('/api/manufacturing/work-centers', payload),
  updateWorkCenter: (id, payload) => client.put(`/api/manufacturing/work-centers/${id}`, payload),
  removeWorkCenter: (id) => client.delete(`/api/manufacturing/work-centers/${id}`),

  // Bill of Materials
  listBoms: (params = {}) => client.get('/api/manufacturing/boms', { params }),
  getBom: (id) => client.get(`/api/manufacturing/boms/${id}`),
  createBom: (payload) => client.post('/api/manufacturing/boms', payload),
  updateBom: (id, payload) => client.put(`/api/manufacturing/boms/${id}`, payload),
  removeBom: (id) => client.delete(`/api/manufacturing/boms/${id}`),

  // Work Orders
  listWorkOrders: (params = {}) => client.get('/api/manufacturing/work-orders', { params }),
  getWorkOrder: (id) => client.get(`/api/manufacturing/work-orders/${id}`),
  createWorkOrder: (payload) => client.post('/api/manufacturing/work-orders', payload),
  updateWorkOrder: (id, payload) => client.put(`/api/manufacturing/work-orders/${id}`, payload),
  removeWorkOrder: (id) => client.delete(`/api/manufacturing/work-orders/${id}`),
  issueMaterials: (id) => client.put(`/api/manufacturing/work-orders/${id}/issue-materials`),
  advanceStage: (id, payload) => client.put(`/api/manufacturing/work-orders/${id}/advance-stage`, payload),
  completeWorkOrder: (id, payload) => client.put(`/api/manufacturing/work-orders/${id}/complete`, payload),
  cancelWorkOrder: (id) => client.put(`/api/manufacturing/work-orders/${id}/cancel`),
}

// ============================================================
// HR & EMPLOYEE
// ============================================================
export const hrApi = {
  overview: () => client.get('/api/hr/overview'),

  // Departments
  listDepartments: () => client.get('/api/hr/departments'),
  createDepartment: (payload) => client.post('/api/hr/departments', payload),
  updateDepartment: (id, payload) => client.put(`/api/hr/departments/${id}`, payload),
  removeDepartment: (id) => client.delete(`/api/hr/departments/${id}`),

  // Employees
  listEmployees: (params = {}) => client.get('/api/hr/employees', { params }),
  employeeStats: () => client.get('/api/hr/employees/stats'),
  getEmployee: (id) => client.get(`/api/hr/employees/${id}`),
  createEmployee: (payload) => client.post('/api/hr/employees', payload),
  updateEmployee: (id, payload) => client.put(`/api/hr/employees/${id}`, payload),
  removeEmployee: (id) => client.delete(`/api/hr/employees/${id}`),
  getLeaveBalance: (id, year) => client.get(`/api/hr/employees/${id}/leave-balance`, { params: year ? { year } : {} }),

  // Leave
  listLeaveTypes: () => client.get('/api/hr/leave-types'),
  listLeaveRequests: (params = {}) => client.get('/api/hr/leave-requests', { params }),
  createLeaveRequest: (payload) => client.post('/api/hr/leave-requests', payload),
  decideLeaveRequest: (id, payload) => client.put(`/api/hr/leave-requests/${id}/decision`, payload),

  // Attendance
  listAttendance: (params = {}) => client.get('/api/hr/attendance', { params }),
  attendanceSummary: (attendance_date) => client.get('/api/hr/attendance/summary', { params: attendance_date ? { attendance_date } : {} }),
  bulkMarkAttendance: (payload) => client.post('/api/hr/attendance/bulk-mark', payload),

  // Payslips
  listPayslips: (params = {}) => client.get('/api/hr/payslips', { params }),
  createPayslip: (payload) => client.post('/api/hr/payslips', payload),
  markPayslipPaid: (id) => client.put(`/api/hr/payslips/${id}/mark-paid`),
}

// ============================================================
// FINANCE & GST
// ============================================================
export const financeApi = {
  overview: () => client.get('/api/finance/overview'),

  // Chart of Accounts
  listAccounts: (params = {}) => client.get('/api/finance/accounts', { params }),
  createAccount: (payload) => client.post('/api/finance/accounts', payload),
  updateAccount: (id, payload) => client.put(`/api/finance/accounts/${id}`, payload),
  removeAccount: (id) => client.delete(`/api/finance/accounts/${id}`),

  // Bank Accounts
  listBankAccounts: () => client.get('/api/finance/bank-accounts'),
  createBankAccount: (payload) => client.post('/api/finance/bank-accounts', payload),
  updateBankAccount: (id, payload) => client.put(`/api/finance/bank-accounts/${id}`, payload),

  // Journal Entries
  listJournalEntries: (params = {}) => client.get('/api/finance/journal-entries', { params }),
  getJournalEntry: (id) => client.get(`/api/finance/journal-entries/${id}`),
  createJournalEntry: (payload) => client.post('/api/finance/journal-entries', payload),
  postJournalEntry: (id) => client.put(`/api/finance/journal-entries/${id}/post`),
  removeJournalEntry: (id) => client.delete(`/api/finance/journal-entries/${id}`),

  // Expenses
  listExpenses: (params = {}) => client.get('/api/finance/expenses', { params }),
  expenseStats: () => client.get('/api/finance/expenses/stats'),
  createExpense: (payload) => client.post('/api/finance/expenses', payload),
  updateExpense: (id, payload) => client.put(`/api/finance/expenses/${id}`, payload),
  markExpensePaid: (id) => client.put(`/api/finance/expenses/${id}/mark-paid`),
  removeExpense: (id) => client.delete(`/api/finance/expenses/${id}`),

  // GST
  gstSummary: (month, year) => client.get('/api/finance/gst/summary', { params: { month, year } }),
  fileGstReturn: (payload) => client.post('/api/finance/gst/file', payload),
  listGstFilings: () => client.get('/api/finance/gst/filings'),

  // Reports
  profitAndLoss: (month, year) => client.get('/api/finance/reports/profit-loss', { params: { month, year } }),
}

// ============================================================
// SERVICE DESK
// ============================================================
export const serviceDeskApi = {
  overview: () => client.get('/api/service-desk/overview'),

  listCategories: () => client.get('/api/service-desk/categories'),
  createCategory: (payload) => client.post('/api/service-desk/categories', payload),

  listSlaPolicies: () => client.get('/api/service-desk/sla-policies'),
  upsertSlaPolicy: (payload) => client.post('/api/service-desk/sla-policies', payload),

  listTickets: (params = {}) => client.get('/api/service-desk/tickets', { params }),
  ticketStats: () => client.get('/api/service-desk/tickets/stats'),
  createTicket: (payload) => client.post('/api/service-desk/tickets', payload),
  getTicket: (id) => client.get(`/api/service-desk/tickets/${id}`),
  updateTicket: (id, payload) => client.put(`/api/service-desk/tickets/${id}`, payload),
  updateTicketStatus: (id, payload) => client.put(`/api/service-desk/tickets/${id}/status`, payload),
  removeTicket: (id) => client.delete(`/api/service-desk/tickets/${id}`),

  addComment: (id, payload) => client.post(`/api/service-desk/tickets/${id}/comments`, payload),
}
