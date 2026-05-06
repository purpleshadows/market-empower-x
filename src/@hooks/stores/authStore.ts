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
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setSessionVerified: (isSessionVerified: boolean) => void
  setLogoutPending: (isLogoutPending: boolean) => void
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  isSessionVerified: false,
  isLogoutPending: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionVerified: (isSessionVerified) => set({ isSessionVerified }),
  setLogoutPending: (isLogoutPending) => set({ isLogoutPending }),
  logout: () => set({ user: null, isAuthenticated: false }),
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null
    }))
}))
