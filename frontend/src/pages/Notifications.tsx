import { Bell, AlertCircle, CheckCircle, Info, Check } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

const TYPE_ICON: Record<string, React.ElementType> = {
  intervention_captcha: AlertCircle,
  intervention_otp_email: AlertCircle,
  intervention_otp_phone: AlertCircle,
  intervention_unknown_form: AlertCircle,
  session_error: AlertCircle,
  session_complete: CheckCircle,
  daily_summary_ready: Info,
}

const TYPE_COLOR: Record<string, string> = {
  intervention_captcha: 'text-orange-500 bg-orange-50',
  intervention_otp_email: 'text-orange-500 bg-orange-50',
  intervention_otp_phone: 'text-orange-500 bg-orange-50',
  session_error: 'text-red-500 bg-red-50',
  session_complete: 'text-green-500 bg-green-50',
  daily_summary_ready: 'text-blue-500 bg-blue-50',
}

export default function Notifications() {
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const notifications = data?.data ?? []
  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={24} className="text-blue-600" />
          Notifications
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <Check size={13} /> Mark all read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <div className="flex justify-center gap-3 opacity-30">
              <AlertCircle size={28} /><CheckCircle size={28} /><Info size={28} />
            </div>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Info
            const color = TYPE_COLOR[n.type] ?? 'text-gray-500 bg-gray-50'
            return (
              <div key={n.id} className={`flex items-start gap-4 p-4 transition-colors ${n.isRead ? 'opacity-60' : 'bg-blue-50/30'}`}>
                <div className={`p-2 rounded-lg shrink-0 ${color}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="shrink-0 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
