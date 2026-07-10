import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BriefcaseBusiness } from 'lucide-react'
import { useApplications } from '@/hooks/useApplications'
import { ApplicationStatusBadge, NetworkingStatusBadge, PriorityBadge } from '@/components/applications/StatusBadges'
import type { ApplicationStatus, NetworkingStatus } from '@/types'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Applied' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'skipped', label: 'Skipped' },
]

const NETWORKING_OPTIONS = [
  { value: '', label: 'All Networking' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'replied', label: 'Replied' },
  { value: 'referral_received', label: 'Referral' },
  { value: 'resume_received', label: 'Resume' },
  { value: 'ignored', label: 'Ignored' },
]

export default function Applications() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [networkingStatus, setNetworkingStatus] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 400)

  const { data, isLoading } = useApplications({
    company: debouncedSearch || undefined,
    status: status || undefined,
    networkingStatus: networkingStatus || undefined,
    page,
    pageSize: 20,
  })

  const apps = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="border-b border-hairline pb-5 flex items-end justify-between">
        <div>
          <p className="label-m mb-1 flex items-center gap-2"><BriefcaseBusiness size={11} /> Applications</p>
          <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">
            Applications
            {pagination && <span className="text-muted text-base font-normal ml-2">({pagination.total})</span>}
          </h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search company or role..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="input-m pl-9"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="select-m">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={networkingStatus} onChange={(e) => { setNetworkingStatus(e.target.value); setPage(1) }} className="select-m">
          {NETWORKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card-m p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse" />)}
          </div>
        ) : apps.length === 0 ? (
          <div className="p-12 text-center">
            <BriefcaseBusiness size={32} className="mx-auto mb-3 text-muted opacity-30" />
            <p className="label-m">No applications found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-elevated">
                <th className="text-left py-3 px-4 label-m">#</th>
                <th className="text-left py-3 px-4 label-m">Company</th>
                <th className="text-left py-3 px-4 label-m">Role</th>
                <th className="text-left py-3 px-4 label-m">Location</th>
                <th className="text-left py-3 px-4 label-m">Status</th>
                <th className="text-left py-3 px-4 label-m">Networking</th>
                <th className="text-left py-3 px-4 label-m">Applied</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="border-b border-hairline hover:bg-surface-card cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4"><PriorityBadge priority={app.priority} /></td>
                  <td className="py-3 px-4 font-medium text-on-dark">{app.company.name}</td>
                  <td className="py-3 px-4 text-body">{app.role}</td>
                  <td className="py-3 px-4 text-muted">{app.location ?? '—'}</td>
                  <td className="py-3 px-4"><ApplicationStatusBadge status={app.applicationStatus as ApplicationStatus} /></td>
                  <td className="py-3 px-4"><NetworkingStatusBadge status={app.networkingStatus as NetworkingStatus} /></td>
                  <td className="py-3 px-4 text-muted">
                    {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-hairline">
            <span className="label-m">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={pagination.page <= 1}
                className="btn-m btn-m-outline py-1 px-4 text-[11px] disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={pagination.page >= pagination.totalPages}
                className="btn-m btn-m-outline py-1 px-4 text-[11px] disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const cb = useCallback(() => setDebounced(value), [value])
  useState(() => { const t = setTimeout(cb, delay); return () => clearTimeout(t) })
  return debounced
}
