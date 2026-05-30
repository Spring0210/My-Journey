import { NavLink } from 'react-router-dom'
import Icon from '@/components/ui/Icon'
import { useFadeInOnScroll } from '@/hooks/useFadeInOnScroll'
import './LandingPage.css'

// ─────────────────────────────────────────────────────────
// LandingPage — product intro for unauthenticated visitors.
// Positioning: an AI-native personal + team knowledge base where
// every document is reachable by an AI agent.
// Sections: Hero → Features → Bring-your-own-AI (MCP) → CTA
// ─────────────────────────────────────────────────────────

// ── Core value props — 2×2 feature grid ────────────────────────────────────
const features = [
  {
    icon: 'spaces' as const,
    iconColor: 'blue',
    title: 'Personal + team spaces',
    description:
      'A private space of your own and shared spaces for your team. Comment, react, and build a knowledge base together.',
  },
  {
    icon: 'journal' as const,
    iconColor: 'green',
    title: 'Write & organize docs',
    description:
      'Rich documents with photos and video, full-text search, and a timeline view — your whole knowledge base in one place.',
  },
  {
    icon: 'ai' as const,
    iconColor: 'orange',
    title: 'In-app AI chat',
    description:
      'Ask, search, and draft in natural language. Multimodal — drop in an image or a PDF and the agent reads it.',
  },
  {
    icon: 'link' as const,
    iconColor: 'purple',
    title: 'Reachable by any AI',
    description:
      'Every document is reachable by an AI agent — not just here, but from your own tools like Claude Desktop and Cursor.',
  },
] as const

// ── "Bring your own AI" points — left column of the MCP section ─────────────
const mcpPoints = [
  {
    icon: 'link' as const,
    label: 'Connect any MCP client',
    desc: 'Claude Desktop, Cursor, or anything that speaks the Model Context Protocol — one config paste and you are in.',
  },
  {
    icon: 'lock' as const,
    label: 'Read and write, securely',
    desc: 'Scoped access tokens you create and revoke yourself. Every tool call is rate-limited and audited.',
  },
  {
    icon: 'ai' as const,
    label: 'One toolset, every surface',
    desc: 'Your AI uses the exact same tools as the in-app agent — search, read, write docs, spaces, and comments.',
  },
] as const

type Feature = typeof features[number]
type McpPoint = typeof mcpPoints[number]

// ── Documents shown in the hero mockup sidebar ──────────────────────────────
const mockDocs = [
  { title: 'Onboarding', active: false },
  { title: 'Q2 Roadmap', active: false },
  { title: 'API Notes', active: true },
] as const

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

function FadeInMcpPoint({ point, index }: { point: McpPoint; index: number }) {
  const ref = useFadeInOnScroll<HTMLDivElement>(index * 100)
  return (
    <div ref={ref} className="landing-ai-item fade-up">
      <div className="landing-ai-icon">
        <Icon name={point.icon} size={22} strokeWidth={1.5} />
      </div>
      <div>
        <p className="landing-ai-label">{point.label}</p>
        <p className="landing-ai-desc">{point.desc}</p>
      </div>
    </div>
  )
}

// ── Hero mockup — CSS-based app preview, adapts to dark/light mode ──────────
// Renders a team space: a document list on the left and an AI exchange on the
// right that cites the document it read. No images — all colors use var(--*).
function HeroMockup() {
  return (
    <div className="kb-mockup">
      {/* Soft accent glow behind the card */}
      <div className="kb-mockup-glow" aria-hidden="true" />

      {/* Main app window card */}
      <div className="kb-mockup-card">

        {/* macOS window chrome */}
        <div className="kb-chrome">
          <span className="kb-chrome-dot kb-chrome-dot--red" />
          <span className="kb-chrome-dot kb-chrome-dot--yellow" />
          <span className="kb-chrome-dot kb-chrome-dot--green" />
        </div>

        {/* Space header */}
        <div className="kb-topbar">
          <div className="kb-topbar-space">
            <span className="kb-topbar-avatar">T</span>
            Team Space
          </div>
          <span className="kb-topbar-badge">Shared</span>
        </div>

        {/* Two-column body: document list + AI chat */}
        <div className="kb-body">
          {/* Sidebar — document list */}
          <div className="kb-sidebar">
            <p className="kb-sidebar-label">Documents</p>
            {mockDocs.map((doc) => (
              <div
                key={doc.title}
                className={`kb-doc${doc.active ? ' kb-doc--active' : ''}`}
              >
                <span className="kb-doc-glyph" aria-hidden="true" />
                <span className="kb-doc-title">{doc.title}</span>
              </div>
            ))}
          </div>

          {/* Main — AI exchange grounded in the docs */}
          <div className="kb-chat">
            <div className="kb-bubble kb-bubble--user">
              Where do we deploy the app?
            </div>
            <div className="kb-bubble kb-bubble--ai">
              <p className="kb-bubble-label">MyJourney AI</p>
              Deploys run on DigitalOcean via GitHub Actions.
              <span className="kb-cite">
                <span className="kb-doc-glyph kb-doc-glyph--cite" aria-hidden="true" />
                API Notes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — top right: AI grounded its answer in real docs */}
      <div className="kb-float kb-float--cited">
        <span className="kb-float-dot" />
        AI cited 3 docs
      </div>

      {/* Floating toast — bottom right: reachable from external clients */}
      <div className="kb-float kb-float--synced">
        <span className="kb-float-check">
          <Icon name="check" size={13} strokeWidth={2.5} />
        </span>
        Synced to Claude Desktop
      </div>
    </div>
  )
}

// ── MCP config snippet shown in the "Bring your own AI" panel ───────────────
const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "my-journey": {
      "url": "https://myjourneycloud.com/mcp",
      "headers": {
        "Authorization": "Bearer mj_..."
      }
    }
  }
}`

export default function LandingPage() {
  // Single-instance fade-up targets (the multi-instance ones are wrapped above)
  const mcpPanelRef = useFadeInOnScroll<HTMLDivElement>(200)
  const ctaCardRef = useFadeInOnScroll<HTMLDivElement>(0)

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="landing-section landing-hero">
        <div className="landing-hero-content">
          <p className="landing-eyebrow">Knowledge base · AI-native</p>
          <h1 className="landing-hero-title">
            The knowledge base<br />
            <span className="landing-hero-title-gradient">your AI can use.</span>
          </h1>
          <p className="landing-hero-sub">
            Write and organize everything your team knows. Then let any AI agent —
            in the app, or your own — read it, search it, and write back.
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
            Everything your team knows, in one place
          </h2>
          <div className="landing-feature-grid">
            {features.map((f, i) => (
              <FadeInFeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bring your own AI (MCP) ────────────────────────── */}
      <section className="landing-section landing-ai">
        <div className="landing-inner">
          <p className="landing-eyebrow">Bring your own AI</p>
          <h2 className="landing-section-title landing-section-title--narrow">
            Reachable from the tools you already use
          </h2>
          <div className="landing-ai-grid">
            {/* Point list */}
            <div className="landing-ai-list">
              {mcpPoints.map((point, i) => (
                <FadeInMcpPoint key={point.label} point={point} index={i} />
              ))}
            </div>

            {/* Visual panel — the one-paste connection config */}
            <div ref={mcpPanelRef} className="landing-mcp-panel fade-up">
              <div className="landing-mcp-window">
                <div className="landing-mcp-bar">
                  <span className="kb-chrome-dot kb-chrome-dot--red" />
                  <span className="kb-chrome-dot kb-chrome-dot--yellow" />
                  <span className="kb-chrome-dot kb-chrome-dot--green" />
                  <span className="landing-mcp-bar-name">claude_desktop_config.json</span>
                </div>
                <pre className="landing-mcp-code">{MCP_CONFIG_SNIPPET}</pre>
              </div>
              <div className="landing-mcp-status">
                <span className="landing-mcp-status-dot" />
                Connected · 9 tools available
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="landing-section landing-cta">
        <div className="landing-inner">
          <div ref={ctaCardRef} className="landing-cta-card fade-up">
            <h2 className="landing-cta-title">Your knowledge, ready for AI</h2>
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
