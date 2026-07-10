import { formatDistanceToNow } from 'date-fns'
import type { TimelineEvent } from '@/types'

const EVENT_LABELS: Record<string, string> = {
  applied: 'Applied',
  recent_hires_collected: 'Recent Hires Collected',
  networking_pending: 'Networking Pending',
  networking_updated: 'Networking Updated',
  interview_scheduled: 'Interview Scheduled',
  offer: 'Offer Received',
  rejected: 'Rejected',
  needs_attention: 'Needs Attention',
  resumed: 'Resumed',
  note_added: 'Note Added',
}

const EVENT_COLOR: Record<string, string> = {
  applied: '#1c69d4',
  recent_hires_collected: '#a855f7',
  networking_updated: '#0066b1',
  interview_scheduled: '#0891b2',
  offer: '#0fa336',
  rejected: '#e22718',
  needs_attention: '#f4b400',
}

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[10px] text-muted uppercase tracking-wider py-4">No timeline events yet.</p>
  }

  return (
    <div className="relative">
      <div className="absolute left-[5px] top-0 bottom-0 w-px bg-hairline" />
      <div className="space-y-5 ml-6">
        {events.map((e) => {
          const color = EVENT_COLOR[e.eventType] ?? '#3c3c3c'
          return (
            <div key={e.id} className="relative">
              <div
                className="absolute -left-[22px] top-1 w-2.5 h-2.5 border"
                style={{ borderColor: color, backgroundColor: '#000' }}
              />
              <p className="text-xs font-bold uppercase tracking-wider text-body-strong">
                {EVENT_LABELS[e.eventType] ?? e.eventType}
              </p>
              <p className="text-[10px] text-muted font-light mt-0.5 uppercase tracking-wider">
                {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
