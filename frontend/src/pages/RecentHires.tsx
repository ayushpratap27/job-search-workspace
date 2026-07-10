import { UserSearch, ExternalLink } from 'lucide-react'
import { useRecentHires } from '@/hooks/useRecentHires'

export default function RecentHires() {
  const { data, isLoading } = useRecentHires({ page: 1 })
  const hires = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="p-8 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <UserSearch size={24} className="text-blue-600" />
        Recent Hires
        {pagination && (
          <span className="text-sm font-normal text-gray-400 ml-1">({pagination.total})</span>
        )}
      </h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : hires.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <UserSearch size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No recent hires collected yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Designation</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Company</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hires.map(h => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">{h.name}</td>
                  <td className="py-3 px-4 text-gray-600">{h.designation ?? '—'}</td>
                  <td className="py-3 px-4 text-gray-600">{h.companyName}</td>
                  <td className="py-3 px-4 text-gray-400">{h.joinedAt ?? '—'}</td>
                  <td className="py-3 px-4">
                    {h.profileUrl ? (
                      <a href={h.profileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline text-xs">
                        <ExternalLink size={12} /> LinkedIn
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
