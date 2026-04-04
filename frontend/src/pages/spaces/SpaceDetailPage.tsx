import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getSpaceDetail, updateSpace, uploadSpaceCover,
  leaveSpace, deleteSpace, kickMember, generateAiSummary,
  getPosts, createPost, editPost, deletePost,
  addReaction, removeReaction, addComment, deleteComment,
} from '@/api/spaces'
import type { SpaceDetailResponse, PostResponse, MemberInfo } from '@/types/api'
import { useAuth } from '@/context/AuthContext'
import Icon from '@/components/ui/Icon'
import './SpaceDetail.css'

// ─────────────────────────────────────────────────────────
// SpaceDetailPage — full space feed, composer, and sidebar.
// Desktop: two-column (feed + sidebar).
// Mobile: single column, sidebar sections stacked below feed.
// ─────────────────────────────────────────────────────────

// Emoji reactions available on every post
const EMOJIS = ['❤️', '👍', '😂', '🐮', '🥲', '😭', '😮']

// Same gradient palette as SpacesListPage (cycles by space id)
const COVER_GRADIENTS = [
  'var(--gradient-icon-blue)',
  'var(--gradient-icon-purple)',
  'var(--gradient-icon-orange)',
  'var(--gradient-icon-green)',
  'var(--gradient-icon-teal)',
  'var(--gradient-icon-pink)',
  'var(--gradient-icon-indigo)',
]

// Format ISO timestamp to a human-readable relative string
function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function SpaceDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const spaceId  = Number(id)
  const navigate = useNavigate()
  const { userId, username } = useAuth()

  // ── Space & posts ─────────────────────────────────────
  const [space, setSpace]           = useState<SpaceDetailResponse | null>(null)
  const [posts, setPosts]           = useState<PostResponse[]>([])
  const [page, setPage]             = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // ── Composer ──────────────────────────────────────────
  const [content, setContent]           = useState('')
  const [images, setImages]             = useState<File[]>([])
  const [video, setVideo]               = useState<File | null>(null)
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [posting, setPosting]           = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // ── Post editing ──────────────────────────────────────
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editContent, setEditContent]     = useState('')
  const [savingEdit, setSavingEdit]       = useState(false)

  // ── Comments ──────────────────────────────────────────
  // Set of post ids with comment section expanded
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  // Per-post comment input text
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [addingComment, setAddingComment] = useState<number | null>(null)

  // ── Lightbox ──────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex]   = useState(0)
  const [lightboxOpen, setLightboxOpen]     = useState(false)

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

  const [inviteCopied, setInviteCopied] = useState(false)

  const isOwner = space?.ownerUsername === username

  // ── Load space detail + first page of posts ───────────
  useEffect(() => {
    setLoading(true)
    Promise.all([
      getSpaceDetail(spaceId),
      getPosts(spaceId, 0),
    ])
      .then(([spaceData, postsData]) => {
        setSpace(spaceData)
        setPosts(postsData.content)
        setTotalPages(postsData.totalPages)
        setPage(postsData.currentPage)
      })
      .catch(() => navigate('/spaces'))
      .finally(() => setLoading(false))
  }, [spaceId])

  // ── Load next page of posts ───────────────────────────
  async function loadMore() {
    if (loadingMore || page + 1 >= totalPages) return
    setLoadingMore(true)
    try {
      const data = await getPosts(spaceId, page + 1)
      setPosts(prev => [...prev, ...data.content])
      setPage(data.currentPage)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Create post ───────────────────────────────────────
  async function handlePost() {
    if (!content.trim() && images.length === 0 && !video) return
    setPosting(true)
    try {
      const newPost = await createPost(spaceId, content, images, video)
      setPosts(prev => [newPost, ...prev])
      setContent('')
      setImages([])
      setVideo(null)
      setImagePreviews([])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to post.')
    } finally {
      setPosting(false)
    }
  }

  // Select images from file input
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setImages(prev => [...prev, ...files])
    files.forEach(f => {
      const url = URL.createObjectURL(f)
      setImagePreviews(prev => [...prev, url])
    })
    // Reset input so same files can be re-selected if removed
    e.target.value = ''
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setVideo(file)
    e.target.value = ''
  }

  // ── Edit post ─────────────────────────────────────────
  function startEdit(post: PostResponse) {
    setEditingPostId(post.id)
    setEditContent(post.content ?? '')
  }

  async function saveEdit(postId: number) {
    setSavingEdit(true)
    try {
      const updated = await editPost(spaceId, postId, editContent)
      setPosts(prev => prev.map(p => p.id === postId ? updated : p))
      setEditingPostId(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save edit.')
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Delete post ───────────────────────────────────────
  async function handleDeletePost(postId: number) {
    if (!confirm('Delete this post?')) return
    try {
      await deletePost(spaceId, postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete post.')
    }
  }

  // ── Reactions (optimistic update) ─────────────────────
  async function handleReaction(post: PostResponse, emoji: string) {
    const current = post.reactions.myReaction
    // Optimistically update UI before API call
    const newCounts = { ...post.reactions.counts }

    if (current === emoji) {
      // Toggle off: remove the reaction
      newCounts[emoji] = (newCounts[emoji] ?? 1) - 1
      if (newCounts[emoji] <= 0) delete newCounts[emoji]
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, reactions: { counts: newCounts, myReaction: null } }
        : p
      ))
      try {
        const result = await removeReaction(spaceId, post.id)
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: result } : p))
      } catch {
        // Revert on failure
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: post.reactions } : p))
      }
    } else {
      // Switch or add reaction
      if (current) {
        // Remove old
        newCounts[current] = (newCounts[current] ?? 1) - 1
        if (newCounts[current] <= 0) delete newCounts[current]
      }
      newCounts[emoji] = (newCounts[emoji] ?? 0) + 1
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, reactions: { counts: newCounts, myReaction: emoji } }
        : p
      ))
      try {
        const result = await addReaction(spaceId, post.id, emoji)
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: result } : p))
      } catch {
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: post.reactions } : p))
      }
    }
  }

  // ── Comments ──────────────────────────────────────────
  function toggleComments(postId: number) {
    setExpandedComments(prev => {
      const next = new Set(prev)
      next.has(postId) ? next.delete(postId) : next.add(postId)
      return next
    })
  }

  async function handleAddComment(postId: number) {
    const text = (commentInputs[postId] ?? '').trim()
    if (!text) return
    setAddingComment(postId)
    try {
      const comment = await addComment(spaceId, postId, text)
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments: [...p.comments, comment] }
        : p
      ))
      setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add comment.')
    } finally {
      setAddingComment(null)
    }
  }

  async function handleDeleteComment(postId: number, commentId: number) {
    try {
      await deleteComment(spaceId, postId, commentId)
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments: p.comments.filter(c => c.id !== commentId) }
        : p
      ))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete comment.')
    }
  }

  // ── Lightbox ──────────────────────────────────────────
  function openLightbox(images: string[], index: number) {
    setLightboxImages(images)
    setLightboxIndex(index)
    setLightboxOpen(true)
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
    if (!confirm(`Remove ${member.username} from this space?`)) return
    try {
      await kickMember(spaceId, member.userId)
      setSpace(prev => prev
        ? { ...prev, members: prev.members.filter(m => m.userId !== member.userId) }
        : prev
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove member.')
    }
  }

  // ── Leave space ───────────────────────────────────────
  async function handleLeave() {
    if (!confirm('Leave this space? You can rejoin with an invite code.')) return
    try {
      await leaveSpace(spaceId)
      navigate('/spaces')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to leave space.')
    }
  }

  // ── Delete space ──────────────────────────────────────
  async function handleDelete() {
    if (!confirm('Delete this space permanently? All posts will be lost.')) return
    try {
      await deleteSpace(spaceId)
      navigate('/spaces')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete space.')
    }
  }

  if (loading) {
    return <div className="sdetail-loading">Loading...</div>
  }

  if (!space) return null

  const coverStyle = space.coverImage
    ? { backgroundImage: `url(${space.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: COVER_GRADIENTS[space.id % COVER_GRADIENTS.length] }

  return (
    <div className="sdetail-page">

      {/* ── Desktop sticky top bar ─────────────────────── */}
      <header className="sdetail-topbar">
        <div className="sdetail-topbar-inner">
          <div className="sdetail-topbar-left">
            <button className="sdetail-back-btn" onClick={() => navigate('/spaces')}>
              <Icon name="arrow-left" size={16} />
              Spaces
            </button>
            <h1 className="sdetail-topbar-title">{space.name}</h1>
          </div>
          <div className="sdetail-topbar-right">
            {isOwner && (
              <button className="sdetail-btn" onClick={openEditSpace}>
                <Icon name="settings" size={15} />
                Edit Space
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main layout: feed + sidebar ───────────────── */}
      <div className="sdetail-inner">
        <div className="sdetail-body">

          {/* ── Feed column ─────────────────────────────── */}
          <div className="sdetail-feed">

            {/* Post composer */}
            <div className="sdetail-composer">
              <textarea
                className="sdetail-composer-input"
                placeholder="Share a moment with this space..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={3}
              />

              {/* Image preview strip */}
              {imagePreviews.length > 0 && (
                <div className="sdetail-preview-strip">
                  {imagePreviews.map((url, i) => (
                    <div key={i} className="sdetail-preview-item">
                      <img src={url} alt="" className="sdetail-preview-thumb" />
                      <button
                        className="sdetail-preview-remove"
                        onClick={() => removeImage(i)}
                        aria-label="Remove image"
                      >
                        <Icon name="close" size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video preview */}
              {video && (
                <div className="sdetail-video-preview">
                  <Icon name="video" size={14} />
                  <span className="sdetail-video-name">{video.name}</span>
                  <button
                    className="sdetail-preview-remove sdetail-preview-remove--inline"
                    onClick={() => setVideo(null)}
                    aria-label="Remove video"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              )}

              {/* Composer action bar */}
              <div className="sdetail-composer-bar">
                <div className="sdetail-composer-media">
                  {/* Image picker */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageSelect}
                  />
                  <button
                    className="sdetail-media-btn"
                    onClick={() => imageInputRef.current?.click()}
                    title="Add images"
                  >
                    <Icon name="image" size={16} />
                    Photo
                  </button>

                  {/* Video picker — only if no video selected yet */}
                  {!video && (
                    <>
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={handleVideoSelect}
                      />
                      <button
                        className="sdetail-media-btn"
                        onClick={() => videoInputRef.current?.click()}
                        title="Add video"
                      >
                        <Icon name="video" size={16} />
                        Video
                      </button>
                    </>
                  )}
                </div>

                <button
                  className="sdetail-post-btn"
                  onClick={handlePost}
                  disabled={posting || (!content.trim() && images.length === 0 && !video)}
                >
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>

            {/* Posts list */}
            {posts.length === 0 ? (
              <div className="sdetail-empty">No posts yet. Be the first to share!</div>
            ) : (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={userId}
                  isOwner={isOwner}
                  editingPostId={editingPostId}
                  editContent={editContent}
                  savingEdit={savingEdit}
                  expandedComments={expandedComments}
                  commentInputs={commentInputs}
                  addingComment={addingComment}
                  onEdit={startEdit}
                  onCancelEdit={() => setEditingPostId(null)}
                  onSaveEdit={saveEdit}
                  onEditContentChange={setEditContent}
                  onDelete={handleDeletePost}
                  onReaction={handleReaction}
                  onToggleComments={toggleComments}
                  onCommentInputChange={(postId, text) =>
                    setCommentInputs(prev => ({ ...prev, [postId]: text }))
                  }
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onOpenLightbox={openLightbox}
                />
              ))
            )}

            {/* Load more button */}
            {page + 1 < totalPages && (
              <button
                className="sdetail-load-more"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more posts'}
              </button>
            )}
          </div>

          {/* ── Sidebar column ──────────────────────────── */}
          <aside className="sdetail-sidebar">

            {/* Space info card */}
            <div className="sdetail-sidebar-card">
              {/* Compact cover */}
              <div className="sdetail-sb-cover" style={coverStyle}>
                {!space.coverImage && (
                  <span className="sdetail-sb-initial">{space.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="sdetail-sb-info">
                <p className="sdetail-sb-name">{space.name}</p>
                {space.description && (
                  <p className="sdetail-sb-desc">{space.description}</p>
                )}
                <p className="sdetail-sb-meta">Owner: @{space.ownerUsername}</p>
              </div>

              {/* Invite code row */}
              <div className="sdetail-invite-row">
                <span className="sdetail-invite-code">{space.inviteCode}</span>
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

            {/* AI Summary */}
            <div className="sdetail-sidebar-card">
              <div className="sdetail-sb-section-title">
                <Icon name="ai" size={14} />
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

            {/* Members */}
            <div className="sdetail-sidebar-card">
              <div className="sdetail-sb-section-title">
                <Icon name="spaces" size={14} />
                Members ({space.members.length})
              </div>
              <ul className="sdetail-member-list">
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
                    {/* Owner can kick any non-owner member */}
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
            </div>

            {/* Danger zone */}
            <div className="sdetail-sidebar-card sdetail-sidebar-card--danger">
              {isOwner ? (
                <>
                  {!showEditSpace && (
                    <button className="sdetail-btn sdetail-btn--edit" onClick={openEditSpace}>
                      <Icon name="edit" size={14} />
                      Edit Space
                    </button>
                  )}
                  <button className="sdetail-btn sdetail-btn--danger" onClick={handleDelete}>
                    <Icon name="trash" size={14} />
                    Delete Space
                  </button>
                </>
              ) : (
                <button className="sdetail-btn sdetail-btn--danger" onClick={handleLeave}>
                  Leave Space
                </button>
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
                className="sdetail-cover-picker"
                style={coverPreview || space.coverImage
                  ? { backgroundImage: `url(${coverPreview ?? space.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : coverStyle
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

      {/* ── Image Lightbox ──────────────────────────────── */}
      {lightboxOpen && (
        <div className="sdetail-lightbox" onClick={() => setLightboxOpen(false)}>
          <button
            className="sdetail-lightbox-close"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <Icon name="close" size={20} />
          </button>
          {lightboxIndex > 0 && (
            <button
              className="sdetail-lightbox-nav sdetail-lightbox-nav--prev"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => i - 1) }}
              aria-label="Previous image"
            >
              <Icon name="chevron-left" size={24} />
            </button>
          )}
          <img
            src={lightboxImages[lightboxIndex]}
            alt=""
            className="sdetail-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          {lightboxIndex < lightboxImages.length - 1 && (
            <button
              className="sdetail-lightbox-nav sdetail-lightbox-nav--next"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => i + 1) }}
              aria-label="Next image"
            >
              <Icon name="chevron-right" size={24} />
            </button>
          )}
          {lightboxImages.length > 1 && (
            <p className="sdetail-lightbox-counter">
              {lightboxIndex + 1} / {lightboxImages.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PostCard — extracted to keep SpaceDetailPage readable.
// Renders a single post with reactions, editing, and comments.
// ─────────────────────────────────────────────────────────

interface PostCardProps {
  post: PostResponse
  currentUserId: number | null
  isOwner: boolean
  editingPostId: number | null
  editContent: string
  savingEdit: boolean
  expandedComments: Set<number>
  commentInputs: Record<number, string>
  addingComment: number | null
  onEdit: (post: PostResponse) => void
  onCancelEdit: () => void
  onSaveEdit: (postId: number) => void
  onEditContentChange: (text: string) => void
  onDelete: (postId: number) => void
  onReaction: (post: PostResponse, emoji: string) => void
  onToggleComments: (postId: number) => void
  onCommentInputChange: (postId: number, text: string) => void
  onAddComment: (postId: number) => void
  onDeleteComment: (postId: number, commentId: number) => void
  onOpenLightbox: (images: string[], index: number) => void
}

function PostCard({
  post, currentUserId, isOwner,
  editingPostId, editContent, savingEdit,
  expandedComments, commentInputs, addingComment,
  onEdit, onCancelEdit, onSaveEdit, onEditContentChange,
  onDelete, onReaction, onToggleComments,
  onCommentInputChange, onAddComment, onDeleteComment,
  onOpenLightbox,
}: PostCardProps) {
  const isEditing   = editingPostId === post.id
  const commentsOpen = expandedComments.has(post.id)
  const canModify    = post.authorId === currentUserId || isOwner

  // Build image grid layout class
  const imgCount = post.images.length
  const imgClass = imgCount === 1 ? 'sdetail-img-grid--1'
                 : imgCount === 2 ? 'sdetail-img-grid--2'
                 : imgCount === 3 ? 'sdetail-img-grid--3'
                 : 'sdetail-img-grid--4'

  return (
    <article className="sdetail-post">
      {/* Post header: avatar + author + time + actions */}
      <div className="sdetail-post-header">
        <div className="sdetail-post-avatar">
          {post.authorAvatar
            ? <img src={post.authorAvatar} alt="" />
            : post.authorUsername.charAt(0).toUpperCase()
          }
        </div>
        <div className="sdetail-post-meta">
          <span className="sdetail-post-author">@{post.authorUsername}</span>
          <span className="sdetail-post-time">{formatTime(post.createdAt)}</span>
          {post.updatedAt !== post.createdAt && (
            <span className="sdetail-post-edited">(edited)</span>
          )}
        </div>
        {canModify && !isEditing && (
          <div className="sdetail-post-actions">
            {/* Only the author can edit their own post */}
            {post.authorId === currentUserId && (
              <button
                className="sdetail-post-action-btn"
                onClick={() => onEdit(post)}
                title="Edit post"
              >
                <Icon name="edit" size={14} />
              </button>
            )}
            <button
              className="sdetail-post-action-btn sdetail-post-action-btn--danger"
              onClick={() => onDelete(post.id)}
              title="Delete post"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Post body — edit mode or read mode */}
      {isEditing ? (
        <div className="sdetail-edit-area">
          <textarea
            className="sdetail-edit-input"
            value={editContent}
            onChange={e => onEditContentChange(e.target.value)}
            autoFocus
            rows={3}
          />
          <div className="sdetail-edit-btns">
            <button className="sdetail-btn" onClick={onCancelEdit}>Cancel</button>
            <button
              className="sdetail-btn sdetail-btn--accent"
              onClick={() => onSaveEdit(post.id)}
              disabled={savingEdit}
            >
              {savingEdit ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content && (
            <p className="sdetail-post-content">{post.content}</p>
          )}

          {/* Image grid */}
          {post.images.length > 0 && (
            <div className={`sdetail-img-grid ${imgClass}`}>
              {post.images.slice(0, 4).map((url, i) => {
                const isLast  = i === 3
                const hasMore = post.images.length > 4
                return (
                  <button
                    key={i}
                    className="sdetail-img-cell"
                    onClick={() => onOpenLightbox(post.images, i)}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={url} alt="" />
                    {isLast && hasMore && (
                      <div className="sdetail-img-more">+{post.images.length - 4}</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Video */}
          {post.videos.length > 0 && (
            <video
              className="sdetail-post-video"
              src={post.videos[0]}
              controls
              playsInline
            />
          )}
        </>
      )}

      {/* Reaction bar */}
      <div className="sdetail-reactions">
        {EMOJIS.map(emoji => {
          const count = post.reactions.counts[emoji] ?? 0
          const active = post.reactions.myReaction === emoji
          return (
            <button
              key={emoji}
              className={`sdetail-reaction-btn${active ? ' sdetail-reaction-btn--active' : ''}`}
              onClick={() => onReaction(post, emoji)}
            >
              <span>{emoji}</span>
              {count > 0 && <span className="sdetail-reaction-count">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Comments toggle */}
      <button
        className="sdetail-comments-toggle"
        onClick={() => onToggleComments(post.id)}
      >
        <Icon name={commentsOpen ? 'chevron-down' : 'chevron-right'} size={13} />
        {post.comments.length > 0
          ? `${post.comments.length} comment${post.comments.length !== 1 ? 's' : ''}`
          : 'Add a comment'
        }
      </button>

      {/* Comments section */}
      {commentsOpen && (
        <div className="sdetail-comments">
          {post.comments.map(comment => (
            <div key={comment.id} className="sdetail-comment">
              <div className="sdetail-comment-avatar">
                {comment.authorAvatar
                  ? <img src={comment.authorAvatar} alt="" />
                  : comment.authorUsername.charAt(0).toUpperCase()
                }
              </div>
              <div className="sdetail-comment-body">
                <span className="sdetail-comment-author">@{comment.authorUsername}</span>
                <span className="sdetail-comment-text">{comment.content}</span>
              </div>
              {/* Delete comment: author or space owner */}
              {(comment.authorId === currentUserId || isOwner) && (
                <button
                  className="sdetail-comment-del"
                  onClick={() => onDeleteComment(post.id, comment.id)}
                  title="Delete comment"
                >
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
          ))}

          {/* Add comment input */}
          <div className="sdetail-comment-add">
            <input
              className="sdetail-comment-input"
              type="text"
              placeholder="Write a comment..."
              value={commentInputs[post.id] ?? ''}
              onChange={e => onCommentInputChange(post.id, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAddComment(post.id)}
            />
            <button
              className="sdetail-comment-send"
              onClick={() => onAddComment(post.id)}
              disabled={addingComment === post.id || !(commentInputs[post.id] ?? '').trim()}
            >
              <Icon name="send" size={14} />
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
