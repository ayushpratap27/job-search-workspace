import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import AutomationStatusBar, { InterventionCard } from '@/components/automation/AutomationStatusBar'
import { useAutomationSocket } from '@/hooks/useAutomation'

export default function AppLayout() {
  useAutomationSocket()

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-14 bg-canvas">
        <Outlet />
      </main>
      <AutomationStatusBar />
      <InterventionCard />
    </div>
  )
}
