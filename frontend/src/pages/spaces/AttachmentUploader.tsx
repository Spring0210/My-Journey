import { useState, useRef, useEffect, useMemo } from 'react'
import { uploadAttachment, deleteAttachment } from '@/api/documents'
import type { DocumentAttachmentResponse } from '@/types/api'
import Icon from '@/components/ui/Icon'
import Lightbox, { type LightboxItem } from '@/components/ui/Lightbox'
import { useToast, useConfirm } from '@/components/feedback'

// ─────────────────────────────────────────────────────────
// AttachmentUploader — drop zone + thumbnail tile grid.
// /new mode (documentId === null): files stage locally; parent
//   uploads them after createDocument resolves.
// /edit mode (documentId set): files upload immediately; tiles
//   show a per-file progress overlay.
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

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/')
}

function isVideoAttachment(att: { mimeType: string | null; fileUrl: string }): boolean {
  if (att.mimeType && att.mimeType.startsWith('video/')) return true
  return !!att.fileUrl && att.fileUrl.includes('/video/upload/')
}

// Cloudinary first-frame trick — same helper used on DocumentDetailPage.
// Rewriting the extension to .jpg with /upload/so_0/ pulls a still from
// offset 0. No-ops for non-Cloudinary URLs so legacy assets still render.
function videoThumbnail(url: string): string {
  return url
    .replace('/upload/', '/upload/so_0/')
    .replace(/\.[a-z0-9]+$/i, '.jpg')
}

// What kind of tile to render for a file: image, video, or generic file.
type TileKind = 'IMAGE' | 'VIDEO' | 'FILE'

function fileKind(file: File): TileKind {
  if (isImageFile(file)) return 'IMAGE'
  if (isVideoFile(file)) return 'VIDEO'
  return 'FILE'
}

function attachmentKind(a: DocumentAttachmentResponse): TileKind {
  if (isImageMime(a.mimeType)) return 'IMAGE'
  if (isVideoAttachment(a))    return 'VIDEO'
  return 'FILE'
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
  const [uploading, setUploading] = useState<Record<string, { name: string; kind: TileKind; previewUrl: string | null }>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  // Lightbox state — opened by clicking any image/video tile.
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen]   = useState(false)

  // Memoize blob URLs for staged image/video previews; revoke on cleanup.
  const stagedPreviews = useMemo(
    () => stagedFiles.map(f => (isImageFile(f) || isVideoFile(f)) ? URL.createObjectURL(f) : null),
    [stagedFiles],
  )
  useEffect(() => {
    return () => {
      stagedPreviews.forEach(url => { if (url) URL.revokeObjectURL(url) })
    }
  }, [stagedPreviews])

  // ── Build the unified media list for the lightbox.
  // Existing media first, then staged media (in display order). Files (PDFs
  // etc.) are excluded from the lightbox and shown as a chip list below.
  const existingMedia = existingAttachments
    .map((a, i) => ({ a, i, kind: attachmentKind(a) }))
    .filter(x => x.kind !== 'FILE')
  const stagedMedia = stagedFiles
    .map((f, i) => ({ f, i, kind: fileKind(f), preview: stagedPreviews[i] }))
    .filter(x => x.kind !== 'FILE' && !!x.preview)

  const lightboxItems: LightboxItem[] = [
    ...existingMedia.map(({ a, kind }) => ({
      type: kind === 'VIDEO' ? 'VIDEO' as const : 'IMAGE' as const,
      url:  a.fileUrl,
    })),
    ...stagedMedia.map(({ kind, preview }) => ({
      type: kind === 'VIDEO' ? 'VIDEO' as const : 'IMAGE' as const,
      url:  preview!,
    })),
  ]

  // File-only chip list (existing + staged), shown beneath the grid.
  const existingFiles = existingAttachments.filter(a => attachmentKind(a) === 'FILE')
  const stagedFileItems = stagedFiles
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => fileKind(f) === 'FILE')

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
      const kind = fileKind(file)
      // Local preview URL so the uploading tile shows the actual image/video
      // thumbnail (not just a generic icon) while the upload is in flight.
      const previewUrl = (kind === 'IMAGE' || kind === 'VIDEO')
        ? URL.createObjectURL(file)
        : null
      setUploading(p => ({ ...p, [key]: { name: file.name, kind, previewUrl } }))
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
        if (previewUrl) URL.revokeObjectURL(previewUrl)
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

  function openLightboxAt(target: number) {
    setLightboxIndex(target)
    setLightboxOpen(true)
  }

  const uploadingKeys = Object.keys(uploading)
  const totalCount = existingAttachments.length + stagedFiles.length + uploadingKeys.length
  const hasAny = totalCount > 0
  // When there's already content, render the dropzone in compact "+ Add" mode
  // so it doesn't dominate the layout; otherwise show the larger empty-state.
  const compactDrop = hasAny

  return (
    <section className="dedit-attach">
      <div className="dedit-attach-head">
        <span className="dedit-label">Attachments</span>
        {hasAny && (
          <span className="dedit-attach-count">
            {totalCount} item{totalCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Media tile grid — images and videos. Click opens the lightbox.
          Files (PDFs etc.) render in the chip list further below. */}
      {(existingMedia.length > 0 || stagedMedia.length > 0 || uploadingKeys.length > 0) && (
        <ul className="dedit-attach-grid">
          {existingMedia.map(({ a, kind }, lbIdx) => (
            <li key={`exist-${a.id}`} className="dedit-attach-tile">
              <button
                type="button"
                className="dedit-attach-tile-btn"
                onClick={() => openLightboxAt(lbIdx)}
                aria-label={kind === 'VIDEO' ? 'Play video' : 'Open image'}
              >
                <img
                  src={kind === 'VIDEO' ? videoThumbnail(a.fileUrl) : a.fileUrl}
                  alt={a.originalName ?? ''}
                />
                {kind === 'VIDEO' && (
                  <span className="dedit-attach-tile-play" aria-hidden="true">
                    <Icon name="video" size={18} />
                  </span>
                )}
              </button>
              <button
                type="button"
                className="dedit-attach-tile-x"
                onClick={() => removeExisting(a)}
                aria-label={`Remove ${a.originalName ?? 'attachment'}`}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}

          {stagedMedia.map(({ i, kind, preview }, mediaIdx) => {
            // Staged media follow existing media in the lightbox ordering.
            const lbIdx = existingMedia.length + mediaIdx
            return (
              <li key={`staged-${i}`} className="dedit-attach-tile dedit-attach-tile--staged">
                <button
                  type="button"
                  className="dedit-attach-tile-btn"
                  onClick={() => openLightboxAt(lbIdx)}
                  aria-label={kind === 'VIDEO' ? 'Preview video' : 'Preview image'}
                >
                  <img src={preview!} alt="" />
                  {kind === 'VIDEO' && (
                    <span className="dedit-attach-tile-play" aria-hidden="true">
                      <Icon name="video" size={18} />
                    </span>
                  )}
                  <span className="dedit-attach-tile-badge">Pending</span>
                </button>
                <button
                  type="button"
                  className="dedit-attach-tile-x"
                  onClick={() => removeStaged(i)}
                  aria-label="Remove file"
                >
                  <Icon name="close" size={12} />
                </button>
              </li>
            )
          })}

          {uploadingKeys.map(key => {
            const u = uploading[key]
            const pct = progress[key] ?? 0
            return (
              <li key={`up-${key}`} className="dedit-attach-tile dedit-attach-tile--uploading">
                <div className="dedit-attach-tile-btn" aria-label={`Uploading ${u.name}`}>
                  {u.previewUrl ? (
                    <img src={u.previewUrl} alt="" />
                  ) : (
                    <div className="dedit-attach-tile-file-fill">
                      <Icon name="link" size={22} />
                    </div>
                  )}
                  <span className="dedit-attach-tile-overlay">
                    <span className="dedit-attach-tile-ring" style={{ ['--pct' as string]: pct }} />
                    <span className="dedit-attach-tile-pct">{pct}%</span>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Non-media files — keep the compact one-line chip layout. */}
      {(existingFiles.length > 0 || stagedFileItems.length > 0) && (
        <ul className="dedit-attach-files">
          {existingFiles.map(a => (
            <li key={`f-${a.id}`} className="dedit-attach-file">
              <Icon name="link" size={15} />
              <a
                className="dedit-attach-file-link"
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {a.originalName || 'file'}
              </a>
              <span className="dedit-attach-file-size">{formatBytes(a.sizeBytes)}</span>
              <button
                type="button"
                className="dedit-attach-file-x"
                onClick={() => removeExisting(a)}
                aria-label={`Remove ${a.originalName ?? 'file'}`}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
          {stagedFileItems.map(({ f, i }) => (
            <li key={`sf-${i}`} className="dedit-attach-file dedit-attach-file--staged">
              <Icon name="link" size={15} />
              <span className="dedit-attach-file-link">{f.name}</span>
              <span className="dedit-attach-file-size">{formatBytes(f.size)} · pending</span>
              <button
                type="button"
                className="dedit-attach-file-x"
                onClick={() => removeStaged(i)}
                aria-label="Remove file"
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Drop zone — large empty state, compact "+ Add" once content exists. */}
      <label
        className={
          `dedit-dropzone${compactDrop ? ' dedit-dropzone--compact' : ''}` +
          `${dragOver ? ' dedit-dropzone--active' : ''}`
        }
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
        {compactDrop ? (
          <>
            <Icon name="plus" size={15} />
            <span>Add more</span>
          </>
        ) : (
          <>
            <span className="dedit-dropzone-icon">
              <Icon name="plus" size={20} />
            </span>
            <span className="dedit-dropzone-title">Drop files here</span>
            <span className="dedit-dropzone-hint">or click to browse — up to 25 MB each</span>
          </>
        )}
      </label>

      <Lightbox
        items={lightboxItems}
        index={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </section>
  )
}
