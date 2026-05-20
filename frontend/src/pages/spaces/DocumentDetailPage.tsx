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
import Lightbox from '@/components/ui/Lightbox'
import { useToast, useConfirm } from '@/components/feedback'
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton'
import './DocumentDetail.css'

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

export default function DocumentDetailPage() {
  const { id, docId } = useParams<{ id: string; docId: string }>()
  const spaceId    = Number(id)
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

  // Lightbox for image attachments.
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex]   = useState(0)
  const [lightboxOpen, setLightboxOpen]     = useState(false)

  useEffect(() => {
    setLoading(true)
    getDocument(documentId)
      .then(d => {
        setDoc(d)
        setComments(d.comments)
      })
      .catch(() => {
        toast.error('Failed to load document.')
        navigate(`/spaces/${spaceId}`)
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
      navigate(`/spaces/${spaceId}`)
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

  function openImageLightbox(urls: string[], index: number) {
    setLightboxImages(urls)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  if (loading) return <DocumentDetailSkeleton />
  if (!doc) return null

  const isAuthor         = doc.authorId === userId
  const imageAttachments = doc.attachments.filter(a => isImageMime(a.mimeType))
  const fileAttachments  = doc.attachments.filter(a => !isImageMime(a.mimeType))
  const imageUrls        = imageAttachments.map(a => a.fileUrl)

  return (
    <div className="ddetail-page">

      <PageTopBar
        title={doc.title}
        backTo={`/spaces/${spaceId}`}
        backLabel={doc.spaceName}
        actions={isAuthor ? (
          <>
            <button
              className="ddetail-btn ddetail-btn--topbar"
              onClick={() => navigate(`/spaces/${spaceId}/documents/${documentId}/edit`)}
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

          {/* Attachments — images first as a clickable grid, then other files */}
          {(imageAttachments.length > 0 || fileAttachments.length > 0) && (
            <section className="ddetail-attachments">
              {imageAttachments.length > 0 && (
                <div className="ddetail-img-grid">
                  {imageAttachments.map((a, i) => (
                    <button
                      key={a.id}
                      className="ddetail-img-cell"
                      onClick={() => openImageLightbox(imageUrls, i)}
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={a.fileUrl} alt={a.originalName ?? ''} />
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

          {/* Comments */}
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

        </article>
      </div>

      <Lightbox
        images={lightboxImages}
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
