import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getSpaceDetail } from '@/api/spaces'
import {
  getDocument, createDocument, updateDocument, uploadAttachment,
} from '@/api/documents'
import type { DocType, DocumentAttachmentResponse } from '@/types/api'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/feedback'
import AttachmentUploader from './AttachmentUploader'
import RichEditor from './RichEditor'
import './DocumentDetail.css'   // .ddetail-content typography is shared with the editor
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

  // ── Form state ────────────────────────────────────────
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [docType, setDocType]     = useState<DocType>('NOTE')
  const [entryDate, setEntryDate] = useState(TODAY)
  // Tracks whether this doc's space is the user's personal space. Drives
  // smart back navigation (-> /journal) and post-save / cancel destinations.
  const [isPersonal, setIsPersonal] = useState(false)

  // Cancel / back destination:
  //  - editing existing doc: doc detail (which has its own correct back link)
  //  - creating a new personal-space doc: /journal
  //  - creating a new shared-space doc: /spaces/{id}
  const back = documentId
    ? `/spaces/${spaceId}/documents/${documentId}`
    : (isPersonal ? '/journal' : `/spaces/${spaceId}`)

  // ── Attachments ───────────────────────────────────────
  // /edit mode: pre-filled from doc.attachments, mutated in place by uploader.
  // /new mode:  stays empty; staged files queue uploads after createDocument.
  const [existingAttachments, setExistingAttachments] =
    useState<DocumentAttachmentResponse[]>([])
  const [stagedFiles, setStagedFiles]         = useState<File[]>([])
  const [uploadingStaged, setUploadingStaged] = useState(false)
  const [stagedDoneCount, setStagedDoneCount] = useState(0)

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
        .then(s => {
          setIsPersonal(s.isPersonal)
          setDocType(s.isPersonal ? 'JOURNAL' : 'NOTE')
        })
        .catch(() => navigate('/spaces'))
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
          setIsPersonal(d.spacePersonal)
          if (d.entryDate) setEntryDate(d.entryDate)
          setExistingAttachments(d.attachments)
        })
        .catch(() => {
          toast.error('Failed to load document.')
          navigate('/spaces')
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
      let savedDocId: number

      if (isNew) {
        const created = await createDocument(spaceId, {
          title: title.trim(),
          content,
          docType,
          entryDate: docType === 'JOURNAL' ? entryDate : null,
          tags,
        })
        savedDocId = created.id
      } else {
        await updateDocument(documentId!, {
          title: title.trim(),
          content,
          tags,
        })
        savedDocId = documentId!
      }

      // Upload staged files (only present in /new mode; /edit uploads immediately).
      // Sequential — keeps Cloudinary calls predictable on a 2 GB VPS.
      if (stagedFiles.length > 0) {
        setUploadingStaged(true)
        setStagedDoneCount(0)
        for (const file of stagedFiles) {
          try {
            await uploadAttachment(savedDocId, file)
          } catch {
            // Doc itself is saved; surface a toast per failed file and continue.
            toast.error(`Failed to upload ${file.name}.`)
          }
          setStagedDoneCount(n => n + 1)
        }
      }

      navigate(`/spaces/${spaceId}/documents/${savedDocId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
      setUploadingStaged(false)
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
            disabled={saving || uploadingStaged || !title.trim()}
          >
            {saving
              ? (uploadingStaged ? 'Uploading...' : 'Saving...')
              : 'Save'}
          </button>
        }
      />

      <div className="dedit-inner">
        <form className="dedit-form" onSubmit={e => e.preventDefault()}>

          {/* Entry date — JOURNAL docs only (always present on Personal Space,
              never on shared spaces, since docType is derived from the space). */}
          {docType === 'JOURNAL' && (
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

          {/* Rich body — WYSIWYG that serializes to markdown on every change. */}
          <RichEditor defaultContent={content} onChange={setContent} />

          <AttachmentUploader
            documentId={isNew ? null : documentId}
            existingAttachments={existingAttachments}
            onExistingChange={setExistingAttachments}
            stagedFiles={stagedFiles}
            onStagedChange={setStagedFiles}
          />

          {uploadingStaged && (
            <p className="dedit-staged-progress">
              Uploading attachments... {stagedDoneCount} / {stagedFiles.length}
            </p>
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
              disabled={saving || uploadingStaged || !title.trim()}
            >
              {saving
                ? (uploadingStaged ? 'Uploading...' : 'Saving...')
                : 'Save'}
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
