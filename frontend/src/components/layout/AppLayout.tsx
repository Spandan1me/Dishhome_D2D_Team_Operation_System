import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Upload,
  UserCheck,
  Users,
  ClipboardList,
  CalendarClock,
  BarChart3,
  UserCog,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import dishhomeLogo from '../../assets/dishhome-logo.png';

export const AppLayout: React.FC = () => {
  const { user, logout, isSupervisor, isAdmin, isAgent } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      label: user?.role === 'ADMIN' ? 'Supervisor Operations' : 'Dashboard',
      path: user?.role === 'AGENT' ? '/agent/dashboard' : '/supervisor/dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'SUPERVISOR', 'AGENT']
    },
    ...(user?.role === 'ADMIN' ? [
      {
        label: 'Field Agent View',
        path: '/agent/dashboard',
        icon: LayoutDashboard,
        roles: ['ADMIN']
      }
    ] : []),
    {
      label: 'Customer Uploads',
      path: '/supervisor/uploads',
      icon: Upload,
      roles: ['ADMIN', 'SUPERVISOR']
    },
    {
      label: 'Customer Allocation',
      path: '/supervisor/allocation',
      icon: UserCheck,
      roles: ['ADMIN', 'SUPERVISOR']
    },
    {
      label: 'Customers',
      path: '/customers',
      icon: Users,
      roles: ['ADMIN', 'SUPERVISOR', 'AGENT']
    },
    {
      label: 'Visit Logs',
      path: '/visits',
      icon: ClipboardList,
      roles: ['ADMIN', 'SUPERVISOR', 'AGENT']
    },
    {
      label: 'Follow-ups',
      path: '/followups',
      icon: CalendarClock,
      roles: ['ADMIN', 'SUPERVISOR', 'AGENT']
    },
    {
      label: 'Reports',
      path: '/supervisor/reports',
      icon: BarChart3,
      roles: ['ADMIN', 'SUPERVISOR']
    },
    {
      label: 'Team Management',
      path: '/supervisor/team',
      icon: UserCog,
      roles: ['ADMIN', 'SUPERVISOR']
    },
    {
      label: 'Audit Logs',
      path: '/supervisor/audit',
      icon: ShieldAlert,
      roles: ['ADMIN', 'SUPERVISOR']
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      roles: ['ADMIN', 'SUPERVISOR', 'AGENT']
    },
  ];

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  const getPageTitle = () => {
    const current = filteredNav.find(item => location.pathname.startsWith(item.path));
    if (current) return current.label;
    if (location.pathname.includes('/customers/new')) return 'Add Customer';
    if (location.pathname.includes('/customers/')) return 'Customer Details';
    if (location.pathname.includes('/visits/new')) return 'Record Visit Findings';
    return 'Operation Support System';
  };

  return (
    <div className="min-h-screen bg-app-bg flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-border shrink-0 z-20 h-screen sticky top-0 shadow-sm">
        {/* Logo Header */}
        <div className="p-4 border-b border-border flex items-center justify-center bg-white">
          <img src={dishhomeLogo} alt="DishHome Internet" className="h-10 object-contain" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: matchActive }) => `
                  flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors relative
                  ${matchActive || isActive
                    ? 'bg-brand-red-light text-brand-red-dark font-semibold'
                    : 'text-text-secondary hover:bg-brand-red-light/50 hover:text-text-primary'
                  }
                `}
              >
                {({ isActive: matchActive }) => (
                  <>
                    {(matchActive || isActive) && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-brand-red rounded-r-md" />
                    )}
                    <Icon className={`w-5 h-5 ${(matchActive || isActive) ? 'text-brand-red' : 'text-text-secondary'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-border bg-gray-50/50">
          <div className="flex items-center justify-between p-2 rounded-lg">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-brand-red-light text-brand-red flex items-center justify-center font-bold text-xs shrink-0">
                {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-text-primary truncate">{user?.full_name || user?.username}</p>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  user?.role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-red-100 text-brand-red-dark'
                }`}>
                  {user?.role === 'ADMIN' ? 'Super Admin' : user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-text-secondary hover:text-danger hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-surface border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <img src={dishhomeLogo} alt="DishHome" className="h-7 object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
            user?.role === 'ADMIN'
              ? 'bg-purple-100 text-purple-700 border border-purple-200'
              : 'text-brand-red-dark bg-brand-red-light'
          }`}>
            {user?.role === 'ADMIN' ? 'Super Admin' : user?.role}
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-text-primary hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[53px] bg-black/40 z-40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-surface w-4/5 max-w-xs h-full p-4 flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-brand-red-light rounded-xl mb-4">
              <p className="text-xs text-text-secondary">Logged in as:</p>
              <p className="font-bold text-sm text-text-primary">{user?.full_name || user?.username}</p>
              <p className="text-[11px] text-brand-red-dark font-medium">{user?.phone_number || user?.email}</p>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-brand-red-light text-brand-red-dark font-semibold' : 'text-text-secondary'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-brand-red" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <button
              onClick={handleLogout}
              className="mt-auto flex items-center justify-center gap-2 w-full py-3 bg-red-50 text-danger rounded-xl font-medium text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <header className="hidden md:flex bg-surface border-b border-border h-16 items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAgent && (
              <NavLink
                to="/customers/new"
                className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-red text-white text-xs font-medium uppercase rounded-md shadow hover:bg-brand-red-dark transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Customer</span>
              </NavLink>
            )}
            {isSupervisor && (
              <NavLink
                to="/supervisor/uploads"
                className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-red text-white text-xs font-medium uppercase rounded-md shadow hover:bg-brand-red-dark transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Excel</span>
              </NavLink>
            )}
            <div className="h-6 w-px bg-border mx-1" />
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="text-xs font-bold text-text-primary">{user?.full_name || user?.username}</p>
                <p className="text-[11px] text-text-secondary font-medium capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation for Agents */}
      {isAgent && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex items-center justify-around py-2 px-2 z-30 shadow-lg">
          <NavLink
            to="/agent/dashboard"
            className={({ isActive }) => `flex flex-col items-center py-1 px-3 text-[11px] font-medium ${
              isActive ? 'text-brand-red font-bold' : 'text-text-secondary'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </NavLink>
          <NavLink
            to="/customers"
            className={({ isActive }) => `flex flex-col items-center py-1 px-3 text-[11px] font-medium ${
              isActive ? 'text-brand-red font-bold' : 'text-text-secondary'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>Customers</span>
          </NavLink>
          <NavLink
            to="/customers/new"
            className="flex flex-col items-center -top-3 relative"
          >
            <div className="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center shadow-md">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] text-text-primary font-medium mt-0.5">Add</span>
          </NavLink>
          <NavLink
            to="/followups"
            className={({ isActive }) => `flex flex-col items-center py-1 px-3 text-[11px] font-medium ${
              isActive ? 'text-brand-red font-bold' : 'text-text-secondary'
            }`}
          >
            <CalendarClock className="w-5 h-5 mb-0.5" />
            <span>Follow-ups</span>
          </NavLink>
          <NavLink
            to="/visits"
            className={({ isActive }) => `flex flex-col items-center py-1 px-3 text-[11px] font-medium ${
              isActive ? 'text-brand-red font-bold' : 'text-text-secondary'
            }`}
          >
            <ClipboardList className="w-5 h-5 mb-0.5" />
            <span>Visits</span>
          </NavLink>
        </div>
      )}
    </div>
  );
};
