import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import Icon from '@/components/ui/Icon'
import './RichEditor.css'

// ─────────────────────────────────────────────────────────
// RichEditor — TipTap-based WYSIWYG editor that serializes
// to markdown on save (via the community tiptap-markdown
// extension). Keeps markdown as the source of truth so the
// AI agent / MCP server can read and write documents.
//
// The component is uncontrolled after mount: parent passes
// `defaultContent` once and receives every change through
// `onChange(markdownString)`. Remount via key to swap docs.
// ─────────────────────────────────────────────────────────

interface RichEditorProps {
  defaultContent: string
  onChange: (markdown: string) => void
}

// Compact inline SVGs — 24x24 viewBox, stroke-based to
// match the rest of the icon set in Icon.tsx.
const ICONS: Record<string, React.ReactNode> = {
  bold: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7Zm0 7h7a3.5 3.5 0 0 1 0 7H7Z" />,
  italic: <path d="M10 5h8M6 19h8M14 5l-4 14" />,
  h1: (
    <>
      <path d="M4 6v12M14 6v12M4 12h10" />
      <path d="M19 18V9l-2 1" />
    </>
  ),
  h2: (
    <>
      <path d="M4 6v12M14 6v12M4 12h10" />
      <path d="M17 11a2.5 2.5 0 0 1 5 0c0 2-5 3-5 7h5" />
    </>
  ),
  h3: (
    <>
      <path d="M4 6v12M12 6v12M4 12h8" />
      <path d="M17 8a2 2 0 1 1 3 2 2 2 0 0 1 0 4 2 2 0 0 1-3 2" />
    </>
  ),
  bullet: <path d="M9 6h12M9 12h12M9 18h12M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  ordered: (
    <>
      <path d="M11 6h10M11 12h10M11 18h10" />
      <path d="M5 6V4H4M5 6H3M4 12h2v-2H4l2-2H4M4 16v2h2v-2c0-1-2-1-2-2v-1h2" />
    </>
  ),
  quote: <path d="M3 21c3-1 4-4 4-7H4V8h6v6c0 4-2 6-7 7Zm11 0c3-1 4-4 4-7h-3V8h6v6c0 4-2 6-7 7Z" />,
  code: <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />,
  undo: <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4" />,
  redo: <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h4" />,
}

function ToolbarSvg({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  )
}

interface BtnProps {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}

function TbBtn({ active, disabled, onClick, title, children }: BtnProps) {
  return (
    <button
      type="button"
      className={`re-tb-btn${active ? ' re-tb-btn--active' : ''}`}
      // Prevent the toolbar button from stealing focus from the editor.
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  function addLink() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="re-toolbar">
      <TbBtn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <ToolbarSvg name="bold" />
      </TbBtn>
      <TbBtn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <ToolbarSvg name="italic" />
      </TbBtn>

      <div className="re-tb-divider" />

      <TbBtn
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <ToolbarSvg name="h1" />
      </TbBtn>
      <TbBtn
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <ToolbarSvg name="h2" />
      </TbBtn>
      <TbBtn
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <ToolbarSvg name="h3" />
      </TbBtn>

      <div className="re-tb-divider" />

      <TbBtn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <ToolbarSvg name="bullet" />
      </TbBtn>
      <TbBtn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ToolbarSvg name="ordered" />
      </TbBtn>

      <div className="re-tb-divider" />

      <TbBtn
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <ToolbarSvg name="quote" />
      </TbBtn>
      <TbBtn
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <ToolbarSvg name="code" />
      </TbBtn>
      <TbBtn
        active={editor.isActive('link')}
        onClick={addLink}
        title="Link"
      >
        <Icon name="link" size={16} />
      </TbBtn>

      <div className="re-tb-divider" />

      <TbBtn
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo (Ctrl+Z)"
      >
        <ToolbarSvg name="undo" />
      </TbBtn>
      <TbBtn
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo (Ctrl+Shift+Z)"
      >
        <ToolbarSvg name="redo" />
      </TbBtn>
    </div>
  )
}

export default function RichEditor({ defaultContent, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      // tiptap-markdown turns the editor into a markdown source of truth:
      // initial content is parsed as markdown, getMarkdown() serializes back.
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: defaultContent,
    onUpdate: ({ editor }) => {
      // tiptap-markdown augments storage with `markdown`, but its TS types
      // aren't picked up reliably; cast through unknown to read the helper.
      const storage = editor.storage as unknown as {
        markdown: { getMarkdown: () => string }
      }
      onChange(storage.markdown.getMarkdown())
    },
    editorProps: {
      attributes: {
        // Reuse the read-view markdown typography so what you write
        // looks like what gets rendered on the detail page.
        class: 'ddetail-content re-editable',
      },
    },
  })

  if (!editor) {
    return <div className="re-loading">Loading editor...</div>
  }

  return (
    <div className="re-wrap">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
