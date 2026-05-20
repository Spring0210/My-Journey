import { useParams, useNavigate } from 'react-router-dom'
import PageTopBar from '@/components/ui/PageTopBar'

// ─────────────────────────────────────────────────────────
// DocumentEditPage — placeholder route reserved by PR 1.
// Full markdown editor + tag input lands in PR 2.
// Routes covered:
//   /spaces/:id/documents/new            — create
//   /spaces/:id/documents/:docId/edit    — edit
// ─────────────────────────────────────────────────────────

export default function DocumentEditPage() {
  const { id, docId } = useParams<{ id: string; docId?: string }>()
  const navigate = useNavigate()
  const spaceId  = Number(id)
  const isNew    = !docId

  const back = docId
    ? `/spaces/${spaceId}/documents/${docId}`
    : `/spaces/${spaceId}`

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh' }}>
      <PageTopBar
        title={isNew ? 'New document' : 'Edit document'}
        backTo={back}
        backLabel="Back"
      />
      <div style={{
        maxWidth: 'var(--content-narrow)',
        margin: '0 auto',
        padding: '40px var(--page-gutter)',
      }}>
        <div style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--separator)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
          textAlign: 'center',
          color: 'var(--label-secondary)',
        }}>
          <h2 style={{ color: 'var(--label-primary)', marginBottom: 8 }}>
            Editor coming in PR 2
          </h2>
          <p style={{ fontSize: 14 }}>
            Markdown editor, tag input, and create/edit flow land in the next pull request.
          </p>
          <button
            onClick={() => navigate(back)}
            style={{
              marginTop: 20,
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
