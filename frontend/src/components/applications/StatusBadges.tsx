import type { ApplicationStatus, NetworkingStatus } from '@/types'

const APP_STATUS: Record<ApplicationStatus, { bg: string; text: string; label: string }> = {
  completed:       { bg: 'bg-[#0fa336]/15', text: 'text-[#0fa336]', label: 'Applied' },
  needs_attention: { bg: 'bg-[#f4b400]/15', text: 'text-[#f4b400]', label: 'Needs Attention' },
  skipped:         { bg: 'bg-[#262626]',    text: 'text-[#7e7e7e]', label: 'Skipped' },
}

const NET_STATUS: Record<NetworkingStatus, { bg: string; text: string; label: string }> = {
  pending:           { bg: 'bg-[#1c69d4]/15', text: 'text-[#1c69d4]', label: 'Pending' },
  completed:         { bg: 'bg-[#0fa336]/15', text: 'text-[#0fa336]', label: 'Completed' },
  replied:           { bg: 'bg-[#9333ea]/15', text: 'text-[#a855f7]', label: 'Replied' },
  referral_received: { bg: 'bg-[#0066b1]/15', text: 'text-[#0066b1]', label: 'Referral' },
  resume_received:   { bg: 'bg-[#0891b2]/15', text: 'text-[#22d3ee]', label: 'Resume' },
  ignored:           { bg: 'bg-[#262626]',    text: 'text-[#7e7e7e]', label: 'Ignored' },
}

const PRIORITY_STYLES: Record<number, string> = {
  1: 'bg-[#1c69d4] text-white',
  2: 'bg-[#0fa336] text-white',
  3: 'bg-[#f4b400] text-black',
  4: 'bg-[#262626] text-[#7e7e7e]',
}

function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[1px] ${bg} ${text}`}>
      {label}
    </span>
  )
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const s = APP_STATUS[status] ?? APP_STATUS.skipped
  return <Badge {...s} />
}

export function NetworkingStatusBadge({ status }: { status: NetworkingStatus }) {
  const s = NET_STATUS[status] ?? NET_STATUS.ignored
  return <Badge {...s} />
}

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES[4]}`}>
      {priority}
    </span>
  )
}
