import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'

import LoginPage from './pages/LoginPage'
import RegisterCompanyPage from './pages/RegisterCompanyPage'
import DashboardPage from './pages/DashboardPage'
import CompanyListPage from './pages/CompanyListPage'
import CompanyPage from './pages/CompanyPage'
import CompanyProfilePage from './pages/CompanyProfilePage'
import CompanyProfileEditPage from './pages/CompanyProfileEditPage'
import BranchesPage from './pages/BranchesPage'
import UsersPage from './pages/UsersPage'
import RolesPage from './pages/RolesPage'
import RoleEditPage from './pages/RoleEditPage'
import AiAssistantPage from './pages/AiAssistantPage'
import SalesCrmLayout from './layouts/SalesCrmLayout'
import SalesOverviewPage from './pages/sales/SalesOverviewPage'
import LeadsPage from './pages/sales/LeadsPage'
import CustomersPage from './pages/sales/CustomersPage'
import QuotationsPage from './pages/sales/QuotationsPage'
import SalesOrdersPage from './pages/sales/SalesOrdersPage'
import InvoicesPage from './pages/sales/InvoicesPage'
import InvoiceViewPage from './pages/sales/InvoiceViewPage'
import InventoryLayout from './layouts/InventoryLayout'
import InventoryOverviewPage from './pages/inventory/InventoryOverviewPage'
import ProductsPage from './pages/inventory/ProductsPage'
import StockLevelsPage from './pages/inventory/StockLevelsPage'
import TransfersPage from './pages/inventory/TransfersPage'
import AdjustmentsPage from './pages/inventory/AdjustmentsPage'
import PurchaseLayout from './layouts/PurchaseLayout'
import PurchaseOverviewPage from './pages/purchase/PurchaseOverviewPage'
import SuppliersPage from './pages/purchase/SuppliersPage'
import PurchaseOrdersPage from './pages/purchase/PurchaseOrdersPage'
import ReceiptsPage from './pages/purchase/ReceiptsPage'
import BillsPage from './pages/purchase/BillsPage'
import ManufacturingLayout from './layouts/ManufacturingLayout'
import ManufacturingOverviewPage from './pages/manufacturing/ManufacturingOverviewPage'
import WorkOrdersPage from './pages/manufacturing/WorkOrdersPage'
import BomsPage from './pages/manufacturing/BomsPage'
import WorkCentersPage from './pages/manufacturing/WorkCentersPage'
import HrLayout from './layouts/HrLayout'
import HrOverviewPage from './pages/hr/HrOverviewPage'
import EmployeesPage from './pages/hr/EmployeesPage'
import DepartmentsPage from './pages/hr/DepartmentsPage'
import LeavePage from './pages/hr/LeavePage'
import AttendancePage from './pages/hr/AttendancePage'
import PayslipsPage from './pages/hr/PayslipsPage'
import FinanceLayout from './layouts/FinanceLayout'
import FinanceOverviewPage from './pages/finance/FinanceOverviewPage'
import ChartOfAccountsPage from './pages/finance/ChartOfAccountsPage'
import BankAccountsPage from './pages/finance/BankAccountsPage'
import JournalEntriesPage from './pages/finance/JournalEntriesPage'
import ExpensesPage from './pages/finance/ExpensesPage'
import GstPage from './pages/finance/GstPage'
import ServiceDeskLayout from './layouts/ServiceDeskLayout'
import ServiceDeskOverviewPage from './pages/service-desk/ServiceDeskOverviewPage'
import TicketsPage from './pages/service-desk/TicketsPage'
import CategoriesPage from './pages/service-desk/CategoriesPage'
import SlaPoliciesPage from './pages/service-desk/SlaPoliciesPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 rounded-full border-2 border-navy-600 border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Landing order used when a user has no access to the dashboard
const MODULE_HOME = [
  ['dashboard', '/dashboard'], ['sales_crm', '/sales'], ['inventory', '/inventory'],
  ['purchase', '/purchase'], ['manufacturing', '/manufacturing'], ['hr_employee', '/hr'],
  ['finance_gst', '/finance'], ['service_desk', '/service-desk'], ['company_profile', '/company-profile'],
  ['branches', '/branches'], ['users', '/users'], ['roles_permissions', '/roles'],
]

const canAccess = (user, module) =>
  !module || user?.is_owner || (user?.allowed_modules || []).includes(module)

function HomeRedirect() {
  const { user } = useAuth()
  const home = MODULE_HOME.find(([m]) => canAccess(user, m))
  return <Navigate to={home ? home[1] : '/ai-assistant'} replace />
}

function ModuleRoute({ module, ownerOnly, children }) {
  const { user } = useAuth()
  if (ownerOnly ? !user?.is_owner : !canAccess(user, module)) return <HomeRedirect />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterCompanyPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<ModuleRoute module="dashboard"><DashboardPage /></ModuleRoute>} />
        <Route path="ai-assistant" element={<AiAssistantPage />} />
        <Route path="company-list" element={<ModuleRoute ownerOnly><CompanyListPage /></ModuleRoute>} />
        <Route path="company" element={<ModuleRoute ownerOnly><CompanyPage /></ModuleRoute>} />
        <Route path="company-profile" element={<ModuleRoute module="company_profile"><CompanyProfilePage /></ModuleRoute>} />
        <Route path="company-profile/edit" element={<ModuleRoute module="company_profile"><CompanyProfileEditPage /></ModuleRoute>} />
        <Route path="branches" element={<ModuleRoute module="branches"><BranchesPage /></ModuleRoute>} />
        <Route path="users" element={<ModuleRoute module="users"><UsersPage /></ModuleRoute>} />
        <Route path="roles" element={<ModuleRoute module="roles_permissions"><RolesPage /></ModuleRoute>} />
        <Route path="roles/:roleId" element={<ModuleRoute module="roles_permissions"><RoleEditPage /></ModuleRoute>} />

        <Route path="sales" element={<ModuleRoute module="sales_crm"><SalesCrmLayout /></ModuleRoute>}>
          <Route index element={<SalesOverviewPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="orders" element={<SalesOrdersPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/:invoiceId" element={<InvoiceViewPage />} />
        </Route>

        <Route path="inventory" element={<ModuleRoute module="inventory"><InventoryLayout /></ModuleRoute>}>
          <Route index element={<InventoryOverviewPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="stock-levels" element={<StockLevelsPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="adjustments" element={<AdjustmentsPage />} />
        </Route>

        <Route path="purchase" element={<ModuleRoute module="purchase"><PurchaseLayout /></ModuleRoute>}>
          <Route index element={<PurchaseOverviewPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="orders" element={<PurchaseOrdersPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="bills" element={<BillsPage />} />
        </Route>

        <Route path="manufacturing" element={<ModuleRoute module="manufacturing"><ManufacturingLayout /></ModuleRoute>}>
          <Route index element={<ManufacturingOverviewPage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="boms" element={<BomsPage />} />
          <Route path="work-centers" element={<WorkCentersPage />} />
        </Route>

        <Route path="hr" element={<ModuleRoute module="hr_employee"><HrLayout /></ModuleRoute>}>
          <Route index element={<HrOverviewPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="payslips" element={<PayslipsPage />} />
        </Route>

        <Route path="finance" element={<ModuleRoute module="finance_gst"><FinanceLayout /></ModuleRoute>}>
          <Route index element={<FinanceOverviewPage />} />
          <Route path="accounts" element={<ChartOfAccountsPage />} />
          <Route path="bank-accounts" element={<BankAccountsPage />} />
          <Route path="journal-entries" element={<JournalEntriesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="gst" element={<GstPage />} />
        </Route>

        <Route path="service-desk" element={<ModuleRoute module="service_desk"><ServiceDeskLayout /></ModuleRoute>}>
          <Route index element={<ServiceDeskOverviewPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="sla-policies" element={<SlaPoliciesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
