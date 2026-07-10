import { useDashboard } from '@/hooks/useDashboard'
import { LayoutDashboard, BriefcaseBusiness, AlertCircle, Users, MapPin, Calendar } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function CityBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-700 w-6 text-right">{value}</span>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboard()

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  const today = stats?.today
  const city = stats?.cityBreakdown
  const cityMax = city ? Math.max(...Object.values(city)) : 0

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutDashboard size={24} className="text-blue-600" />
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {today?.date ? new Date(today.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
        </p>
      </div>

      {/* Today's stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Today</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Jobs Found"         value={today?.jobsFound ?? 0}        icon={BriefcaseBusiness} color="bg-blue-500" />
          <StatCard label="Applied"            value={today?.applied ?? 0}           icon={BriefcaseBusiness} color="bg-green-500" />
          <StatCard label="Needs Attention"    value={today?.needsAttention ?? 0}    icon={AlertCircle}       color="bg-orange-500" />
          <StatCard label="Recent Hires Found" value={today?.recentHiresFound ?? 0}  icon={Users}             color="bg-purple-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* City breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <MapPin size={14} />
            City Breakdown (Today)
          </h2>
          <div className="space-y-3">
            <CityBar label="Bengaluru"  value={city?.bangalore ?? 0}  max={cityMax} />
            <CityBar label="Remote"     value={city?.remote ?? 0}     max={cityMax} />
            <CityBar label="Hyderabad"  value={city?.hyderabad ?? 0}  max={cityMax} />
            <CityBar label="Pune"       value={city?.pune ?? 0}       max={cityMax} />
            <CityBar label="Noida"      value={city?.noida ?? 0}      max={cityMax} />
            <CityBar label="Gurugram"   value={city?.gurugram ?? 0}   max={cityMax} />
            <CityBar label="Chennai"    value={city?.chennai ?? 0}    max={cityMax} />
            <CityBar label="Other"      value={city?.other ?? 0}      max={cityMax} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="space-y-4">
          {/* Networking */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Users size={14} />
              Networking
            </h2>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-500">{stats?.networking.pending ?? 0}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{stats?.networking.completed ?? 0}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </div>

          {/* Periods */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Calendar size={14} />
              Applications
            </h2>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats?.thisWeek.applied ?? 0}</p>
                <p className="text-xs text-gray-500">This Week</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-800">{stats?.thisMonth.applied ?? 0}</p>
                <p className="text-xs text-gray-500">This Month</p>
              </div>
            </div>
          </div>

          {/* Active session */}
          {stats?.activeSession && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-blue-800 capitalize">{stats.activeSession.status}</span>
              </div>
              <p className="text-sm text-blue-700">{stats.activeSession.jobsApplied} jobs applied this session</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
