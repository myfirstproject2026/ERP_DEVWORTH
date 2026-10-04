import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Building2, List, GitBranch, Users, ShieldCheck,
  TrendingUp, Package, Truck, Factory, UserSquare2, Landmark,
  Headphones, PlusSquare, ChevronDown, Search, MessageCircle, Bell, Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { companyApi } from '../api/services'
import client from '../api/client'

const mainNav = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, module: 'dashboard' }]

const loginSetupNav = [
  { to: '/company-list', label: 'Company List', icon: List, ownerOnly: true },
  { to: '/company-profile', label: 'Company Profile', icon: Building2, module: 'company_profile' },
  { to: '/register', label: 'Company Registration', icon: PlusSquare, ownerOnly: true },
  { to: '/branches', label: 'Branches', icon: GitBranch, module: 'branches' },
  { to: '/users', label: 'Users', icon: Users, module: 'users' },
  { to: '/roles', label: 'Roles & Permissions', icon: ShieldCheck, module: 'roles_permissions' },
]

const activeWorkspaceNav = [
  { to: '/sales', label: 'Sales + CRM', icon: TrendingUp, module: 'sales_crm' },
  { to: '/inventory', label: 'Inventory', icon: Package, module: 'inventory' },
  { to: '/purchase', label: 'Purchase', icon: Truck, module: 'purchase' },
  { to: '/manufacturing', label: 'Manufacturing', icon: Factory, module: 'manufacturing' },
  { to: '/hr', label: 'HR & Employee', icon: UserSquare2, module: 'hr_employee' },
  { to: '/finance', label: 'Finance & GST', icon: Landmark, module: 'finance_gst' },
  { to: '/service-desk', label: 'Service Desk', icon: Headphones, module: 'service_desk' },
]

const comingSoonNav = []

function SidebarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      <Icon size={17} strokeWidth={2} />
      {label}
    </NavLink>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState(null)
  const location = useLocation()

  // Refetch on navigation so a newly uploaded logo appears without a reload
  useEffect(() => {
    if (!user) return
    companyApi.getProfile().then((res) => setLogoUrl(res.data.logo_url)).catch(() => {})
  }, [user, location.pathname])
  const logoSrc = logoUrl ? `${client.defaults.baseURL}${logoUrl}` : null
  const canSee = (item) => user?.is_owner || (!item.ownerOnly && (!item.module || (user?.allowed_modules || []).includes(item.module)))

  const initials = user?.company_name
    ? user.company_name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'NX'

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="h-8 w-8 rounded-lg bg-navy-700 text-white flex items-center justify-center font-bold text-sm overflow-hidden">
            {logoSrc ? <img src={logoSrc} alt="Company logo" className="h-full w-full object-contain bg-white" /> : 'DW'}
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-sm text-slate-900">Devworth ERP</p>
            <p className="text-[10px] tracking-wide text-slate-400 font-medium">MULTI-COMPANY SUITE</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 mb-1">MAIN</p>
            {mainNav.filter(canSee).map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 mb-1">
              LOGIN &amp; COMPANY SETUP
            </p>
            {loginSetupNav.filter(canSee).map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>

          <div className="space-y-1">
            <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 mb-1">
              WORKSPACE MODULES
            </p>
            {activeWorkspaceNav.filter(canSee).map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
            {comingSoonNav.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-300 cursor-not-allowed select-none"
              >
                <span className="flex items-center gap-3">
                  <item.icon size={17} strokeWidth={2} />
                  {item.label}
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </nav>

        <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400">
          <p>Signed in to <span className="font-semibold text-slate-600">{user?.company_name}</span></p>
          <p>v2.5.0 · Cloud sync on</p>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 gap-4">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-left min-w-[220px]">
            <div className="h-7 w-7 rounded bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold overflow-hidden">
              {logoSrc ? <img src={logoSrc} alt="Company logo" className="h-full w-full object-contain" /> : initials}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{user?.company_name || 'Company'}</p>
              <p className="text-[11px] text-slate-400">{user?.branch_name || '—'}</p>
            </div>
            <ChevronDown size={14} className="ml-auto text-slate-400" />
          </button>

          <div className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoices, customers, products..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 border border-transparent focus:bg-white focus:border-brand-300 focus:outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
              <MessageCircle size={16} />
            </button>
            <button className="h-9 w-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 relative">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-50"
              >
                <div className="h-8 w-8 rounded-full bg-navy-700 text-white flex items-center justify-center text-xs font-semibold">
                  {userInitials}
                </div>
                <div className="text-left leading-tight hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                  <p className="text-[11px] text-slate-400">{user?.role_name}</p>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating AI assistant launcher */}
      <NavLink
        to="/ai-assistant"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shadow-lg shadow-brand-600/30 z-30"
        title="Ask AI Assistant"
      >
        <Sparkles size={20} />
      </NavLink>
    </div>
  )
}
