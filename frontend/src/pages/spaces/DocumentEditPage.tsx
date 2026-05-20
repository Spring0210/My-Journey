import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '@/context/AuthContext'
import { getSpaceDetail } from '@/api/spaces'
import { getDocument, createDocument, updateDocument } from '@/api/documents'
import type { DocType } from '@/types/api'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/feedback'
import './DocumentDetail.css'   // reuse .ddetail-content markdown styles for preview
import './DocumentEdit.css'

// ─────────────────────────────────────────────────────────
// DocumentEditPage — create + edit a Document.
// Routes:
//   /spaces/:id/documents/new            → create
//   /spaces/:id/documents/:docId/edit    → edit (author only)
//
// Markdown body uses a Write/Preview tab switch (textarea +
// react-markdown). Tag input is plain comma-separated; tags
// are normalized to lowercase + trimmed + deduped on save.
// Attachment upload is deferred to PR 3.
// ─────────────────────────────────────────────────────────

// Normalize comma-separated tag input into a clean array.
// Lowercase, trim, drop empties, drop duplicates (preserve first-seen order).
function normalizeTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(',')) {
    const t = raw.trim().toLowerCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

const TODAY = new Date().toISOString().split('T')[0]

export default function DocumentEditPage() {
  const { id, docId } = useParams<{ id: string; docId?: string }>()
  const spaceId    = Number(id)
  const documentId = docId ? Number(docId) : null
  const isNew      = !documentId
  const navigate   = useNavigate()
  const { userId } = useAuth()
  const toast      = useToast()

  const back = documentId
    ? `/spaces/${spaceId}/documents/${documentId}`
    : `/spaces/${spaceId}`

  // ── Form state ────────────────────────────────────────
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [docType, setDocType]     = useState<DocType>('NOTE')
  const [entryDate, setEntryDate] = useState(TODAY)
  const [tab, setTab]             = useState<'write' | 'preview'>('write')

  // ── UI state ──────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // ── Load on mount ─────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    if (isNew) {
      // Fetch space to default docType: JOURNAL on personal spaces, NOTE elsewhere.
      getSpaceDetail(spaceId)
        .then(s => setDocType(s.isPersonal ? 'JOURNAL' : 'NOTE'))
        .catch(() => navigate(`/spaces/${spaceId}`))
        .finally(() => setLoading(false))
    } else {
      getDocument(documentId!)
        .then(d => {
          // Author-only edit. Bounce non-authors to the read-only detail view.
          if (d.authorId !== userId) {
            toast.error('You can only edit your own documents.')
            navigate(`/spaces/${spaceId}/documents/${documentId}`)
            return
          }
          setTitle(d.title)
          setContent(d.content)
          setTagsInput(d.tags.join(', '))
          setDocType(d.docType)
          if (d.entryDate) setEntryDate(d.entryDate)
        })
        .catch(() => {
          toast.error('Failed to load document.')
          navigate(`/spaces/${spaceId}`)
        })
        .finally(() => setLoading(false))
    }
  }, [spaceId, documentId])

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (docType === 'JOURNAL' && !entryDate) {
      setError('Entry date is required for journals.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const tags = normalizeTags(tagsInput)
      if (isNew) {
        const created = await createDocument(spaceId, {
          title: title.trim(),
          content,
          docType,
          entryDate: docType === 'JOURNAL' ? entryDate : null,
          tags,
        })
        navigate(`/spaces/${spaceId}/documents/${created.id}`)
      } else {
        await updateDocument(documentId!, {
          title: title.trim(),
          content,
          tags,
        })
        navigate(`/spaces/${spaceId}/documents/${documentId}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <DocumentEditSkeleton />

  return (
    <div className="dedit-page">

      <PageTopBar
        title={isNew ? 'New document' : 'Edit document'}
        backTo={back}
        backLabel="Cancel"
        actions={
          <button
            className="dedit-btn dedit-btn--primary dedit-btn--topbar"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      />

      <div className="dedit-inner">
        <form className="dedit-form" onSubmit={e => e.preventDefault()}>

          {/* Doc type selector — only on /new. /edit cannot change type. */}
          {isNew && (
            <div className="dedit-typeswitch" role="tablist" aria-label="Document type">
              <button
                type="button"
                role="tab"
                aria-selected={docType === 'NOTE'}
                className={docType === 'NOTE' ? 'active' : ''}
                onClick={() => setDocType('NOTE')}
              >
                Note
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={docType === 'JOURNAL'}
                className={docType === 'JOURNAL' ? 'active' : ''}
                onClick={() => setDocType('JOURNAL')}
              >
                Journal
              </button>
            </div>
          )}

          {/* Entry date — only when creating a JOURNAL */}
          {isNew && docType === 'JOURNAL' && (
            <label className="dedit-field">
              <span className="dedit-label">Entry date</span>
              <input
                className="dedit-date-input"
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                max={TODAY}
              />
            </label>
          )}

          {/* Title */}
          <input
            className="dedit-title-input"
            type="text"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={255}
            autoFocus={isNew}
          />

          {/* Tags */}
          <input
            className="dedit-tags-input"
            type="text"
            placeholder="Tags (comma-separated, e.g. work, idea)"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
          />

          {/* Write / Preview tabs */}
          <div className="dedit-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              className={tab === 'write' ? 'active' : ''}
              onClick={() => setTab('write')}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              className={tab === 'preview' ? 'active' : ''}
              onClick={() => setTab('preview')}
            >
              Preview
            </button>
          </div>

          {tab === 'write' ? (
            <textarea
              className="dedit-body"
              placeholder="Write your document in markdown..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          ) : (
            <div className="dedit-preview ddetail-content">
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <p className="dedit-preview-empty">Nothing to preview yet.</p>
              )}
            </div>
          )}

          {error && <p className="dedit-error">{error}</p>}

          <div className="dedit-actions">
            <button type="button" className="dedit-btn" onClick={() => navigate(back)}>
              Cancel
            </button>
            <button
              type="button"
              className="dedit-btn dedit-btn--primary"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Skeleton — title row + a few body lines while the existing
// doc (or just the space metadata) is being fetched.
// ─────────────────────────────────────────────────────────
function DocumentEditSkeleton() {
  return (
    <div className="dedit-page">
      <div className="dedit-inner">
        <div className="dedit-form">
          <Skeleton width={160} height={28} />
          <Skeleton width="80%" height={32} style={{ marginTop: 8 }} />
          <Skeleton width="100%" height={32} style={{ marginTop: 4 }} />
          <Skeleton width="100%" height={14} style={{ marginTop: 20 }} />
          <Skeleton width="94%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="88%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="70%" height={14} style={{ marginTop: 8 }} />
        </div>
      </div>
    </div>
  )
}
