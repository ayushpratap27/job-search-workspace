import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Placeholder from '@/components/Placeholder'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Applications from '@/pages/Applications'
import ApplicationDetail from '@/pages/ApplicationDetail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/applications"  element={<Applications />} />
              <Route path="/applications/:id" element={<ApplicationDetail />} />
              <Route path="/networking"    element={<Placeholder title="Networking" />} />
              <Route path="/recent-hires"  element={<Placeholder title="Recent Hires" />} />
              <Route path="/notifications" element={<Placeholder title="Notifications" />} />
              <Route path="/settings"      element={<Placeholder title="Settings" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
