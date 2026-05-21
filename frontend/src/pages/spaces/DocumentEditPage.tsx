import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getSpaceDetail, getPersonalSpace } from '@/api/spaces'
import {
  getDocument, createDocument, updateDocument, uploadAttachment,
} from '@/api/documents'
import type { DocType, DocumentAttachmentResponse } from '@/types/api'
import Icon from '@/components/ui/Icon'
import PageTopBar from '@/components/ui/PageTopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/feedback'
import AttachmentUploader from './AttachmentUploader'
import RichEditor from './RichEditor'
import TagsInput from './TagsInput'
import './DocumentDetail.css'   // .ddetail-content typography is shared with the editor
import './DocumentEdit.css'

// ─────────────────────────────────────────────────────────
// DocumentEditPage — create + edit a Document.
// Routes:
//   /spaces/:id/documents/new            → create
//   /spaces/:id/documents/:docId/edit    → edit (author only)
//   /journal/new + /journal/:docId/edit  → personal-space variants
//
// docType is *derived* from the target space (JOURNAL for personal,
// NOTE for shared) and is never user-selectable — matches the agent
// invariant. The entry-date row only renders on JOURNAL docs.
// ─────────────────────────────────────────────────────────

// Build a "YYYY-MM-DD" string in the user's local timezone. The naive
// `new Date().toISOString().split('T')[0]` shifts dates around midnight
// for non-UTC users; this avoids that whole class of bug.
function localISODate(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const TODAY = localISODate(new Date())

// Pretty-print "YYYY-MM-DD" for the pill button. Split + construct so the
// parsed Date stays in local time (not parsed-as-UTC then shifted back).
function formatEntryDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DocumentEditPage() {
  // URL shape varies by mount path:
  //   /journal/new                            (id undefined, docId undefined)
  //   /journal/:docId/edit                    (id undefined, docId set)
  //   /spaces/:id/documents/new               (id set,       docId undefined)
  //   /spaces/:id/documents/:docId/edit       (id set,       docId set)
  // The absence of :id is what tells us we're in the personal /journal flow;
  // the corresponding spaceId is resolved by fetching the personal space.
  const params      = useParams<{ id?: string; docId?: string }>()
  const documentId  = params.docId ? Number(params.docId) : null
  const isNew       = !documentId
  const isPersonalRoute = !params.id
  const navigate    = useNavigate()
  const { userId }  = useAuth()
  const toast       = useToast()
  const [searchParams] = useSearchParams()

  // ── Form state ────────────────────────────────────────
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags]       = useState<string[]>([])
  const [docType, setDocType] = useState<DocType>('NOTE')
  const [entryDate, setEntryDate] = useState(TODAY)
  // Tracks whether this doc's space is the user's personal space. Drives
  // smart back navigation (-> /journal) and post-save / cancel destinations.
  const [isPersonal, setIsPersonal] = useState(isPersonalRoute)
  // The doc's owning space. Known from the URL on team routes; resolved
  // asynchronously on personal /new (fetch personal space) and on /edit
  // (read doc.spaceId from the response).
  const [spaceId, setSpaceId] = useState<number | null>(
    params.id ? Number(params.id) : null,
  )

  // Path to the read-only detail view of the doc we're editing (used after
  // save and as the Cancel target in /edit mode).
  const detailPath = (id: number): string =>
    isPersonal ? `/journal/${id}` : `/spaces/${spaceId}/documents/${id}`

  // Cancel / back destination:
  //  - editing existing doc: doc detail (which has its own correct back link)
  //  - creating new: list page for the right side of the personal/team split
  const back = documentId
    ? detailPath(documentId)
    : (isPersonal ? '/journal' : `/spaces/${spaceId ?? ''}`)

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
    // Optional pre-fill from a "?prompt=" query param (writing prompts feature).
    if (isNew) {
      const prompt = searchParams.get('prompt')
      if (prompt) setContent(prompt)
    }
    if (isNew) {
      if (isPersonalRoute) {
        // /journal/new — resolve the user's personal space and default the
        // type to JOURNAL (the only thing that lives there).
        getPersonalSpace()
          .then(s => {
            setSpaceId(s.id)
            setIsPersonal(true)
            setDocType('JOURNAL')
          })
          .catch(() => navigate('/journal'))
          .finally(() => setLoading(false))
      } else {
        // /spaces/:id/documents/new — fetch the team space to confirm
        // membership and pick the default doc type.
        getSpaceDetail(Number(params.id))
          .then(s => {
            setIsPersonal(s.isPersonal)
            setDocType(s.isPersonal ? 'JOURNAL' : 'NOTE')
          })
          .catch(() => navigate('/spaces'))
          .finally(() => setLoading(false))
      }
    } else {
      getDocument(documentId!)
        .then(d => {
          // Author-only edit. Bounce non-authors to the read-only detail view.
          if (d.authorId !== userId) {
            toast.error('You can only edit your own documents.')
            navigate(d.spacePersonal
              ? `/journal/${documentId}`
              : `/spaces/${d.spaceId}/documents/${documentId}`)
            return
          }
          setTitle(d.title)
          setContent(d.content)
          setTags(d.tags)
          setDocType(d.docType)
          setIsPersonal(d.spacePersonal)
          setSpaceId(d.spaceId)
          if (d.entryDate) setEntryDate(d.entryDate)
          setExistingAttachments(d.attachments)
        })
        .catch(() => {
          toast.error('Failed to load document.')
          navigate(isPersonalRoute ? '/journal' : '/spaces')
        })
        .finally(() => setLoading(false))
    }
  }, [params.id, documentId])

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
      let savedDocId: number

      if (isNew) {
        if (spaceId == null) {
          // Defensive — should never hit since we block save until loading
          // finishes (which always sets spaceId).
          throw new Error('Space not resolved')
        }
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

      navigate(detailPath(savedDocId))
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

          {/* Entry date — JOURNAL docs only. The pill button shows the
              formatted date; an absolutely-positioned transparent native
              <input type="date"> fills it so a click anywhere opens the
              platform picker (iOS wheel, macOS popover, etc.). */}
          {docType === 'JOURNAL' && (
            <label className="dedit-date-pill">
              <Icon name="calendar" size={14} />
              <span className="dedit-date-pill-label">
                {formatEntryDate(entryDate)}
              </span>
              <Icon name="chevron-down" size={12} />
              <input
                type="date"
                className="dedit-date-native"
                value={entryDate}
                max={TODAY}
                onChange={e => setEntryDate(e.target.value)}
                aria-label="Entry date"
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

          {/* Tags — chip-style input. Enter / comma commits; backspace on empty
              removes the last chip. */}
          <TagsInput tags={tags} onChange={setTags} placeholder="Add tags…" />

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
