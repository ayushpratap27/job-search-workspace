import { Play, Pause, Loader2, AlertCircle } from 'lucide-react'
import { useAutomationStore } from '@/store/automationStore'
import { useStartAutomation, usePauseAutomation, useResumeAutomation } from '@/hooks/useAutomation'

export default function AutomationStatusBar() {
  const store = useAutomationStore()
  const startMutation = useStartAutomation()
  const pauseMutation = usePauseAutomation()

  if (!store.isRunning && !store.isPaused && !store.interventionPending) {
    return (
      <div className="fixed bottom-0 left-56 right-0 bg-surface-card border-t border-hairline px-6 py-2.5 flex items-center justify-between z-10">
        <span className="label-m">Automation idle</span>
        <button
          onClick={() => startMutation.mutate({})}
          disabled={startMutation.isPending}
          className="btn-m btn-m-primary flex items-center gap-2 py-2 px-5 text-[12px]"
        >
          {startMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          Start Automation
        </button>
      </div>
    )
  }

  if (store.interventionPending) return null

  return (
    <div className="fixed bottom-0 left-56 right-0 bg-surface-card border-t border-m-blue-dark px-6 py-2.5 flex items-center justify-between z-10">
      <div className="flex items-center gap-4">
        <Loader2 size={13} className="animate-spin text-m-blue-dark" />
        <span className="text-on-dark text-[12px] font-medium">
          {store.currentCompany ? `${store.currentCompany} · ${store.currentRole ?? ''}` : 'Running…'}
        </span>
        <span className="label-m">
          {store.stats.jobsApplied} applied · {store.stats.jobsFound} found
        </span>
      </div>
      <button
        onClick={() => pauseMutation.mutate()}
        disabled={pauseMutation.isPending}
        className="btn-m btn-m-outline flex items-center gap-1.5 py-1.5 px-4 text-[11px]"
      >
        <Pause size={11} /> Pause
      </button>
    </div>
  )
}

export function InterventionCard() {
  const store = useAutomationStore()
  const resumeMutation = useResumeAutomation()

  if (!store.interventionPending) return null

  function handleResume() {
    if (store.sessionId) {
      resumeMutation.mutate(store.sessionId)
    } else {
      store.setResumed()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-hairline w-full max-w-md mx-4 p-8 space-y-5">
        {/* M stripe */}
        <div className="m-stripe -mx-8 -mt-8 mb-6" />

        <div className="flex items-start gap-4">
          <div className="border border-[#e22718] p-2 flex-shrink-0">
            <AlertCircle size={18} className="text-[#e22718]" />
          </div>
          <div>
            <p className="label-m text-[#e22718] mb-1">Action Required</p>
            <h2 className="text-base font-bold uppercase tracking-wide text-on-dark">
              {store.interventionReason?.replace(/_/g, ' ')}
            </h2>
            {store.interventionMessage && (
              <p className="text-sm text-body mt-1 font-light">{store.interventionMessage}</p>
            )}
          </div>
        </div>

        <div className="bg-surface-elevated border border-hairline p-3">
          <p className="text-xs text-body font-light">
            Complete the required action in the browser window, then click{' '}
            <strong className="text-on-dark font-semibold">Resume</strong>.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleResume}
            disabled={resumeMutation.isPending}
            className="btn-m btn-m-primary flex-1"
          >
            {resumeMutation.isPending ? 'Resuming…' : 'Resume Automation'}
          </button>
          <button onClick={store.reset} className="btn-m btn-m-outline px-5">
            Stop
          </button>
        </div>
      </div>
    </div>
  )
}
