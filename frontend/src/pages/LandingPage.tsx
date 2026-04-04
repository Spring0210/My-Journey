import { NavLink } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import heroImg from '@/assets/hero.png'
import './LandingPage.css'

// ─────────────────────────────────────────────────────────
// LandingPage — product intro for unauthenticated visitors.
// Sections: Hero → Features → AI Highlight → CTA
// ─────────────────────────────────────────────────────────

const features = [
  {
    icon: 'journal' as const,
    iconColor: 'blue',
    title: 'Private Journal',
    description:
      'Write freely with photos and videos. Your entries stay entirely yours — always private, always secure.',
  },
  {
    icon: 'spaces' as const,
    iconColor: 'purple',
    title: 'Shared Spaces',
    description:
      'Create a private group for close friends or family. Share posts, react, and comment in your own space.',
  },
  {
    icon: 'ai' as const,
    iconColor: 'orange',
    title: 'AI Insights',
    description:
      'Personalized writing prompts, smart search, and monthly recaps — all powered by AI that knows your story.',
  },
  {
    icon: 'calendar' as const,
    iconColor: 'green',
    title: 'Calendar View',
    description:
      'Browse your entries on a beautiful calendar. Revisit any day, month, or year in an instant.',
  },
] as const

const aiFeatures = [
  {
    icon: 'search' as const,
    label: 'Smart Search',
    desc: 'Find any memory with natural language — "entries about my mom" just works.',
  },
  {
    icon: 'journal' as const,
    label: 'Monthly Recap',
    desc: 'A warm, personal summary of each month, written just for you.',
  },
  {
    icon: 'ai' as const,
    label: 'Writing Prompts',
    desc: 'Personalized prompts based on themes in your own entries, not generic questions.',
  },
] as const

export default function LandingPage() {
  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="landing-section landing-hero">
        <div className="landing-hero-content">
          <p className="landing-eyebrow">Personal Journaling</p>
          <h1 className="landing-hero-title">
            Your journal.<br />
            <span className="landing-hero-title-gradient">Your story.</span>
          </h1>
          <p className="landing-hero-sub">
            A personal space to write freely, remember what matters, and share
            moments with the people closest to you.
          </p>
          <div className="landing-hero-actions">
            <NavLink to="/register" className="landing-btn-primary">
              Get started free
            </NavLink>
            <NavLink to="/login" className="landing-btn-ghost">
              Sign in
            </NavLink>
          </div>
        </div>
        <div className="landing-hero-img-wrap">
          <img src={heroImg} alt="MyJourney app screenshot" className="landing-hero-img" />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section className="landing-section landing-features">
        <div className="landing-inner">
          <p className="landing-eyebrow">Features</p>
          <h2 className="landing-section-title">
            Everything you need to capture your journey
          </h2>
          <div className="landing-feature-grid">
            {features.map(f => (
              <div key={f.title} className="landing-feature-card">
                <div className={`landing-feature-icon landing-feature-icon--${f.iconColor}`}>
                  <Icon name={f.icon} size={28} strokeWidth={1.5} />
                </div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Highlight ───────────────────────────────────── */}
      <section className="landing-section landing-ai">
        <div className="landing-inner">
          <p className="landing-eyebrow">AI-Powered</p>
          <h2 className="landing-section-title landing-section-title--narrow">
            Your journal, made smarter
          </h2>
          <div className="landing-ai-grid">
            {/* Feature list */}
            <div className="landing-ai-list">
              {aiFeatures.map(item => (
                <div key={item.label} className="landing-ai-item">
                  <div className="landing-ai-icon">
                    <Icon name={item.icon} size={22} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="landing-ai-label">{item.label}</p>
                    <p className="landing-ai-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Visual panel — shows a sample AI interaction */}
            <div className="landing-ai-panel">
              <p className="landing-ai-panel-title">AI Search</p>
              <div className="landing-ai-bubble landing-ai-bubble--user">
                find entries about my trip to Japan
              </div>
              <div className="landing-ai-bubble landing-ai-bubble--ai">
                <p className="landing-ai-bubble-label">MyJourney AI</p>
                Found 4 entries matching your Japan trip — from cherry blossoms in Kyoto to ramen in Tokyo.
              </div>
              <div className="landing-ai-bubble landing-ai-bubble--user">
                what was I feeling in October?
              </div>
              <div className="landing-ai-bubble landing-ai-bubble--ai">
                <p className="landing-ai-bubble-label">MyJourney AI</p>
                In October you wrote often about gratitude, a sense of change, and excitement for the future.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="landing-section landing-cta">
        <div className="landing-inner">
          <div className="landing-cta-card">
            <h2 className="landing-cta-title">Start writing today</h2>
            <p className="landing-cta-sub">Free to get started. No credit card required.</p>
            <NavLink to="/register" className="landing-btn-cta">
              Create your account
            </NavLink>
          </div>
        </div>
      </section>
    </div>
  )
}
