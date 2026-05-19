import { create } from 'zustand'

export interface User {
  id: string
  email: string
  name: string
  username?: string
  avatar?: string
  organizationId?: string
  walletAddress?: string
  isOnboarded: boolean
  authProvider: 'oidc'
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isSessionVerified: boolean
  isLogoutPending: boolean
  /**
   * Unix-ms timestamp when the current access token expires. Drives
   * proactive refresh scheduling in useSessionPersistence — null when there
   * is no active session.
   */
  expiresAt: number | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setSessionVerified: (isSessionVerified: boolean) => void
  setLogoutPending: (isLogoutPending: boolean) => void
  setExpiresAt: (expiresAt: number | null) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  isSessionVerified: false,
  isLogoutPending: false,
  expiresAt: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionVerified: (isSessionVerified) => set({ isSessionVerified }),
  setLogoutPending: (isLogoutPending) => set({ isLogoutPending }),
  setExpiresAt: (expiresAt) => set({ expiresAt }),
  logout: () => set({ user: null, isAuthenticated: false, expiresAt: null }),
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null
    }))
}))
