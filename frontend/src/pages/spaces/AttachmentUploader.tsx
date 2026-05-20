import { useState, useRef, useEffect, useMemo } from 'react'
import { uploadAttachment, deleteAttachment } from '@/api/documents'
import type { DocumentAttachmentResponse } from '@/types/api'
import Icon from '@/components/ui/Icon'
import { useToast, useConfirm } from '@/components/feedback'

// ─────────────────────────────────────────────────────────
// AttachmentUploader — drop zone + file list for the editor.
// /new mode (documentId === null): files stage locally; parent
//   uploads them after createDocument resolves.
// /edit mode (documentId set): files upload immediately; chips
//   show per-file progress.
// ─────────────────────────────────────────────────────────

// Client-side cap. Backend will accept larger but Cloudinary's
// free tier (10 MB images / 100 MB videos) and the 2 GB VPS
// mean we want quick "too large" feedback before the request.
const MAX_BYTES = 25 * 1024 * 1024

interface AttachmentUploaderProps {
  documentId: number | null
  existingAttachments: DocumentAttachmentResponse[]
  onExistingChange: (next: DocumentAttachmentResponse[]) => void
  stagedFiles: File[]
  onStagedChange: (next: File[]) => void
}

function formatBytes(b: number | null): string {
  if (b == null) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

export default function AttachmentUploader({
  documentId,
  existingAttachments,
  onExistingChange,
  stagedFiles,
  onStagedChange,
}: AttachmentUploaderProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const [dragOver, setDragOver]   = useState(false)
  // Per-file progress for /edit-mode immediate uploads, keyed by a stable id.
  const [progress, setProgress]   = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState<Record<string, string>>({})  // key → file name
  const inputRef = useRef<HTMLInputElement>(null)

  // Memoize blob URLs for staged image previews; revoke on cleanup.
  const stagedPreviews = useMemo(
    () => stagedFiles.map(f => isImageFile(f) ? URL.createObjectURL(f) : null),
    [stagedFiles],
  )
  useEffect(() => {
    return () => {
      stagedPreviews.forEach(url => { if (url) URL.revokeObjectURL(url) })
    }
  }, [stagedPreviews])

  // Drop oversize files with a friendly toast instead of silently passing them along.
  function filterAcceptable(files: File[]): File[] {
    const ok: File[] = []
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is too large (max 25 MB).`)
      } else {
        ok.push(f)
      }
    }
    return ok
  }

  async function handleFiles(files: File[]) {
    const accepted = filterAcceptable(files)
    if (!accepted.length) return

    if (documentId == null) {
      // /new mode: stage; parent will upload on Save.
      onStagedChange([...stagedFiles, ...accepted])
      return
    }

    // /edit mode: upload each immediately. Sequential to keep the
    // progress UI legible and avoid hammering Cloudinary in parallel.
    for (const file of accepted) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setUploading(p => ({ ...p, [key]: file.name }))
      setProgress(p => ({ ...p, [key]: 0 }))
      try {
        const created = await uploadAttachment(documentId, file, pct =>
          setProgress(p => ({ ...p, [key]: pct })),
        )
        onExistingChange([...existingAttachments, created])
      } catch (e) {
        toast.error(
          e instanceof Error ? `Upload failed: ${e.message}` : `Failed to upload ${file.name}`,
        )
      } finally {
        setUploading(p => { const n = { ...p }; delete n[key]; return n })
        setProgress(p => { const n = { ...p }; delete n[key]; return n })
      }
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''  // allow re-selecting the same file after removing
    if (files.length) handleFiles(files)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) handleFiles(files)
  }

  function removeStaged(index: number) {
    onStagedChange(stagedFiles.filter((_, i) => i !== index))
  }

  async function removeExisting(att: DocumentAttachmentResponse) {
    if (documentId == null) return
    if (!await confirm({
      title: 'Remove attachment?',
      message: `"${att.originalName ?? 'file'}" will be deleted.`,
      confirmLabel: 'Remove',
      danger: true,
    })) return
    try {
      await deleteAttachment(documentId, att.id)
      onExistingChange(existingAttachments.filter(a => a.id !== att.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove attachment.')
    }
  }

  const uploadingKeys = Object.keys(uploading)
  const totalCount = existingAttachments.length + stagedFiles.length
  const showList = totalCount > 0 || uploadingKeys.length > 0

  return (
    <section className="dedit-attach">
      <div className="dedit-attach-head">
        <span className="dedit-label">Attachments</span>
        {showList && (
          <span className="dedit-attach-count">
            {totalCount} item{totalCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {showList && (
        <ul className="dedit-attach-list">
          {existingAttachments.map(a => (
            <li key={`exist-${a.id}`} className="dedit-attach-chip">
              {isImageMime(a.mimeType) ? (
                <img src={a.fileUrl} alt="" className="dedit-attach-thumb" />
              ) : (
                <div className="dedit-attach-icon"><Icon name="link" size={16} /></div>
              )}
              <div className="dedit-attach-meta">
                <span className="dedit-attach-name">{a.originalName ?? 'file'}</span>
                <span className="dedit-attach-size">{formatBytes(a.sizeBytes)}</span>
              </div>
              <button
                type="button"
                className="dedit-attach-remove"
                onClick={() => removeExisting(a)}
                aria-label="Remove attachment"
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}

          {stagedFiles.map((f, i) => (
            <li key={`staged-${i}`} className="dedit-attach-chip dedit-attach-chip--staged">
              {stagedPreviews[i] ? (
                <img src={stagedPreviews[i]!} alt="" className="dedit-attach-thumb" />
              ) : (
                <div className="dedit-attach-icon"><Icon name="link" size={16} /></div>
              )}
              <div className="dedit-attach-meta">
                <span className="dedit-attach-name">{f.name}</span>
                <span className="dedit-attach-size">
                  {formatBytes(f.size)} · pending
                </span>
              </div>
              <button
                type="button"
                className="dedit-attach-remove"
                onClick={() => removeStaged(i)}
                aria-label="Remove file"
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}

          {uploadingKeys.map(key => (
            <li key={`up-${key}`} className="dedit-attach-chip dedit-attach-chip--uploading">
              <div className="dedit-attach-icon"><Icon name="image" size={16} /></div>
              <div className="dedit-attach-meta">
                <span className="dedit-attach-name">{uploading[key]}</span>
                <div className="dedit-attach-bar">
                  <div
                    className="dedit-attach-bar-fill"
                    style={{ width: `${progress[key] ?? 0}%` }}
                  />
                </div>
              </div>
              <span className="dedit-attach-pct">{progress[key] ?? 0}%</span>
            </li>
          ))}
        </ul>
      )}

      <label
        className={`dedit-dropzone${dragOver ? ' dedit-dropzone--active' : ''}`}
        onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
        onDragOver={e  => { e.preventDefault() }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
        <Icon name="plus" size={18} />
        <span>Drag files here or click to upload</span>
        <span className="dedit-dropzone-hint">Up to 25 MB each</span>
      </label>
    </section>
  )
}
