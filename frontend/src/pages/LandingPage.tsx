import { NavLink } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll'
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

type Feature = typeof features[number]
type AiFeature = typeof aiFeatures[number]

// ── Wrapper components for staggered scroll-driven fade-up ──────────────────
// Each instance gets its own ref so it can be observed independently.

function FadeInFeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const ref = useFadeInOnScroll<HTMLDivElement>(index * 80)
  return (
    <div ref={ref} className="landing-feature-card fade-up">
      <div className={`landing-feature-icon landing-feature-icon--${feature.iconColor}`}>
        <Icon name={feature.icon} size={28} strokeWidth={1.5} />
      </div>
      <h3 className="landing-feature-title">{feature.title}</h3>
      <p className="landing-feature-desc">{feature.description}</p>
    </div>
  )
}

function FadeInAiItem({ item, index }: { item: AiFeature; index: number }) {
  const ref = useFadeInOnScroll<HTMLDivElement>(index * 100)
  return (
    <div ref={ref} className="landing-ai-item fade-up">
      <div className="landing-ai-icon">
        <Icon name={item.icon} size={22} strokeWidth={1.5} />
      </div>
      <div>
        <p className="landing-ai-label">{item.label}</p>
        <p className="landing-ai-desc">{item.desc}</p>
      </div>
    </div>
  )
}

// ── Hero mockup — CSS-based app preview, adapts to dark/light mode ──────────
// Renders a fake journal entry window with floating badges.
// No images — all colors use var(--*) tokens.
function HeroMockup() {
  return (
    <div className="hero-mockup">
      {/* Soft accent glow behind the card */}
      <div className="hero-mockup-glow" aria-hidden="true" />

      {/* Main app window card */}
      <div className="hero-mockup-card">

        {/* macOS window chrome */}
        <div className="hero-chrome">
          <span className="hero-chrome-dot hero-chrome-dot--red"   />
          <span className="hero-chrome-dot hero-chrome-dot--yellow"/>
          <span className="hero-chrome-dot hero-chrome-dot--green" />
        </div>

        {/* Fake page top bar */}
        <div className="hero-topbar">
          <div className="hero-topbar-back">
            <span className="hero-topbar-chevron">‹</span>
            Journal
          </div>
          <span className="hero-topbar-save">Save</span>
        </div>

        {/* Journal entry body */}
        <div className="hero-entry">
          <p className="hero-entry-date">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
          <p className="hero-entry-title">Morning Light</p>
          <div className="hero-entry-sep" />
          <p className="hero-entry-body">
            Had the most peaceful morning today. Coffee by the window, soft
            light coming through the curtains. Took a long walk after and
            found the most beautiful little park...
          </p>
          <div className="hero-entry-photos">
            <div className="hero-entry-photo hero-entry-photo--a" />
            <div className="hero-entry-photo hero-entry-photo--b" />
            <div className="hero-entry-photo hero-entry-photo--c" />
          </div>
        </div>
      </div>

      {/* Floating badge — top right: AI recap */}
      <div className="hero-float hero-float--ai">
        <span className="hero-float-dot" />
        AI Recap ready
      </div>

      {/* Floating toast — bottom right: saved */}
      <div className="hero-float hero-float--saved">
        <span className="hero-float-check">✓</span>
        Entry saved
      </div>
    </div>
  )
}

export default function LandingPage() {
  // Single-instance fade-up targets (the multi-instance ones are wrapped above)
  const aiPanelRef = useFadeInOnScroll<HTMLDivElement>(200)
  const ctaCardRef = useFadeInOnScroll<HTMLDivElement>(0)

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
          <HeroMockup />
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
            {features.map((f, i) => (
              <FadeInFeatureCard key={f.title} feature={f} index={i} />
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
              {aiFeatures.map((item, i) => (
                <FadeInAiItem key={item.label} item={item} index={i} />
              ))}
            </div>

            {/* Visual panel — shows a sample AI interaction */}
            <div ref={aiPanelRef} className="landing-ai-panel fade-up">
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
          <div ref={ctaCardRef} className="landing-cta-card fade-up">
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
