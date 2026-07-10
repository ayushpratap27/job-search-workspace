import { useNavigate } from 'react-router-dom'
import { Users, ExternalLink } from 'lucide-react'
import { useNetworking, useUpdateNetworkingStatus } from '@/hooks/useNetworking'
import { NetworkingStatusBadge, PriorityBadge } from '@/components/applications/StatusBadges'
import type { NetworkingStatus, Application } from '@/types'

const NET_OPTIONS: { value: NetworkingStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'replied', label: 'Replied' },
  { value: 'referral_received', label: 'Referral Received' },
  { value: 'resume_received', label: 'Resume Received' },
  { value: 'ignored', label: 'Ignored' },
]

function NetworkingCard({ app }: { app: Application }) {
  const navigate = useNavigate()
  const mutation = useUpdateNetworkingStatus(app.id)

  return (
    <div className="card-m space-y-4">
      <div className="flex items-start justify-between">
        <div className="cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
          <p className="text-sm font-bold uppercase tracking-wide text-on-dark hover:text-m-blue-dark transition-colors">
            {app.company.name}
          </p>
          <p className="text-xs text-body font-light mt-0.5">{app.role}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{app.location}</p>
        </div>
        <PriorityBadge priority={app.priority} />
      </div>

      <div className="flex items-center gap-3">
        <NetworkingStatusBadge status={app.networkingStatus as NetworkingStatus} />
        {app.appliedAt && (
          <span className="text-[10px] text-muted uppercase tracking-wider">
            {new Date(app.appliedAt).toLocaleDateString('en-IN')}
          </span>
        )}
      </div>

      <select
        defaultValue={app.networkingStatus}
        onChange={(e) => mutation.mutate(e.target.value as NetworkingStatus)}
        className="select-m w-full text-[11px]"
      >
        {NET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {(app.company.linkedinUrl || app.company.careerPageUrl) && (
        <div className="flex gap-4 border-t border-hairline pt-3">
          {app.company.linkedinUrl && (
            <a href={app.company.linkedinUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
              <ExternalLink size={10} /> LinkedIn
            </a>
          )}
          {app.company.careerPageUrl && (
            <a href={app.company.careerPageUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
              <ExternalLink size={10} /> Careers
            </a>
          )}
        </div>
      )}

      {app.recentHiresCount > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#a855f7] border border-[#a855f7]/30 px-2 py-1 w-fit">
          <Users size={10} />
          {app.recentHiresCount} recent hire{app.recentHiresCount > 1 ? 's' : ''}
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
    <div className="p-8 space-y-6">
      <div className="border-b border-hairline pb-5">
        <p className="label-m mb-1 flex items-center gap-2"><Users size={11} /> Outreach</p>
        <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">
          Networking
          {pagination && <span className="text-muted text-base font-normal ml-2">({pagination.total} pending)</span>}
        </h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-surface-card animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <div className="card-m p-12 text-center">
          <Users size={32} className="mx-auto mb-3 text-muted opacity-30" />
          <p className="label-m">No companies pending networking</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map(app => <NetworkingCard key={app.id} app={app} />)}
        </div>
      )}
    </div>
  )
}
