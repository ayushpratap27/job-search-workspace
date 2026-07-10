import { Play, Pause, Loader2, AlertCircle } from 'lucide-react'
import { useAutomationStore } from '@/store/automationStore'
import { useStartAutomation, usePauseAutomation, useResumeAutomation } from '@/hooks/useAutomation'

export default function AutomationStatusBar() {
  const store = useAutomationStore()
  const startMutation = useStartAutomation()
  const pauseMutation = usePauseAutomation()

  if (!store.isRunning && !store.isPaused && !store.interventionPending) {
    return (
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-gray-100 px-6 py-2 flex items-center justify-between z-10">
        <span className="text-sm text-gray-400">Automation is idle</span>
        <button
          onClick={() => startMutation.mutate({})}
          disabled={startMutation.isPending}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {startMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Start Automation
        </button>
      </div>
    )
  }

  if (store.interventionPending) {
    return null // Handled by InterventionCard
  }

  return (
    <div className="fixed bottom-0 left-60 right-0 bg-blue-600 px-6 py-2 flex items-center justify-between z-10">
      <div className="flex items-center gap-3 text-white text-sm">
        <Loader2 size={14} className="animate-spin" />
        <span>
          {store.currentCompany
            ? `Processing ${store.currentCompany} — ${store.currentRole ?? ''}`
            : 'Running…'}
        </span>
        <span className="text-blue-200 text-xs">
          {store.stats.jobsApplied} applied · {store.stats.jobsFound} found
        </span>
      </div>
      <button
        onClick={() => pauseMutation.mutate()}
        disabled={pauseMutation.isPending}
        className="flex items-center gap-2 px-3 py-1 bg-blue-700 text-white text-xs rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
      >
        <Pause size={12} /> Pause
      </button>
    </div>
  )
}

export function InterventionCard() {
  const store = useAutomationStore()
  const resumeMutation = useResumeAutomation() // Bug #2 fix: was usePauseAutomation

  if (!store.interventionPending) return null

  function handleResume() {
    if (store.sessionId) {
      resumeMutation.mutate(store.sessionId)
    } else {
      // sessionId unknown — just update local state and let user try again
      store.setResumed()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg shrink-0">
            <AlertCircle size={20} className="text-orange-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Action Required</h2>
            <p className="text-sm text-gray-600 mt-1 capitalize">
              {store.interventionReason?.replace(/_/g, ' ')}
            </p>
            {store.interventionMessage && (
              <p className="text-sm text-gray-500 mt-1">{store.interventionMessage}</p>
            )}
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-3 text-sm text-orange-700">
          Please complete the required action in the browser window, then click <strong>Resume</strong>.
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleResume}
            disabled={resumeMutation.isPending}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {resumeMutation.isPending ? 'Resuming…' : "I've completed it — Resume"}
          </button>
          <button
            onClick={store.reset}
            className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  )
}
