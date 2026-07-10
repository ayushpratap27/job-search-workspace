import { Bell, AlertCircle, CheckCircle, Info, Check } from 'lucide-react'
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

const TYPE_ICON: Record<string, React.ElementType> = {
  intervention_captcha: AlertCircle,
  intervention_otp_email: AlertCircle,
  intervention_otp_phone: AlertCircle,
  session_error: AlertCircle,
  session_complete: CheckCircle,
  daily_summary_ready: Info,
}

const TYPE_COLOR: Record<string, string> = {
  intervention_captcha: 'text-[#f4b400] border-[#f4b400]/30',
  intervention_otp_email: 'text-[#f4b400] border-[#f4b400]/30',
  intervention_otp_phone: 'text-[#f4b400] border-[#f4b400]/30',
  session_error: 'text-[#e22718] border-[#e22718]/30',
  session_complete: 'text-[#0fa336] border-[#0fa336]/30',
  daily_summary_ready: 'text-[#1c69d4] border-[#1c69d4]/30',
}

export default function Notifications() {
  const { data, isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const notifications = data?.data ?? []
  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="p-8 space-y-6">
      <div className="border-b border-hairline pb-5 flex items-end justify-between">
        <div>
          <p className="label-m mb-1 flex items-center gap-2"><Bell size={11} /> Alerts</p>
          <h1 className="text-2xl font-bold uppercase tracking-wide text-on-dark flex items-center gap-3">
            Notifications
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-[1px] bg-[#1c69d4] text-white px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAll.mutate()}
            className="btn-m btn-m-ghost flex items-center gap-1.5 py-1.5 px-3 text-[11px]">
            <Check size={11} /> Mark all read
          </button>
        )}
      </div>

      <div className="card-m p-0 divide-y divide-hairline overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-surface-elevated animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="flex justify-center gap-3 text-muted opacity-20">
              <AlertCircle size={24} /><CheckCircle size={24} /><Info size={24} />
            </div>
            <p className="label-m">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Info
            const color = TYPE_COLOR[n.type] ?? 'text-muted border-hairline'
            return (
              <div key={n.id}
                className={`flex items-start gap-4 p-4 transition-colors ${n.isRead ? 'opacity-50' : 'bg-surface-soft'}`}>
                <div className={`border p-1.5 flex-shrink-0 mt-0.5 ${color}`}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-dark">{n.title}</p>
                  <p className="text-xs text-body font-light mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead.mutate(n.id)}
                    className="text-muted hover:text-on-dark transition-colors flex-shrink-0 mt-0.5">
                    <Check size={13} />
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
