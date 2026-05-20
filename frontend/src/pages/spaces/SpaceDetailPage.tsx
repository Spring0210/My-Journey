import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getSpaceDetail, updateSpace, uploadSpaceCover,
  leaveSpace, deleteSpace, kickMember, generateAiSummary,
} from '@/api/spaces'
import { listDocuments } from '@/api/documents'
import type {
  SpaceDetailResponse, MemberInfo, DocumentSummaryResponse,
} from '@/types/api'
import { useAuth } from '@/context/AuthContext'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { useToast, useConfirm } from '@/components/feedback'
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton'
import { formatRelativeTime, formatEntryDate, stripMarkdown } from './docCardUtils'
import './SpaceDetail.css'

// ─────────────────────────────────────────────────────────
// SpaceDetailPage — space landing page after the team-KB pivot.
// Feed column now lists Documents (unified model) instead of
// the legacy SpacePost timeline. Sidebar (info / members / AI
// summary) and the edit-space modal are unchanged.
// Desktop: two-column (doc list + sidebar).
// Mobile: single column, info opens in a bottom sheet.
// ─────────────────────────────────────────────────────────

// Apple-tinted cover variants — shared palette with SpacesListPage.
// Tint classes (.slist-cover-N) are defined in Spaces.css and adapt to theme.
const COVER_COUNT = 7

// formatRelativeTime / formatEntryDate / stripMarkdown moved to docCardUtils.ts
// for reuse by the /journal list page.

export default function SpaceDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const spaceId  = Number(id)
  const navigate = useNavigate()
  const { username } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  // ── Space & documents ─────────────────────────────────
  const [space, setSpace]           = useState<SpaceDetailResponse | null>(null)
  const [docs, setDocs]             = useState<DocumentSummaryResponse[]>([])
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // ── Sidebar modals ────────────────────────────────────
  const [showEditSpace, setShowEditSpace]   = useState(false)
  const [editName, setEditName]             = useState('')
  const [editDesc, setEditDesc]             = useState('')
  const [editSaving, setEditSaving]         = useState(false)
  const [editError, setEditError]           = useState('')
  const [coverFile, setCoverFile]           = useState<File | null>(null)
  const [coverPreview, setCoverPreview]     = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [aiSummary, setAiSummary]     = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)

  const [inviteCopied, setInviteCopied]     = useState(false)
  const [inviteVisible, setInviteVisible]   = useState(false)

  // Controls info sheet (used on both mobile and desktop)
  const [showInfoSheet, setShowInfoSheet] = useState(false)

  const isOwner = space?.ownerUsername === username

  // ── Load space detail + first page of docs ────────────
  useEffect(() => {
    setLoading(true)
    Promise.all([
      getSpaceDetail(spaceId),
      listDocuments(spaceId, { page: 0 }),
    ])
      .then(([spaceData, docsPage]) => {
        // Personal space is surfaced to users as /journal, not as a Space card.
        // If someone reaches /spaces/{personalId} directly (old bookmark, etc.)
        // redirect into the journal UI before showing the team-space chrome.
        if (spaceData.isPersonal) {
          navigate('/journal', { replace: true })
          return
        }
        setSpace(spaceData)
        setDocs(docsPage.content)
        setTotalPages(docsPage.totalPages)
        setPage(docsPage.currentPage)
      })
      .catch(() => navigate('/spaces'))
      .finally(() => setLoading(false))
  }, [spaceId])

  // ── Load next page of docs ────────────────────────────
  async function loadMore() {
    if (loadingMore || page + 1 >= totalPages) return
    setLoadingMore(true)
    try {
      const data = await listDocuments(spaceId, { page: page + 1 })
      setDocs(prev => [...prev, ...data.content])
      setPage(data.currentPage)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Edit space ────────────────────────────────────────
  function openEditSpace() {
    if (!space) return
    setEditName(space.name)
    setEditDesc(space.description ?? '')
    setEditError('')
    setCoverFile(null)
    setCoverPreview(null)
    setShowEditSpace(true)
  }

  async function handleSaveSpace() {
    if (!editName.trim()) { setEditError('Name is required.'); return }
    setEditSaving(true)
    setEditError('')
    try {
      await updateSpace(spaceId, editName.trim(), editDesc.trim())
      // If a new cover was selected, upload it
      if (coverFile) {
        await uploadSpaceCover(spaceId, coverFile)
      }
      // Refresh space detail to get updated cover URL
      const fresh = await getSpaceDetail(spaceId)
      setSpace(fresh)
      setShowEditSpace(false)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to save changes.')
    } finally {
      setEditSaving(false)
    }
  }

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  // ── AI summary ────────────────────────────────────────
  async function handleAiSummary() {
    setAiLoading(true)
    setShowAiPanel(true)
    setAiSummary('')
    try {
      const result = await generateAiSummary(spaceId)
      setAiSummary(result.summary)
    } catch (e) {
      setAiSummary(e instanceof Error ? e.message : 'Failed to generate summary.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Invite code copy ──────────────────────────────────
  function copyInvite() {
    if (!space) return
    navigator.clipboard.writeText(space.inviteCode).then(() => {
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  // ── Kick member ───────────────────────────────────────
  async function handleKick(member: MemberInfo) {
    if (!await confirm({
      title: 'Remove member?',
      message: `${member.username} will be removed from this space.`,
      confirmLabel: 'Remove',
      danger: true,
    })) return
    try {
      await kickMember(spaceId, member.userId)
      setSpace(prev => prev
        ? { ...prev, members: prev.members.filter(m => m.userId !== member.userId) }
        : prev
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove member.')
    }
  }

  // ── Leave space ───────────────────────────────────────
  async function handleLeave() {
    if (!await confirm({
      title: 'Leave space?',
      message: 'You can rejoin later with an invite code.',
      confirmLabel: 'Leave',
      danger: true,
    })) return
    try {
      await leaveSpace(spaceId)
      navigate('/spaces')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to leave space.')
    }
  }

  // ── Delete space ──────────────────────────────────────
  async function handleDelete() {
    if (!await confirm({
      title: 'Delete space?',
      message: 'All documents will be permanently lost. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })) return
    try {
      await deleteSpace(spaceId)
      navigate('/spaces')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete space.')
    }
  }

  if (loading) {
    return <SpaceDetailSkeleton />
  }

  if (!space) return null

  // Cover image overrides tint; otherwise pick a deterministic tint variant by id.
  const coverTintClass = space.coverImage ? '' : ` slist-cover-${(space.id % COVER_COUNT) + 1}`
  const coverImageStyle = space.coverImage
    ? { backgroundImage: `url(${space.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined

  return (
    <div className="sdetail-page">

      <PageTopBar
        title={space.name}
        backTo="/spaces"
        backLabel="Spaces"
        actions={
          <>
            {/* Info button — hidden on desktop, visible on mobile */}
            <button
              className="sdetail-btn sdetail-btn--topbar sdetail-info-toggle"
              onClick={() => setShowInfoSheet(true)}
              aria-label="Space info"
            >
              <Icon name="info" size={15} />
            </button>
            {/* Edit Space — owner only */}
            {isOwner && (
              <button className="sdetail-btn sdetail-btn--topbar" onClick={openEditSpace}>
                <Icon name="settings" size={15} />
                <span className="sdetail-btn-label">Edit Space</span>
              </button>
            )}
            {/* Leave Space — non-owner */}
            {!isOwner && (
              <button className="sdetail-btn sdetail-btn--topbar" onClick={handleLeave}>
                <Icon name="logout" size={15} />
                <span className="sdetail-btn-label">Leave Space</span>
              </button>
            )}
          </>
        }
      />

      {/* ── Main layout: feed + sidebar ───────────────── */}
      <div className="sdetail-inner">
        <div className="sdetail-body">

          {/* ── Feed column — document list ─────────────── */}
          <div className="sdetail-feed">

            <button
              className="sdetail-newdoc-btn"
              onClick={() => navigate(`/spaces/${spaceId}/documents/new`)}
            >
              <Icon name="plus" size={16} />
              New document
            </button>

            {docs.length === 0 ? (
              <div className="sdetail-empty">
                No documents yet. Create the first one!
              </div>
            ) : (
              <div className="sdetail-doc-list">
                {docs.map(doc => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    spaceId={spaceId}
                    onOpen={() => navigate(`/spaces/${spaceId}/documents/${doc.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Load more button */}
            {page + 1 < totalPages && (
              <button
                className="sdetail-load-more"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more documents'}
              </button>
            )}
          </div>

          {/* ── Sidebar column ──────────────────────────── */}
          <aside className="sdetail-sidebar">

            {/* Space info card: banner + description + invite */}
            <div className="sdetail-sidebar-card sdetail-sidebar-card--info">
              {/* Full-width banner with name + member count overlay */}
              <div className={`sdetail-sb-banner${coverTintClass}`} style={coverImageStyle}>
                {!space.coverImage && (
                  <span className="sdetail-sb-initial">{space.name.charAt(0).toUpperCase()}</span>
                )}
                <div className="sdetail-sb-banner-overlay">
                  <p className="sdetail-sb-banner-name">{space.name}</p>
                  <p className="sdetail-sb-banner-count">{space.members.length} members</p>
                </div>
              </div>
              {/* Text info block */}
              <div className="sdetail-sb-info">
                {space.description && (
                  <p className="sdetail-sb-desc">{space.description}</p>
                )}
                <p className="sdetail-sb-owner">Owner @{space.ownerUsername}</p>
              </div>
              {/* Invite code: eye toggle + copy button */}
              <div className="sdetail-invite-row sdetail-invite-row--card">
                <span className="sdetail-invite-code">
                  {inviteVisible ? space.inviteCode : '••••••••••••'}
                </span>
                <button
                  className="sdetail-invite-eye"
                  onClick={() => setInviteVisible(v => !v)}
                  title={inviteVisible ? 'Hide code' : 'Show code'}
                >
                  <Icon name={inviteVisible ? 'eye-off' : 'eye'} size={14} />
                </button>
                <button
                  className="sdetail-invite-copy"
                  onClick={copyInvite}
                  title="Copy invite code"
                >
                  <Icon name={inviteCopied ? 'check' : 'copy'} size={14} />
                  {inviteCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Members card: overlapping avatar stack */}
            <div className="sdetail-sidebar-card">
              <div className="sdetail-sb-section-title">
                <Icon name="spaces" size={13} />
                Members · {space.members.length}
              </div>
              <div className="sdetail-avatar-stack">
                {space.members.slice(0, 6).map(member => (
                  <div
                    key={member.userId}
                    className="sdetail-stack-avatar"
                    title={`@${member.username}`}
                  >
                    {member.avatar
                      ? <img src={member.avatar} alt="" />
                      : member.username.charAt(0).toUpperCase()
                    }
                  </div>
                ))}
                {space.members.length > 6 && (
                  <div className="sdetail-stack-more">+{space.members.length - 6}</div>
                )}
              </div>
            </div>

            {/* AI Summary card */}
            <div className="sdetail-sidebar-card">
              <div className="sdetail-sb-section-title">
                <Icon name="ai" size={13} />
                AI Summary
              </div>
              <button
                className="sdetail-btn sdetail-btn--accent"
                onClick={handleAiSummary}
                disabled={aiLoading}
              >
                {aiLoading ? 'Generating...' : 'Generate summary'}
              </button>
              {showAiPanel && aiSummary && (
                <p className="sdetail-ai-result">{aiSummary}</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Edit Space Modal ────────────────────────────── */}
      {showEditSpace && (
        <div
          className="sdetail-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowEditSpace(false) }}
        >
          <div className="sdetail-modal">
            <div className="sdetail-modal-header">
              <h2 className="sdetail-modal-title">Edit Space</h2>
              <button
                className="sdetail-modal-close"
                onClick={() => setShowEditSpace(false)}
                aria-label="Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="sdetail-modal-body">

              {/* Cover image upload */}
              <label className="sdetail-label">Cover Image</label>
              <div
                className={`sdetail-cover-picker${(coverPreview || space.coverImage) ? '' : coverTintClass}`}
                style={coverPreview || space.coverImage
                  ? { backgroundImage: `url(${coverPreview ?? space.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : undefined
                }
              >
                <button
                  className="sdetail-cover-upload-btn"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Icon name="image" size={14} />
                  Change Cover
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCoverSelect}
                />
              </div>

              <label className="sdetail-label" style={{ marginTop: 16 }}>
                Name <span className="sdetail-required">*</span>
              </label>
              <input
                className="sdetail-modal-input"
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={100}
              />

              <label className="sdetail-label" style={{ marginTop: 14 }}>Description</label>
              <textarea
                className="sdetail-modal-input sdetail-modal-textarea"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
              />

              {editError && <p className="sdetail-error">{editError}</p>}
            </div>
            <div className="sdetail-modal-footer">
              {/* Destructive action left-aligned, separated from Save/Cancel */}
              <button className="sdetail-btn sdetail-btn--danger" onClick={handleDelete}>
                <Icon name="trash" size={14} />
                Delete Space
              </button>
              <div className="sdetail-modal-footer-spacer" />
              <button className="sdetail-btn" onClick={() => setShowEditSpace(false)}>Cancel</button>
              <button
                className="sdetail-btn sdetail-btn--accent"
                onClick={handleSaveSpace}
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Info sheet (mobile bottom sheet / desktop right panel) ── */}
      {showInfoSheet && (
        <div
          className="sdetail-sheet-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowInfoSheet(false) }}
        >
          <div className="sdetail-sheet">
            {/* Banner with drag handle overlaid at top */}
            <div className={`sdetail-sb-banner sdetail-sb-banner--sheet${coverTintClass}`} style={coverImageStyle}>
              {!space.coverImage && (
                <span className="sdetail-sb-initial">{space.name.charAt(0).toUpperCase()}</span>
              )}
              {/* Drag handle sits inside banner on mobile, close button on desktop */}
              <div className="sdetail-sheet-handle" />
              <button
                className="sdetail-sheet-close"
                onClick={() => setShowInfoSheet(false)}
                aria-label="Close"
              >
                <Icon name="close" size={16} />
              </button>
              <div className="sdetail-sb-banner-overlay">
                <p className="sdetail-sb-banner-name">{space.name}</p>
                <p className="sdetail-sb-banner-count">{space.members.length} members</p>
              </div>
            </div>
            {/* Scrollable content */}
            <div className="sdetail-sheet-content">
              {space.description && (
                <p className="sdetail-sb-desc sdetail-sheet-desc">{space.description}</p>
              )}
              <p className="sdetail-sb-owner sdetail-sheet-owner">Owner @{space.ownerUsername}</p>
              {/* Invite code: eye toggle + copy button */}
              <div className="sdetail-invite-row sdetail-sheet-invite">
                <span className="sdetail-invite-code">
                  {inviteVisible ? space.inviteCode : '••••••••••••'}
                </span>
                <button
                  className="sdetail-invite-eye"
                  onClick={() => setInviteVisible(v => !v)}
                  title={inviteVisible ? 'Hide code' : 'Show code'}
                >
                  <Icon name={inviteVisible ? 'eye-off' : 'eye'} size={14} />
                </button>
                <button className="sdetail-invite-copy" onClick={copyInvite} title="Copy invite code">
                  <Icon name={inviteCopied ? 'check' : 'copy'} size={14} />
                  {inviteCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {/* Members */}
              <div className="sdetail-sb-section-title sdetail-sheet-section">
                <Icon name="spaces" size={13} />
                Members · {space.members.length}
              </div>
              <ul className="sdetail-member-list sdetail-sheet-members">
                {space.members.map(member => (
                  <li key={member.userId} className="sdetail-member">
                    <div className="sdetail-member-avatar">
                      {member.avatar
                        ? <img src={member.avatar} alt="" />
                        : member.username.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="sdetail-member-info">
                      <span className="sdetail-member-name">@{member.username}</span>
                      {member.role === 'OWNER' && (
                        <span className="sdetail-member-role">Owner</span>
                      )}
                    </div>
                    {isOwner && member.role !== 'OWNER' && (
                      <button
                        className="sdetail-kick-btn"
                        onClick={() => handleKick(member)}
                        title="Remove member"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {/* AI Summary */}
              <div className="sdetail-sb-section-title sdetail-sheet-section">
                <Icon name="ai" size={13} />
                AI Summary
              </div>
              <button
                className="sdetail-btn sdetail-btn--accent sdetail-sheet-ai-btn"
                onClick={handleAiSummary}
                disabled={aiLoading}
              >
                {aiLoading ? 'Generating...' : 'Generate summary'}
              </button>
              {showAiPanel && aiSummary && (
                <p className="sdetail-ai-result sdetail-sheet-ai-result">{aiSummary}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// DocCard — single document tile in the feed.
// Clicking (or Enter/Space) opens the doc detail page.
// ─────────────────────────────────────────────────────────

interface DocCardProps {
  doc: DocumentSummaryResponse
  spaceId: number
  onOpen: () => void
}

function DocCard({ doc, onOpen }: DocCardProps) {
  // Snippet hits 200 chars in the backend; show "…" if it likely got cut off.
  const cleanSnippet = stripMarkdown(doc.snippet)
  const truncated    = doc.snippet.length >= 200
  // JOURNAL cards show the entry date (the day being journaled about);
  // NOTE cards show relative createdAt (the day the doc was written).
  // Both render in the same meta-row slot for consistent card geometry.
  const dateLabel = doc.docType === 'JOURNAL' && doc.entryDate
    ? formatEntryDate(doc.entryDate)
    : formatRelativeTime(doc.createdAt)
  return (
    <article
      className="sdetail-doc-card"
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <h3 className="sdetail-doc-title">{doc.title}</h3>

      {cleanSnippet && (
        <p className="sdetail-doc-snippet">
          {cleanSnippet}{truncated ? '…' : ''}
        </p>
      )}

      {doc.imageUrls.length > 0 && (
        <div className="sdetail-doc-thumbs">
          {doc.imageUrls.map((url, i) => (
            <div key={i} className="sdetail-doc-thumb">
              <img src={url} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {doc.tags.length > 0 && (
        <div className="sdetail-doc-tags">
          {doc.tags.slice(0, 6).map(t => (
            <span key={t} className="sdetail-doc-tag">#{t}</span>
          ))}
          {doc.tags.length > 6 && (
            <span className="sdetail-doc-tag sdetail-doc-tag--more">
              +{doc.tags.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="sdetail-doc-meta">
        <div className="sdetail-doc-avatar">
          {doc.authorAvatar
            ? <img src={doc.authorAvatar} alt="" />
            : doc.authorUsername.charAt(0).toUpperCase()
          }
        </div>
        <span className="sdetail-doc-author">@{doc.authorUsername}</span>
        <span className="sdetail-doc-dot">·</span>
        <span className="sdetail-doc-time">{dateLabel}</span>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────
// SpaceDetailSkeleton — three doc-card placeholders while
// the space + first page of docs load.
// ─────────────────────────────────────────────────────────
function SpaceDetailSkeleton() {
  return (
    <div className="sdetail-page">
      <div className="sdetail-inner">
        <div style={{ padding: '20px 0' }}>
          <Skeleton width="40%" height={24} />
          <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
        </div>

        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="sdetail-doc-card"
            style={{ pointerEvents: 'none', marginBottom: 12 }}
          >
            <Skeleton width="60%" height={18} />
            <Skeleton width="100%" height={13} style={{ marginTop: 10 }} />
            <Skeleton width="90%" height={13} style={{ marginTop: 6 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
              <SkeletonCircle size={24} />
              <Skeleton width={100} height={11} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
