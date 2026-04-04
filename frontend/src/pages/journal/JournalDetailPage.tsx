import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getEntry, createEntry, editEntry, deleteEntry, deleteImage } from '@/api/journal'
import type { JournalEntry } from '@/types/api'
import Icon from '@/components/ui/Icon'
import './JournalDetail.css'

// ─────────────────────────────────────────────────────────
// JournalDetailPage — handles both create (/journal/new)
// and edit (/journal/:id) in a single component.
// ─────────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id   // /journal/new has no :id param, so id is undefined when creating
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── Form state ────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [entryDate, setEntryDate] = useState(today)

  // ── Photo state ───────────────────────────────────────
  const [existingPhotos, setExistingPhotos] = useState<string[]>([])
  const [pendingFiles, setPendingFiles]     = useState<File[]>([])
  const [lightboxSrc, setLightboxSrc]       = useState<string | null>(null)

  // ── UI state ──────────────────────────────────────────
  const [saveStatus, setSaveStatus]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [loadError, setLoadError]     = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load entry (edit mode) ────────────────────────────
  useEffect(() => {
    if (isNew) {
      // Pre-fill content from writing prompt query param
      const prompt = searchParams.get('prompt')
      if (prompt) setContent(prompt)
      return
    }
    const entryId = Number(id)
    if (!entryId) return

    getEntry(entryId)
      .then((entry: JournalEntry) => {
        setTitle(entry.title)
        setContent(entry.content ?? '')
        setEntryDate(entry.entryDate)
        setExistingPhotos(entry.imagePathList ?? [])
      })
      .catch(() => setLoadError('Failed to load entry.'))
  }, [id, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── File input handler ────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const existingBaseNames = new Set(pendingFiles.map(f => f.name.replace(/\.[^.]+$/, '')))
    const newFiles = files.filter(f => {
      const base = f.name.replace(/\.[^.]+$/, '')
      if (f.type.startsWith('image/') && !existingBaseNames.has(base)) {
        existingBaseNames.add(base)
        return true
      }
      return false
    })
    setPendingFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  // Delete an already-saved photo (immediate API call)
  async function handleDeleteExisting(url: string) {
    if (!window.confirm('Delete this photo?')) return
    try {
      await deleteImage(Number(id), url)
      setExistingPhotos(prev => prev.filter(u => u !== url))
    } catch {
      alert('Failed to delete photo.')
    }
  }

  // Remove a pending (not yet saved) photo
  function handleRemovePending(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  // ── Save / Create ─────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { alert('Title is required.'); return }
    if (!entryDate)    { alert('Date is required.');  return }
    if (!userId) return

    setSaving(true)
    setSaveStatus('')
    try {
      if (isNew) {
        await createEntry(userId, title.trim(), content, entryDate, pendingFiles)
        navigate('/journal', { replace: true })
      } else {
        const updated = await editEntry(Number(id), title.trim(), content, entryDate, pendingFiles)
        setPendingFiles([])
        setExistingPhotos(updated.imagePathList ?? [])
        setSaveStatus('Saved')
        setTimeout(() => setSaveStatus(''), 2500)
      }
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : 'Please try again.'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete entry ──────────────────────────────────────
  async function handleDelete() {
    setMenuOpen(false)
    if (!window.confirm('Delete this entry? This cannot be undone.')) return
    try {
      await deleteEntry(Number(id))
      navigate('/journal', { replace: true })
    } catch {
      alert('Delete failed.')
    }
  }

  const totalPhotos = existingPhotos.length + pendingFiles.length

  if (loadError) {
    return (
      <div className="jdetail-page">
        <div className="jdetail-inner">
          <p style={{ color: 'var(--label-secondary)', fontSize: 15 }}>{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="jdetail-page">
      <div className="jdetail-inner">

        {/* Header */}
        <div className="jdetail-header">
          <NavLink to="/journal" className="jdetail-back">
            <Icon name="arrow-left" size={16} />
            Journal
          </NavLink>
          <div className="jdetail-header-actions">
            {saveStatus && <span className="jdetail-save-status">{saveStatus}</span>}
            {!isNew && (
              <div className="jdetail-menu-wrap" ref={menuRef}>
                <button
                  className="jdetail-menu-trigger"
                  onClick={() => setMenuOpen(v => !v)}
                  aria-label="More options"
                >
                  <Icon name="settings" size={16} />
                </button>
                {menuOpen && (
                  <div className="jdetail-menu-dropdown">
                    <button
                      className="jdetail-menu-item"
                      onClick={() => { setMenuOpen(false); window.print() }}
                    >
                      <Icon name="copy" size={15} />
                      Export / Print
                    </button>
                    <button
                      className="jdetail-menu-item jdetail-menu-item--danger"
                      onClick={handleDelete}
                    >
                      <Icon name="trash" size={15} />
                      Delete entry
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              className="jdetail-btn jdetail-btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : isNew ? 'Create entry' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Writing card */}
        <div className="jdetail-card">
          <textarea
            className="jdetail-title-input"
            rows={1}
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <div className="jdetail-date-row">
            <span className="jdetail-date-display">{formatDisplayDate(entryDate)}</span>
            <input
              type="date"
              className="jdetail-date-input"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
            />
          </div>
          <textarea
            className="jdetail-content-input"
            placeholder="Write your thoughts..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>

        {/* Photos card */}
        <div className="jdetail-photos-card">
          <div className="jdetail-photos-header">
            <span className="jdetail-photos-label">Photos</span>
            {totalPhotos > 0 && (
              <span className="jdetail-photos-count">
                {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="jdetail-photo-grid">
            {/* Existing saved photos */}
            {existingPhotos.map(url => (
              <div key={url} className="jdetail-photo-cell">
                <img src={url} alt="Entry photo" onClick={() => setLightboxSrc(url)} />
                <button
                  className="jdetail-photo-del"
                  onClick={() => handleDeleteExisting(url)}
                  aria-label="Delete photo"
                >
                  &times;
                </button>
              </div>
            ))}

            {/* Pending (not yet saved) photos */}
            {pendingFiles.map((file, i) => (
              <div key={i} className="jdetail-photo-cell jdetail-photo-cell--pending">
                <img src={URL.createObjectURL(file)} alt="Preview" />
                <button
                  className="jdetail-photo-del"
                  onClick={() => handleRemovePending(i)}
                  aria-label="Remove photo"
                >
                  &times;
                </button>
              </div>
            ))}

            {/* Add cell — hidden when at 9 photo limit */}
            {totalPhotos < 9 && (
              <button
                className="jdetail-photo-add"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add photos"
              >
                <Icon name="plus" size={22} />
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="jdetail-lightbox" onClick={() => setLightboxSrc(null)}>
          <button className="jdetail-lightbox-close" onClick={() => setLightboxSrc(null)} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
          <img src={lightboxSrc} alt="Full size" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
