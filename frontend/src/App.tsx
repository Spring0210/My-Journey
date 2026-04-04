import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import AppLayout    from '@/components/layout/AppLayout'
import PublicLayout from '@/components/layout/PublicLayout'
import AuthLayout   from '@/components/layout/AuthLayout'
import LandingPage  from '@/pages/LandingPage'

// Placeholder — replaced page by page during migration
function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      color: 'var(--label-secondary)',
      fontSize: 15,
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
      {/* ── Public pages (NavBar + Footer) ───────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/"        element={<LandingPage />} />
        <Route path="/privacy" element={<ComingSoon name="Privacy Policy" />} />
        <Route path="/terms"   element={<ComingSoon name="Terms of Service" />} />
      </Route>

      {/* ── Auth pages (centered card, no sidebar) ────────── */}
      <Route element={<RedirectIfAuth><AuthLayout /></RedirectIfAuth>}>
        <Route path="/login"           element={<ComingSoon name="Login" />} />
        <Route path="/register"        element={<ComingSoon name="Register" />} />
        <Route path="/forgot-password" element={<ComingSoon name="Forgot Password" />} />
      </Route>

      {/* OAuth2 callback — no layout, handles redirect itself */}
      <Route path="/oauth2/callback" element={<ComingSoon name="OAuth2 Callback" />} />

      {/* ── App pages (Sidebar layout, require auth) ──────── */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/journal"       element={<ComingSoon name="Journal" />} />
        <Route path="/journal/:id"   element={<ComingSoon name="Journal Detail" />} />
        <Route path="/calendar"      element={<ComingSoon name="Calendar" />} />
        <Route path="/spaces"        element={<ComingSoon name="Spaces" />} />
        <Route path="/spaces/:id"    element={<ComingSoon name="Space Detail" />} />
        <Route path="/notifications" element={<ComingSoon name="Notifications" />} />
        <Route path="/profile"       element={<ComingSoon name="Profile" />} />
        <Route path="/search"        element={<ComingSoon name="Smart Search" />} />
      </Route>

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
