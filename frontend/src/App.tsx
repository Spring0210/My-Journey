import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'

// Placeholder — replaced page by page during migration
function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      fontFamily: 'var(--font-sans)',
      color: 'var(--label-secondary)',
      fontSize: '15px',
    }}>
      {name} — coming soon
    </div>
  )
}

// Redirect unauthenticated users to /login
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Redirect already-authenticated users away from auth pages
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/journal" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"        element={<ComingSoon name="Landing" />} />
      <Route path="/privacy" element={<ComingSoon name="Privacy Policy" />} />
      <Route path="/terms"   element={<ComingSoon name="Terms of Service" />} />

      {/* Auth */}
      <Route path="/login"           element={<RedirectIfAuth><ComingSoon name="Login" /></RedirectIfAuth>} />
      <Route path="/register"        element={<RedirectIfAuth><ComingSoon name="Register" /></RedirectIfAuth>} />
      <Route path="/forgot-password" element={<RedirectIfAuth><ComingSoon name="Forgot Password" /></RedirectIfAuth>} />
      <Route path="/oauth2/callback" element={<ComingSoon name="OAuth2 Callback" />} />

      {/* App — require auth */}
      <Route path="/journal"       element={<RequireAuth><ComingSoon name="Journal" /></RequireAuth>} />
      <Route path="/journal/:id"   element={<RequireAuth><ComingSoon name="Journal Detail" /></RequireAuth>} />
      <Route path="/calendar"      element={<RequireAuth><ComingSoon name="Calendar" /></RequireAuth>} />
      <Route path="/spaces"        element={<RequireAuth><ComingSoon name="Spaces" /></RequireAuth>} />
      <Route path="/spaces/:id"    element={<RequireAuth><ComingSoon name="Space Detail" /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><ComingSoon name="Notifications" /></RequireAuth>} />
      <Route path="/profile"       element={<RequireAuth><ComingSoon name="Profile" /></RequireAuth>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
