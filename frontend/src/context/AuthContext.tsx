import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// ─────────────────────────────────────────────────────────
// Auth context — global auth state for the entire app.
// Mirrors the localStorage schema used by the existing backend.
// ─────────────────────────────────────────────────────────

interface AuthState {
  token: string | null
  refreshToken: string | null
  userId: number | null
  username: string | null
  avatarUrl: string | null
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean
  login: (state: Required<AuthState>) => void
  logout: () => void
  updateAvatar: (url: string) => void
  updateUsername: (name: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Read initial auth state from localStorage (set by existing login flow)
function readStorage(): AuthState {
  return {
    token:        localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken'),
    userId:       Number(localStorage.getItem('userId')) || null,
    username:     localStorage.getItem('username'),
    avatarUrl:    localStorage.getItem('avatarUrl'),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(readStorage)

  // Keep localStorage in sync whenever auth state changes
  useEffect(() => {
    if (auth.token) {
      localStorage.setItem('token',        auth.token)
      localStorage.setItem('refreshToken', auth.refreshToken ?? '')
      localStorage.setItem('userId',       String(auth.userId ?? ''))
      localStorage.setItem('username',     auth.username ?? '')
      localStorage.setItem('avatarUrl',    auth.avatarUrl ?? '')
    } else {
      // Clear all auth keys on logout
      ;['token', 'refreshToken', 'userId', 'username', 'avatarUrl'].forEach(k =>
        localStorage.removeItem(k)
      )
    }
  }, [auth])

  function login(state: Required<AuthState>) {
    setAuth(state)
  }

  function logout() {
    setAuth({ token: null, refreshToken: null, userId: null, username: null, avatarUrl: null })
  }

  function updateAvatar(url: string) {
    setAuth(prev => ({ ...prev, avatarUrl: url }))
  }

  function updateUsername(name: string) {
    setAuth(prev => ({ ...prev, username: name }))
  }

  return (
    <AuthContext.Provider value={{
      ...auth,
      isAuthenticated: !!auth.token,
      login,
      logout,
      updateAvatar,
      updateUsername,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook — throws if used outside AuthProvider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
