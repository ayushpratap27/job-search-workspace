import { useDashboard } from '@/hooks/useDashboard'
import { LayoutDashboard, BriefcaseBusiness, AlertCircle, Users, MapPin, Calendar } from 'lucide-react'

function StatCard({ label, value, icon: Icon, accent = '#1c69d4' }: {
  label: string; value: number | string; icon: React.ElementType; accent?: string
}) {
  return (
    <div className="card-m flex items-center gap-4">
      <div className="p-2.5 border flex-shrink-0" style={{ borderColor: accent }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-on-dark">{value}</p>
        <p className="label-m mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function CityBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] uppercase tracking-wider text-muted w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-surface-elevated h-px relative">
        <div className="absolute top-0 left-0 h-full bg-m-blue-dark transition-all" style={{ width: `${pct}%`, height: '2px', marginTop: '-0.5px' }} />
      </div>
      <span className="text-xs font-bold text-body-strong w-5 text-right">{value}</span>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboard()

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-surface-card w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-surface-card animate-pulse" />)}
        </div>
      </div>
    )
  }

  const today = stats?.today
  const city = stats?.cityBreakdown
  const cityMax = city ? Math.max(...Object.values(city)) : 0

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-hairline pb-5">
        <p className="label-m mb-1 flex items-center gap-2"><LayoutDashboard size={11} /> Overview</p>
        <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">Dashboard</h1>
        <p className="text-muted text-sm mt-1 font-light">
          {today?.date ? new Date(today.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
        </p>
      </div>

      {/* Today */}
      <div>
        <p className="label-m mb-3">Today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Jobs Found"        value={today?.jobsFound ?? 0}       icon={BriefcaseBusiness} accent="#1c69d4" />
          <StatCard label="Applied"           value={today?.applied ?? 0}          icon={BriefcaseBusiness} accent="#0fa336" />
          <StatCard label="Needs Attention"   value={today?.needsAttention ?? 0}   icon={AlertCircle}       accent="#f4b400" />
          <StatCard label="Recent Hires Found" value={today?.recentHiresFound ?? 0} icon={Users}            accent="#a855f7" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* City breakdown */}
        <div className="lg:col-span-2 card-m">
          <p className="label-m mb-5 flex items-center gap-2"><MapPin size={10} /> City Breakdown (Today)</p>
          <div className="space-y-4">
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

        {/* Right column */}
        <div className="space-y-4">
          {/* Networking */}
          <div className="card-m">
            <p className="label-m mb-4 flex items-center gap-2"><Users size={10} /> Networking</p>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-[#f4b400]">{stats?.networking.pending ?? 0}</p>
                <p className="label-m mt-0.5">Pending</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#0fa336]">{stats?.networking.completed ?? 0}</p>
                <p className="label-m mt-0.5">Completed</p>
              </div>
            </div>
          </div>

          {/* Periods */}
          <div className="card-m">
            <p className="label-m mb-4 flex items-center gap-2"><Calendar size={10} /> Applications</p>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-on-dark">{stats?.thisWeek.applied ?? 0}</p>
                <p className="label-m mt-0.5">This Week</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-on-dark">{stats?.thisMonth.applied ?? 0}</p>
                <p className="label-m mt-0.5">This Month</p>
              </div>
            </div>
          </div>

          {/* Active session */}
          {stats?.activeSession && (
            <div className="bg-surface-card border border-m-blue-dark p-4">
              <div className="m-stripe -mx-4 -mt-4 mb-3" />
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 bg-[#0fa336] animate-pulse" />
                <span className="label-m text-[#0fa336]">{stats.activeSession.status}</span>
              </div>
              <p className="text-sm text-body-strong font-light">{stats.activeSession.jobsApplied} jobs applied this session</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
