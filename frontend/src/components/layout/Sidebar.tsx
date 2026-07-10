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
    <aside className="w-60 min-h-screen bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <span className="text-white font-bold text-base leading-tight">
          Job Search<br />
          <span className="text-blue-400 font-normal text-sm">Workspace</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
