import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import AppLayout    from '@/components/layout/AppLayout'
import PublicLayout from '@/components/layout/PublicLayout'
import AuthLayout   from '@/components/layout/AuthLayout'
import ScrollToTop  from '@/components/layout/ScrollToTop'
import LandingPage        from '@/pages/LandingPage'
import LoginPage          from '@/pages/auth/LoginPage'
import RegisterPage       from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import OAuth2CallbackPage from '@/pages/auth/OAuth2CallbackPage'
import JournalListPage   from '@/pages/journal/JournalListPage'
import JournalDetailPage from '@/pages/journal/JournalDetailPage'
import CalendarPage      from '@/pages/journal/CalendarPage'
import MediaPage         from '@/pages/media/MediaPage'
import SpacesListPage      from '@/pages/spaces/SpacesListPage'
import SpaceDetailPage     from '@/pages/spaces/SpaceDetailPage'
import DocumentDetailPage  from '@/pages/spaces/DocumentDetailPage'
import DocumentEditPage    from '@/pages/spaces/DocumentEditPage'
import AgentChatPage       from '@/pages/agent/AgentChatPage'
import AiAssistantPage     from '@/pages/agent/AiAssistantPage'
import NotificationsPage   from '@/pages/notifications/NotificationsPage'
import ProfilePage         from '@/pages/profile/ProfilePage'
import DashboardPage       from '@/pages/dashboard/DashboardPage'
import PrivacyPage         from '@/pages/legal/PrivacyPage'
import TermsPage           from '@/pages/legal/TermsPage'

// Redirect unauthenticated users to /login
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

// Redirect already-authenticated users away from auth pages
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public pages (NavBar + Footer) ───────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/"        element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms"   element={<TermsPage />} />
      </Route>

      {/* ── Auth pages (centered card, no sidebar) ────────── */}
      <Route element={<RedirectIfAuth><AuthLayout /></RedirectIfAuth>}>
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* OAuth2 callback — no layout, reads params and redirects into app */}
      <Route path="/oauth2/callback" element={<OAuth2CallbackPage />} />

      {/* ── App pages (Sidebar layout, require auth) ──────── */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard"     element={<DashboardPage />} />

        {/* Journal — personal-space docs get their own URL family so the
            sidebar highlights "Journal" naturally and the URL bar doesn't
            leak the "personal space" implementation detail. The /legacy
            child still serves the pre-migration journal_entry table for
            search / AI-search hits until those endpoints migrate to the
            document model. */}
        <Route path="/journal"                element={<JournalListPage />} />
        <Route path="/journal/new"            element={<DocumentEditPage />} />
        <Route path="/journal/legacy/:id"     element={<JournalDetailPage />} />
        <Route path="/journal/:docId"         element={<DocumentDetailPage />} />
        <Route path="/journal/:docId/edit"    element={<DocumentEditPage />} />

        <Route path="/media"         element={<MediaPage />} />
        <Route path="/calendar"      element={<CalendarPage />} />
        <Route path="/spaces"        element={<SpacesListPage />} />
        <Route path="/spaces/:id"    element={<SpaceDetailPage />} />
        <Route path="/spaces/:id/chat"                  element={<AgentChatPage />} />
        <Route path="/spaces/:id/documents/new"         element={<DocumentEditPage />} />
        <Route path="/spaces/:id/documents/:docId"      element={<DocumentDetailPage />} />
        <Route path="/spaces/:id/documents/:docId/edit" element={<DocumentEditPage />} />
        <Route path="/ai"            element={<AiAssistantPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile"       element={<ProfilePage />} />
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
          <ScrollToTop />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
