import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Users, FileText } from 'lucide-react'
import { useApplication, useApplicationTimeline, useUpdateApplication } from '@/hooks/useApplications'
import { useRecentHires } from '@/hooks/useRecentHires'
import { ApplicationStatusBadge, NetworkingStatusBadge, PriorityBadge } from '@/components/applications/StatusBadges'
import Timeline from '@/components/timeline/Timeline'
import type { ApplicationStatus, NetworkingStatus } from '@/types'
import { PRIORITY_LABELS } from '@/types'

const NETWORKING_OPTIONS: NetworkingStatus[] = [
  'pending', 'completed', 'replied', 'referral_received', 'resume_received', 'ignored',
]

const NET_LABELS: Record<NetworkingStatus, string> = {
  pending:           'Pending',
  completed:         'Completed',
  replied:           'Replied',
  referral_received: 'Referral Received',
  resume_received:   'Resume Received',
  ignored:           'Ignored',
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: app, isLoading } = useApplication(id!)
  const { data: timeline = [] } = useApplicationTimeline(id!)
  const { data: hiresData } = useRecentHires({ applicationId: id })
  const updateMutation = useUpdateApplication(id!)
  const [notes, setNotes] = useState<string>('')
  const [notesEditing, setNotesEditing] = useState(false)

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (!app) {
    return <div className="p-8 text-gray-500">Application not found.</div>
  }

  const hires = hiresData?.data ?? []

  function handleNetworkingChange(status: NetworkingStatus) {
    updateMutation.mutate({ networkingStatus: status })
  }

  function handleSaveNotes() {
    updateMutation.mutate({ notes })
    setNotesEditing(false)
  }

  return (
    <div className="p-8 space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{app.company.name}</h1>
            <p className="text-gray-600 mt-1">{app.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={app.priority} />
            <ApplicationStatusBadge status={app.applicationStatus as ApplicationStatus} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — company info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Details</h2>

            <InfoRow label="Location">{app.location ?? '—'}</InfoRow>
            <InfoRow label="Priority">{PRIORITY_LABELS[app.priority]}</InfoRow>
            <InfoRow label="Platform">{app.platform}</InfoRow>
            {app.appliedAt && (
              <InfoRow label="Applied">
                {new Date(app.appliedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </InfoRow>
            )}

            <div className="pt-2 space-y-2">
              {app.jobUrl && (
                <a href={app.jobUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <ExternalLink size={13} /> Job Posting
                </a>
              )}
              {app.company.linkedinUrl && (
                <a href={app.company.linkedinUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <ExternalLink size={13} /> Company LinkedIn
                </a>
              )}
              {app.company.careerPageUrl && (
                <a href={app.company.careerPageUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <ExternalLink size={13} /> Career Page
                </a>
              )}
            </div>
          </div>

          {/* Networking status */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Users size={13} /> Networking
            </h2>
            <div className="mb-2">
              <NetworkingStatusBadge status={app.networkingStatus as NetworkingStatus} />
            </div>
            <select
              defaultValue={app.networkingStatus}
              onChange={(e) => handleNetworkingChange(e.target.value as NetworkingStatus)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {NETWORKING_OPTIONS.map(s => (
                <option key={s} value={s}>{NET_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <FileText size={13} /> Notes
            </h2>
            {notesEditing ? (
              <>
                <textarea
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveNotes}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                    Save
                  </button>
                  <button onClick={() => setNotesEditing(false)}
                    className="px-3 py-1 border border-gray-200 text-xs rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div
                onClick={() => { setNotes(app.notes ?? ''); setNotesEditing(true) }}
                className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 rounded p-1 min-h-12"
              >
                {app.notes || <span className="text-gray-400 italic">Click to add notes…</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right — timeline + recent hires */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent hires */}
          {hires.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users size={13} /> Recent Hires ({hires.length})
              </h2>
              <div className="divide-y divide-gray-50">
                {hires.map(h => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.designation ?? ''}{h.joinedAt ? ` · ${h.joinedAt}` : ''}</p>
                    </div>
                    {h.profileUrl && (
                      <a href={h.profileUrl} target="_blank" rel="noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1">
                        <ExternalLink size={12} /> LinkedIn
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Timeline</h2>
            <Timeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{children}</span>
    </div>
  )
}
