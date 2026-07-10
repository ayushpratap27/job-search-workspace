import { formatDistanceToNow } from 'date-fns'
import type { TimelineEvent } from '@/types'

const EVENT_LABELS: Record<string, string> = {
  applied:                 'Applied',
  recent_hires_collected:  'Recent Hires Collected',
  networking_pending:      'Networking Pending',
  networking_updated:      'Networking Updated',
  interview_scheduled:     'Interview Scheduled',
  offer:                   'Offer Received',
  rejected:                'Rejected',
  needs_attention:         'Needs Attention',
  resumed:                 'Automation Resumed',
  note_added:              'Note Added',
}

const EVENT_COLORS: Record<string, string> = {
  applied:                 'bg-green-500',
  recent_hires_collected:  'bg-purple-500',
  networking_updated:      'bg-blue-500',
  interview_scheduled:     'bg-indigo-500',
  offer:                   'bg-emerald-500',
  rejected:                'bg-red-500',
  needs_attention:         'bg-orange-500',
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No timeline events yet.</p>
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-5 ml-8">
        {events.map((e) => (
          <div key={e.id} className="relative">
            <div className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${EVENT_COLORS[e.eventType] ?? 'bg-gray-400'}`} />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {EVENT_LABELS[e.eventType] ?? e.eventType}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
