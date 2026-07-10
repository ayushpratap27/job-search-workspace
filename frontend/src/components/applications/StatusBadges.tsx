import type { ApplicationStatus, NetworkingStatus } from '@/types'

const APP_STATUS: Record<ApplicationStatus, string> = {
  completed:       'bg-green-100 text-green-700',
  needs_attention: 'bg-orange-100 text-orange-700',
  skipped:         'bg-gray-100 text-gray-500',
}

const APP_STATUS_LABELS: Record<ApplicationStatus, string> = {
  completed:       'Applied',
  needs_attention: 'Needs Attention',
  skipped:         'Skipped',
}

const NET_STATUS: Record<NetworkingStatus, string> = {
  pending:           'bg-blue-100 text-blue-700',
  completed:         'bg-green-100 text-green-700',
  replied:           'bg-purple-100 text-purple-700',
  referral_received: 'bg-indigo-100 text-indigo-700',
  resume_received:   'bg-teal-100 text-teal-700',
  ignored:           'bg-gray-100 text-gray-400',
}

const NET_STATUS_LABELS: Record<NetworkingStatus, string> = {
  pending:           'Pending',
  completed:         'Completed',
  replied:           'Replied',
  referral_received: 'Referral',
  resume_received:   'Resume',
  ignored:           'Ignored',
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-blue-600 text-white',
  2: 'bg-green-600 text-white',
  3: 'bg-yellow-500 text-white',
  4: 'bg-gray-400 text-white',
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${APP_STATUS[status]}`}>
      {APP_STATUS_LABELS[status]}
    </span>
  )
}

export function NetworkingStatusBadge({ status }: { status: NetworkingStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${NET_STATUS[status]}`}>
      {NET_STATUS_LABELS[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS[4]}`}>
      {priority}
    </span>
  )
}
