import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BriefcaseBusiness } from 'lucide-react'
import { useApplications } from '@/hooks/useApplications'
import { ApplicationStatusBadge, NetworkingStatusBadge, PriorityBadge } from '@/components/applications/StatusBadges'
import type { ApplicationStatus, NetworkingStatus } from '@/types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Applied' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'skipped', label: 'Skipped' },
]

const NETWORKING_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Networking' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'replied', label: 'Replied' },
  { value: 'referral_received', label: 'Referral Received' },
  { value: 'resume_received', label: 'Resume Received' },
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
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BriefcaseBusiness size={24} className="text-blue-600" />
          Applications
          {pagination && (
            <span className="text-sm font-normal text-gray-400 ml-1">({pagination.total})</span>
          )}
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search company or role…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={networkingStatus}
          onChange={(e) => { setNetworkingStatus(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {NETWORKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <BriefcaseBusiness size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No applications found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">#</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Company</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Networking</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {apps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <PriorityBadge priority={app.priority} />
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{app.company.name}</td>
                  <td className="py-3 px-4 text-gray-700">{app.role}</td>
                  <td className="py-3 px-4 text-gray-500">{app.location ?? '—'}</td>
                  <td className="py-3 px-4">
                    <ApplicationStatusBadge status={app.applicationStatus as ApplicationStatus} />
                  </td>
                  <td className="py-3 px-4">
                    <NetworkingStatusBadge status={app.networkingStatus as NetworkingStatus} />
                  </td>
                  <td className="py-3 px-4 text-gray-400">
                    {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
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
  useState(() => {
    const t = setTimeout(cb, delay)
    return () => clearTimeout(t)
  })
  return debounced
}
