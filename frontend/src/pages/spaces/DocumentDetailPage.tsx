import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/context/AuthContext'
import {
  getDocument, deleteDocument,
  addDocumentComment, deleteDocumentComment,
} from '@/api/documents'
import type { DocumentResponse, DocumentCommentResponse } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import Lightbox, { type LightboxItem } from '@/components/ui/Lightbox'
import { useToast, useConfirm } from '@/components/feedback'
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton'
import './DocumentDetail.css'

// Cloudinary first-frame thumbnail trick for video tiles. Rewriting the
// extension to .jpg with /upload/so_0/ pulls a still from offset 0. No-ops
// for non-Cloudinary URLs so legacy assets still render (just as a black box).
function videoThumbnail(url: string): string {
  return url
    .replace('/upload/', '/upload/so_0/')
    .replace(/\.[a-z0-9]+$/i, '.jpg')
}

// ─────────────────────────────────────────────────────────
// DocumentDetailPage — read-only doc viewer.
// Markdown body, attachment grid, comments thread.
// Author-only Edit/Delete actions in the top bar.
// Editing happens on the (PR 2) edit route, not in-place.
// ─────────────────────────────────────────────────────────

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

function formatBytes(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImageMime(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith('image/')
}

// Videos may be uploaded with a mime type from the browser (preferred) or,
// for legacy backfilled rows, with a NULL mime — fall back to the Cloudinary
// /video/upload/ URL pattern so playback still works there.
function isVideoAttachment(att: { mimeType: string | null; fileUrl: string }): boolean {
  if (att.mimeType && att.mimeType.startsWith('video/')) return true
  return !!att.fileUrl && att.fileUrl.includes('/video/upload/')
}

export default function DocumentDetailPage() {
  // Two URL families lead here:
  //   /journal/:docId                        (personal-space docs)
  //   /spaces/:id/documents/:docId           (team-space docs)
  // The URL :id (when present) is just a hint; doc.spaceId / doc.spacePersonal
  // from the API response are the authoritative source after load.
  const { docId } = useParams<{ docId: string }>()
  const documentId = Number(docId)
  const navigate   = useNavigate()
  const { userId } = useAuth()
  const toast      = useToast()
  const confirm    = useConfirm()

  const [doc, setDoc]         = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Comments — local copy so we can append/delete optimistically.
  const [comments, setComments]         = useState<DocumentCommentResponse[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  // Lightbox covers both image and video attachments — images render in place,
  // videos play inside the lightbox via the shared `<video controls>` panel.
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen]   = useState(false)

  useEffect(() => {
    setLoading(true)
    getDocument(documentId)
      .then(d => {
        setDoc(d)
        setComments(d.comments)
      })
      .catch(() => {
        toast.error('Failed to load document.')
        navigate('/spaces')
      })
      .finally(() => setLoading(false))
  }, [documentId])

  async function handleDelete() {
    if (!doc) return
    if (!await confirm({
      title: 'Delete document?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })) return
    try {
      await deleteDocument(documentId)
      // Same destination as the back button — /journal for personal space docs,
      // the team space's detail page otherwise.
      navigate(doc.spacePersonal ? '/journal' : `/spaces/${doc.spaceId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete document.')
    }
  }

  async function handleAddComment() {
    const text = commentInput.trim()
    if (!text) return
    setAddingComment(true)
    try {
      const c = await addDocumentComment(documentId, text)
      setComments(prev => [...prev, c])
      setCommentInput('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add comment.')
    } finally {
      setAddingComment(false)
    }
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await deleteDocumentComment(documentId, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete comment.')
    }
  }

  function openMediaLightbox(items: LightboxItem[], index: number) {
    setLightboxItems(items)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  if (loading) return <DocumentDetailSkeleton />
  if (!doc) return null

  const isAuthor = doc.authorId === userId

  // Build a single ordered list of media (images + videos) so the grid keeps
  // upload order and the lightbox can page through them all. Non-media files
  // (PDFs etc.) split out into the download chip list below.
  const mediaTiles = doc.attachments
    .map(a => {
      if (isImageMime(a.mimeType)) {
        return { att: a, type: 'IMAGE' as const, thumb: a.fileUrl }
      }
      if (isVideoAttachment(a)) {
        return { att: a, type: 'VIDEO' as const, thumb: videoThumbnail(a.fileUrl) }
      }
      return null
    })
    .filter((x): x is { att: typeof doc.attachments[number]; type: 'IMAGE' | 'VIDEO'; thumb: string } => x !== null)
  const fileAttachments = doc.attachments.filter(
    a => !isImageMime(a.mimeType) && !isVideoAttachment(a),
  )
  const lightboxItemsForDoc: LightboxItem[] = mediaTiles.map(m => ({
    type: m.type,
    url:  m.att.fileUrl,
  }))

  // Personal-space docs live under /journal/*; team docs under /spaces/{id}/*.
  // The back button + Edit button + post-delete nav all follow this split.
  const backTo    = doc.spacePersonal ? '/journal'  : `/spaces/${doc.spaceId}`
  const backLabel = doc.spacePersonal ? 'Journal'   : doc.spaceName
  const editPath  = doc.spacePersonal
    ? `/journal/${documentId}/edit`
    : `/spaces/${doc.spaceId}/documents/${documentId}/edit`

  return (
    <div className="ddetail-page">

      <PageTopBar
        title={doc.title}
        backTo={backTo}
        backLabel={backLabel}
        actions={isAuthor ? (
          <>
            <button
              className="ddetail-btn ddetail-btn--topbar"
              onClick={() => navigate(editPath)}
            >
              <Icon name="edit" size={15} />
              <span className="ddetail-btn-label">Edit</span>
            </button>
            <button
              className="ddetail-btn ddetail-btn--topbar ddetail-btn--danger"
              onClick={handleDelete}
            >
              <Icon name="trash" size={15} />
              <span className="ddetail-btn-label">Delete</span>
            </button>
          </>
        ) : undefined}
      />

      <div className="ddetail-inner">
        <article className="ddetail-article">

          <header className="ddetail-header">
            <h1 className="ddetail-title">{doc.title}</h1>

            <div className="ddetail-meta">
              <div className="ddetail-avatar">
                {doc.authorAvatar
                  ? <img src={doc.authorAvatar} alt="" />
                  : doc.authorUsername.charAt(0).toUpperCase()
                }
              </div>
              <span className="ddetail-author">@{doc.authorUsername}</span>
              <span className="ddetail-dot">·</span>
              <span className="ddetail-time">{formatTime(doc.createdAt)}</span>
              {doc.updatedAt !== doc.createdAt && (
                <span className="ddetail-edited">(edited)</span>
              )}
              {doc.docType === 'JOURNAL' && doc.entryDate && (
                <span className="ddetail-entrydate">
                  <Icon name="calendar" size={12} />
                  {doc.entryDate}
                </span>
              )}
            </div>

            {doc.tags.length > 0 && (
              <div className="ddetail-tags">
                {doc.tags.map(tag => (
                  <span key={tag} className="ddetail-tag">#{tag}</span>
                ))}
              </div>
            )}
          </header>

          {/* Markdown body */}
          <div className="ddetail-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.content}
            </ReactMarkdown>
          </div>

          {/* Attachments — unified square-tile grid for images + videos
              (videos show first-frame thumb with play overlay; click opens
              the lightbox), then any remaining files as download chips. */}
          {(mediaTiles.length > 0 || fileAttachments.length > 0) && (
            <section className="ddetail-attachments">
              {mediaTiles.length > 0 && (
                <div className="ddetail-img-grid">
                  {mediaTiles.map((m, i) => (
                    <button
                      key={m.att.id}
                      className="ddetail-img-cell"
                      onClick={() => openMediaLightbox(lightboxItemsForDoc, i)}
                      aria-label={m.type === 'VIDEO'
                        ? `Play video ${i + 1}`
                        : `View image ${i + 1}`}
                    >
                      <img src={m.thumb} alt={m.att.originalName ?? ''} />
                      {m.type === 'VIDEO' && (
                        <span className="ddetail-img-play" aria-hidden="true">
                          <Icon name="video" size={18} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {fileAttachments.length > 0 && (
                <ul className="ddetail-files">
                  {fileAttachments.map(a => (
                    <li key={a.id} className="ddetail-file">
                      <Icon name="link" size={16} />
                      <a
                        className="ddetail-file-link"
                        href={a.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {a.originalName || 'file'}
                      </a>
                      <span className="ddetail-file-meta">{formatBytes(a.sizeBytes)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Comments — only shown on team-space docs. Personal-space docs
              (journal entries) are read by their owner alone, so threading
              a comment input there would be meaningless noise. */}
          {!doc.spacePersonal && (
            <section className="ddetail-comments">
              <h2 className="ddetail-comments-title">
                {comments.length > 0
                  ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}`
                  : 'Comments'}
              </h2>

              {comments.length === 0 ? (
                <p className="ddetail-comments-empty">No comments yet.</p>
              ) : (
                <ul className="ddetail-comment-list">
                  {comments.map(c => (
                    <li key={c.id} className="ddetail-comment">
                      <div className="ddetail-comment-avatar">
                        {c.authorAvatar
                          ? <img src={c.authorAvatar} alt="" />
                          : c.authorUsername.charAt(0).toUpperCase()
                        }
                      </div>
                      <div className="ddetail-comment-body">
                        <div className="ddetail-comment-meta">
                          <span className="ddetail-comment-author">@{c.authorUsername}</span>
                          <span className="ddetail-dot">·</span>
                          <span className="ddetail-comment-time">{formatTime(c.createdAt)}</span>
                        </div>
                        <p className="ddetail-comment-text">{c.content}</p>
                      </div>
                      {c.authorId === userId && (
                        <button
                          className="ddetail-comment-del"
                          onClick={() => handleDeleteComment(c.id)}
                          title="Delete comment"
                        >
                          <Icon name="close" size={11} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="ddetail-comment-add">
                <input
                  className="ddetail-comment-input"
                  type="text"
                  placeholder="Write a comment..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                />
                <button
                  className="ddetail-comment-send"
                  onClick={handleAddComment}
                  disabled={addingComment || !commentInput.trim()}
                >
                  <Icon name="send" size={14} />
                </button>
              </div>
            </section>
          )}

        </article>
      </div>

      <Lightbox
        items={lightboxItems}
        index={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Skeleton — title + meta + a few body lines while loading.
// ─────────────────────────────────────────────────────────
function DocumentDetailSkeleton() {
  return (
    <div className="ddetail-page">
      <div className="ddetail-inner">
        <article className="ddetail-article">
          <Skeleton width="60%" height={32} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
            <SkeletonCircle size={28} />
            <Skeleton width={120} height={12} />
          </div>
          <Skeleton width="100%" height={14} style={{ marginTop: 28 }} />
          <Skeleton width="94%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="88%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
        </article>
      </div>
    </div>
  )
}
