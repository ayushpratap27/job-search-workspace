import { Bell, AlertCircle, CheckCircle, Info } from 'lucide-react'

// Placeholder — notifications will be wired via WebSocket in Phase 6
export default function Notifications() {
  return (
    <div className="p-8 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Bell size={24} className="text-blue-600" />
        Notifications
      </h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center space-y-3">
        <div className="flex justify-center gap-3 text-gray-300">
          <AlertCircle size={28} />
          <CheckCircle size={28} />
          <Info size={28} />
        </div>
        <p className="text-gray-500 text-sm">
          Notifications will appear here during automation runs.
        </p>
        <p className="text-gray-400 text-xs">
          Real-time push via WebSocket — coming in Phase 6.
        </p>
      </div>
    </div>
  )
}
