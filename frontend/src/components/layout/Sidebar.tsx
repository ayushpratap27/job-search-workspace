import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  UserSearch,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const NAV = [
  { to: '/',              icon: LayoutDashboard,  label: 'Dashboard' },
  { to: '/applications',  icon: BriefcaseBusiness, label: 'Applications' },
  { to: '/networking',    icon: Users,             label: 'Networking' },
  { to: '/recent-hires',  icon: UserSearch,        label: 'Recent Hires' },
  { to: '/notifications', icon: Bell,              label: 'Notifications' },
  { to: '/settings',      icon: Settings,          label: 'Settings' },
]

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside className="w-56 min-h-screen bg-canvas flex flex-col border-r border-hairline flex-shrink-0">
      {/* M Tricolor stripe */}
      <div className="m-stripe" />

      {/* Wordmark */}
      <div className="px-5 pt-5 pb-4 border-b border-hairline">
        <p className="text-xs font-bold uppercase tracking-[2px] text-on-dark leading-tight">
          Job Search
        </p>
        <p className="text-[10px] font-normal uppercase tracking-[2px] text-muted mt-0.5">
          Workspace
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-[12px] font-medium uppercase tracking-[1px] transition-colors border-l-2 ${
                isActive
                  ? 'border-m-blue-dark text-on-dark bg-surface-card'
                  : 'border-transparent text-muted hover:text-on-dark hover:bg-surface-card'
              }`
            }
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 border-t border-hairline pt-3">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-2 py-2.5 text-[12px] uppercase tracking-[1px] text-muted hover:text-on-dark transition-colors"
        >
          <LogOut size={14} strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
