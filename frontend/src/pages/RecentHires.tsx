import { UserSearch, ExternalLink } from 'lucide-react'
import { useRecentHires } from '@/hooks/useRecentHires'

export default function RecentHires() {
  const { data, isLoading } = useRecentHires({ page: 1 })
  const hires = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className="p-8 space-y-6">
      <div className="border-b border-hairline pb-5">
        <p className="label-m mb-1 flex items-center gap-2"><UserSearch size={11} /> Intelligence</p>
        <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">
          Recent Hires
          {pagination && <span className="text-muted text-base font-normal ml-2">({pagination.total})</span>}
        </h1>
      </div>

      <div className="card-m p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse" />)}
          </div>
        ) : hires.length === 0 ? (
          <div className="p-12 text-center">
            <UserSearch size={32} className="mx-auto mb-3 text-muted opacity-30" />
            <p className="label-m">No recent hires collected yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-elevated">
                <th className="text-left py-3 px-4 label-m">Name</th>
                <th className="text-left py-3 px-4 label-m">Designation</th>
                <th className="text-left py-3 px-4 label-m">Company</th>
                <th className="text-left py-3 px-4 label-m">Joined</th>
                <th className="text-left py-3 px-4 label-m">Profile</th>
              </tr>
            </thead>
            <tbody>
              {hires.map(h => (
                <tr key={h.id} className="border-b border-hairline hover:bg-surface-card transition-colors">
                  <td className="py-3 px-4 font-medium text-on-dark">{h.name}</td>
                  <td className="py-3 px-4 text-body">{h.designation ?? '—'}</td>
                  <td className="py-3 px-4 text-body">{h.companyName}</td>
                  <td className="py-3 px-4 text-muted">{h.joinedAt ?? '—'}</td>
                  <td className="py-3 px-4">
                    {h.profileUrl ? (
                      <a href={h.profileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
                        <ExternalLink size={11} /> LinkedIn
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
