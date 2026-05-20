import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySpaces, createSpace, joinSpace } from '@/api/spaces'
import type { SpaceSummaryResponse } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import './Spaces.css'

// ─────────────────────────────────────────────────────────
// SpacesListPage — grid of the user's spaces.
// Allows creating a new space or joining one via invite code.
// ─────────────────────────────────────────────────────────

// Number of Apple-tinted cover variants (see .slist-cover-N in Spaces.css).
// Each variant has matched light/dark theme colors. Cycles by space id.
const COVER_COUNT = 7

export default function SpacesListPage() {
  const navigate = useNavigate()

  const [spaces, setSpaces]   = useState<SpaceSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)

  // ── Create modal ──────────────────────────────────────
  const [showCreate, setShowCreate]   = useState(false)
  const [createName, setCreateName]   = useState('')
  const [createDesc, setCreateDesc]   = useState('')
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')

  // ── Join modal ────────────────────────────────────────
  const [showJoin, setShowJoin]       = useState(false)
  const [joinCode, setJoinCode]       = useState('')
  const [joining, setJoining]         = useState(false)
  const [joinError, setJoinError]     = useState('')

  useEffect(() => {
    getMySpaces()
      // Hide the per-user personal space from this list — it's surfaced to
      // users as /journal, not as a "Space" card alongside team spaces.
      .then(all => setSpaces(all.filter(s => !s.isPersonal)))
      .catch(() => setSpaces([]))
      .finally(() => setLoading(false))
  }, [])

  // ── Create a space ────────────────────────────────────
  async function handleCreate() {
    if (!createName.trim()) { setCreateError('Name is required.'); return }
    setCreating(true)
    setCreateError('')
    try {
      const created = await createSpace(createName.trim(), createDesc.trim())
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      navigate(`/spaces/${created.id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create space.')
    } finally {
      setCreating(false)
    }
  }

  // ── Join a space ──────────────────────────────────────
  async function handleJoin() {
    if (!joinCode.trim()) { setJoinError('Enter an invite code.'); return }
    setJoining(true)
    setJoinError('')
    try {
      const joined = await joinSpace(joinCode.trim())
      setShowJoin(false)
      setJoinCode('')
      navigate(`/spaces/${joined.id}`)
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Invalid or expired invite code.')
    } finally {
      setJoining(false)
    }
  }

  function closeCreate() { setShowCreate(false); setCreateName(''); setCreateDesc(''); setCreateError('') }
  function closeJoin()   { setShowJoin(false);   setJoinCode('');                     setJoinError('') }

  return (
    <div className="slist-page">

      <PageTopBar
        title="Spaces"
        actions={
          <>
            <button className="slist-btn slist-btn--topbar" onClick={() => setShowJoin(true)}>
              <Icon name="link" size={15} />
              <span className="slist-btn-label">Join Space</span>
            </button>
            <button className="slist-btn slist-btn--primary slist-btn--topbar" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={15} />
              <span className="slist-btn-label">Create Space</span>
            </button>
          </>
        }
      />

      <div className="slist-inner">

        {/* Content */}
        {loading ? (
          <div className="slist-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="slist-card" style={{ pointerEvents: 'none' }}>
                <Skeleton width="100%" height={140} radius={0} />
                <div className="slist-card-body">
                  <Skeleton width="65%" height={17} />
                  <Skeleton width="90%" height={13} style={{ marginTop: 8 }} />
                  <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="slist-empty">
            <p>You haven't joined any spaces yet.</p>
            <p style={{ marginTop: 8, fontSize: 14, color: 'var(--label-tertiary)' }}>
              Create one or join with an invite code.
            </p>
          </div>
        ) : (
          <div className="slist-grid">
            {spaces.map(space => (
              <button
                key={space.id}
                className="slist-card"
                onClick={() => navigate(`/spaces/${space.id}`)}
              >
                {/* Cover image, or a pastel tint variant chosen by id */}
                <div
                  className={`slist-card-cover${space.coverImage ? '' : ` slist-cover-${(space.id % COVER_COUNT) + 1}`}`}
                  style={space.coverImage
                    ? { backgroundImage: `url(${space.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : undefined
                  }
                >
                  {!space.coverImage && (
                    <span className="slist-card-initial">{space.name.charAt(0).toUpperCase()}</span>
                  )}
                  {/* Role badge */}
                  {space.role === 'OWNER' && (
                    <span className="slist-card-badge">Owner</span>
                  )}
                </div>
                {/* Card body */}
                <div className="slist-card-body">
                  <p className="slist-card-name">{space.name}</p>
                  {space.description && (
                    <p className="slist-card-desc">{space.description}</p>
                  )}
                  <p className="slist-card-owner">@{space.ownerUsername}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Space Modal ─────────────────────────── */}
      {showCreate && (
        <div className="slist-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeCreate() }}>
          <div className="slist-modal">
            <div className="slist-modal-header">
              <h2 className="slist-modal-title">Create Space</h2>
              <button className="slist-modal-close" onClick={closeCreate} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="slist-modal-body">
              <label className="slist-label">Name <span className="slist-required">*</span></label>
              <input
                className="slist-input"
                type="text"
                placeholder="e.g. Family Memories"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                maxLength={100}
                autoFocus
              />
              <label className="slist-label" style={{ marginTop: 14 }}>Description</label>
              <textarea
                className="slist-input slist-textarea"
                placeholder="What is this space for? (optional)"
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                rows={3}
              />
              {createError && <p className="slist-error">{createError}</p>}
            </div>
            <div className="slist-modal-footer">
              <button className="slist-btn" onClick={closeCreate}>Cancel</button>
              <button className="slist-btn slist-btn--primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join Space Modal ───────────────────────────── */}
      {showJoin && (
        <div className="slist-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeJoin() }}>
          <div className="slist-modal">
            <div className="slist-modal-header">
              <h2 className="slist-modal-title">Join a Space</h2>
              <button className="slist-modal-close" onClick={closeJoin} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="slist-modal-body">
              <label className="slist-label">Invite Code</label>
              <input
                className="slist-input"
                type="text"
                placeholder="Enter invite code"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
              {joinError && <p className="slist-error">{joinError}</p>}
            </div>
            <div className="slist-modal-footer">
              <button className="slist-btn" onClick={closeJoin}>Cancel</button>
              <button className="slist-btn slist-btn--primary" onClick={handleJoin} disabled={joining}>
                {joining ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
