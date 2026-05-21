import { useState, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import Icon from '@/components/ui/Icon'

// ─────────────────────────────────────────────────────────
// TagsInput — chip-style tag editor.
//
// Behavior:
//   • Enter or comma commits the current draft as a new tag.
//   • Backspace on an empty draft removes the last tag.
//   • Click the × on a chip to remove it individually.
//   • Tags are lowercased + trimmed + deduplicated as they're added.
//
// Designed to drop into the document editor in place of the old
// comma-separated text input, while still serializing back to the
// same string-array shape the API expects.
// ─────────────────────────────────────────────────────────

interface TagsInputProps {
  tags: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

function normalize(raw: string): string {
  return raw.trim().toLowerCase()
}

export default function TagsInput({ tags, onChange, placeholder }: TagsInputProps) {
  const [draft, setDraft] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitDraft() {
    const t = normalize(draft)
    if (!t) return
    if (tags.includes(t)) {
      setDraft('')
      return
    }
    onChange([...tags, t])
    setDraft('')
  }

  function removeAt(index: number) {
    onChange(tags.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      // Commit on Enter or comma; comma is the legacy separator users expect.
      e.preventDefault()
      commitDraft()
      return
    }
    if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      // Convenience: empty input + backspace removes the last chip, matching
      // the iMessage / Apple Mail / GitHub tag-input convention.
      e.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    // Allow pasting a comma-separated list and have each entry become a chip.
    const text = e.clipboardData.getData('text')
    if (!text.includes(',')) return
    e.preventDefault()
    const parts = text.split(',').map(normalize).filter(Boolean)
    const seen = new Set(tags)
    const merged = [...tags]
    for (const p of parts) {
      if (!seen.has(p)) {
        merged.push(p)
        seen.add(p)
      }
    }
    onChange(merged)
    setDraft('')
  }

  return (
    <div
      ref={wrapRef}
      className="dedit-tags"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={tag} className="dedit-tag-chip">
          <span className="dedit-tag-hash">#</span>
          {tag}
          <button
            type="button"
            className="dedit-tag-x"
            onClick={(e) => { e.stopPropagation(); removeAt(i) }}
            aria-label={`Remove tag ${tag}`}
          >
            <Icon name="close" size={10} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="dedit-tags-field"
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={commitDraft}
        placeholder={tags.length === 0 ? (placeholder ?? 'Add tags…') : ''}
      />
    </div>
  )
}
