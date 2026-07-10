import { create } from 'zustand'

interface AuthState {
  userId: string | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (userId: string, accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  accessToken: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (userId, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ userId, accessToken, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ userId: null, accessToken: null, isAuthenticated: false })
  },
}))
