import { useNavigate } from 'react-router-dom'
import { Users, ExternalLink } from 'lucide-react'
import { useNetworking, useUpdateNetworkingStatus } from '@/hooks/useNetworking'
import { NetworkingStatusBadge, PriorityBadge } from '@/components/applications/StatusBadges'
import type { NetworkingStatus } from '@/types'

const NET_OPTIONS: { value: NetworkingStatus; label: string }[] = [
  { value: 'pending',           label: 'Pending' },
  { value: 'completed',         label: 'Completed' },
  { value: 'replied',           label: 'Replied' },
  { value: 'referral_received', label: 'Referral Received' },
  { value: 'resume_received',   label: 'Resume Received' },
  { value: 'ignored',           label: 'Ignored' },
]

function NetworkingCard({ app }: { app: import('@/types').Application }) {
  const navigate = useNavigate()
  const mutation = useUpdateNetworkingStatus(app.id)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
          <p className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">{app.company.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{app.role}</p>
          <p className="text-xs text-gray-400 mt-0.5">{app.location}</p>
        </div>
        <PriorityBadge priority={app.priority} />
      </div>

      <div className="flex items-center gap-2">
        <NetworkingStatusBadge status={app.networkingStatus as NetworkingStatus} />
        {app.appliedAt && (
          <span className="text-xs text-gray-400">
            Applied {new Date(app.appliedAt).toLocaleDateString('en-IN')}
          </span>
        )}
      </div>

      {/* Update status */}
      <select
        defaultValue={app.networkingStatus}
        onChange={(e) => mutation.mutate(e.target.value as NetworkingStatus)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {NET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Company links */}
      {(app.company.linkedinUrl || app.company.careerPageUrl) && (
        <div className="flex gap-3 pt-1">
          {app.company.linkedinUrl && (
            <a href={app.company.linkedinUrl} target="_blank" rel="noreferrer"
              className="text-xs text-blue-500 hover:underline flex items-center gap-1">
              <ExternalLink size={11} /> LinkedIn
            </a>
          )}
          {app.company.careerPageUrl && (
            <a href={app.company.careerPageUrl} target="_blank" rel="noreferrer"
              className="text-xs text-blue-500 hover:underline flex items-center gap-1">
              <ExternalLink size={11} /> Careers
            </a>
          )}
        </div>
      )}

      {/* Recent hires count */}
      {app.recentHiresCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1 w-fit">
          <Users size={11} />
          {app.recentHiresCount} recent hire{app.recentHiresCount > 1 ? 's' : ''} found
        </div>
      )}
    </div>
  )
}

export default function Networking() {
  const { data, isLoading } = useNetworking('pending')
  const apps = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="p-8 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Users size={24} className="text-blue-600" />
        Networking
        {pagination && (
          <span className="text-sm font-normal text-gray-400 ml-1">({pagination.total} pending)</span>
        )}
      </h1>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No companies pending networking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map(app => <NetworkingCard key={app.id} app={app} />)}
        </div>
      )}
    </div>
  )
}
