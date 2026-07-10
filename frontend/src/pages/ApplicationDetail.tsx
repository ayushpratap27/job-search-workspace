import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Users, FileText } from 'lucide-react'
import { useApplication, useApplicationTimeline, useUpdateApplication } from '@/hooks/useApplications'
import { useRecentHires } from '@/hooks/useRecentHires'
import { ApplicationStatusBadge, NetworkingStatusBadge, PriorityBadge } from '@/components/applications/StatusBadges'
import Timeline from '@/components/timeline/Timeline'
import type { ApplicationStatus, NetworkingStatus } from '@/types'
import { PRIORITY_LABELS } from '@/types'

const NETWORKING_OPTIONS: NetworkingStatus[] = ['pending','completed','replied','referral_received','resume_received','ignored']
const NET_LABELS: Record<NetworkingStatus, string> = {
  pending:'Pending', completed:'Completed', replied:'Replied',
  referral_received:'Referral Received', resume_received:'Resume Received', ignored:'Ignored',
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
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-5 bg-surface-card w-32" />
        <div className="h-8 bg-surface-card w-64" />
        <div className="h-64 bg-surface-card" />
      </div>
    )
  }

  if (!app) return <div className="p-8 text-muted">Application not found.</div>

  const hires = hiresData?.data ?? []

  return (
    <div className="p-8 space-y-6">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 label-m hover:text-on-dark mb-4 transition-colors">
          <ArrowLeft size={11} /> Back
        </button>
        <div className="border-b border-hairline pb-5">
          <p className="label-m mb-1">{app.platform}</p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark">{app.company.name}</h1>
              <p className="text-body mt-1 font-light">{app.role}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PriorityBadge priority={app.priority} />
              <ApplicationStatusBadge status={app.applicationStatus as ApplicationStatus} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          {/* Details */}
          <div className="card-m space-y-3">
            <p className="label-m border-b border-hairline pb-2">Details</p>
            <InfoRow label="Location">{app.location ?? '—'}</InfoRow>
            <InfoRow label="Priority">{PRIORITY_LABELS[app.priority]}</InfoRow>
            <InfoRow label="Platform">{app.platform}</InfoRow>
            {app.appliedAt && (
              <InfoRow label="Applied">
                {new Date(app.appliedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </InfoRow>
            )}
            <div className="pt-1 space-y-2 border-t border-hairline">
              {app.jobUrl && (
                <a href={app.jobUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
                  <ExternalLink size={11} /> Job Posting
                </a>
              )}
              {app.company.linkedinUrl && (
                <a href={app.company.linkedinUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
                  <ExternalLink size={11} /> Company LinkedIn
                </a>
              )}
              {app.company.careerPageUrl && (
                <a href={app.company.careerPageUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
                  <ExternalLink size={11} /> Career Page
                </a>
              )}
            </div>
          </div>

          {/* Networking */}
          <div className="card-m space-y-3">
            <p className="label-m border-b border-hairline pb-2 flex items-center gap-2"><Users size={10} /> Networking</p>
            <div className="mb-2"><NetworkingStatusBadge status={app.networkingStatus as NetworkingStatus} /></div>
            <select
              defaultValue={app.networkingStatus}
              onChange={(e) => updateMutation.mutate({ networkingStatus: e.target.value })}
              className="select-m w-full text-xs"
            >
              {NETWORKING_OPTIONS.map(s => <option key={s} value={s}>{NET_LABELS[s]}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="card-m space-y-2">
            <p className="label-m border-b border-hairline pb-2 flex items-center gap-2"><FileText size={10} /> Notes</p>
            {notesEditing ? (
              <>
                <textarea className="input-m resize-none text-xs" rows={4}
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => { updateMutation.mutate({ notes }); setNotesEditing(false) }}
                    className="btn-m btn-m-primary py-1.5 px-4 text-[11px]">Save</button>
                  <button onClick={() => setNotesEditing(false)}
                    className="btn-m btn-m-outline py-1.5 px-4 text-[11px]">Cancel</button>
                </div>
              </>
            ) : (
              <div onClick={() => { setNotes(app.notes ?? ''); setNotesEditing(true) }}
                className="text-xs text-body cursor-pointer hover:text-body-strong min-h-10 font-light transition-colors">
                {app.notes || <span className="text-muted italic">Click to add notes...</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent hires */}
          {hires.length > 0 && (
            <div className="card-m">
              <p className="label-m border-b border-hairline pb-2 mb-3 flex items-center gap-2">
                <Users size={10} /> Recent Hires ({hires.length})
              </p>
              <div className="divide-y divide-hairline">
                {hires.map(h => (
                  <div key={h.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-on-dark">{h.name}</p>
                      <p className="text-xs text-muted font-light">{h.designation ?? ''}{h.joinedAt ? ` · ${h.joinedAt}` : ''}</p>
                    </div>
                    {h.profileUrl && (
                      <a href={h.profileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-m-blue-dark hover:text-on-dark transition-colors">
                        <ExternalLink size={11} /> LinkedIn
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card-m">
            <p className="label-m border-b border-hairline pb-2 mb-4">Timeline</p>
            <Timeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted uppercase tracking-wider">{label}</span>
      <span className="text-body-strong font-medium">{children}</span>
    </div>
  )
}
