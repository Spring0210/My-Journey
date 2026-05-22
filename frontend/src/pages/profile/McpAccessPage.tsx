import { useEffect, useState } from 'react'
import PageTopBar from '@/components/ui/PageTopBar'
import Icon from '@/components/ui/Icon'
import { useToast } from '@/components/feedback'
import {
  listMcpTokens, createMcpToken, revokeMcpToken, listMcpActivity,
  type McpToken, type McpTokenCreated, type McpAccessLogEntry,
} from '@/api/mcp'
import './Profile.css'

// Profile -> MCP Access.
// Lets a user mint long-lived API tokens for external MCP clients,
// view recent tool calls, and revoke tokens. The raw token is shown
// exactly once -- after the reveal modal is dismissed the value is gone.

export default function McpAccessPage() {
  const toast = useToast()
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [activity, setActivity] = useState<McpAccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate]   = useState(false)
  const [newName, setNewName]         = useState('')
  const [newExpiry, setNewExpiry]     = useState<30 | 90 | 365>(30)
  const [creating, setCreating]       = useState(false)
  const [reveal, setReveal]           = useState<McpTokenCreated | null>(null)
  const [confirmId, setConfirmId]     = useState<number | null>(null)
  const [revoking, setRevoking]       = useState(false)
  const [activeClient, setActiveClient] =
    useState<'desktop' | 'code' | 'test'>('desktop')

  useEffect(() => { void refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([listMcpTokens(), listMcpActivity()])
      setTokens(t); setActivity(a)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const created = await createMcpToken(newName.trim(), newExpiry)
      setReveal(created)
      setShowCreate(false)
      setNewName('')
      setNewExpiry(30)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: number) {
    setRevoking(true)
    try {
      await revokeMcpToken(id)
      setConfirmId(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke')
    } finally {
      setRevoking(false)
    }
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Copy failed - select manually'),
    )
  }

  // Three connection presets shown in the "Connect your client" section.
  // The desktop snippet path is macOS; Windows users open
  // %APPDATA%\Claude\claude_desktop_config.json instead.
  const clientSnippets = {
    desktop: {
      label: 'Claude Desktop',
      hint: 'Paste into ~/Library/Application Support/Claude/claude_desktop_config.json, then restart Claude Desktop.',
      code: JSON.stringify({
        mcpServers: {
          'my-journey': {
            url: 'https://myjourneycloud.com/mcp',
            headers: { Authorization: 'Bearer mj_<your token>' },
          },
        },
      }, null, 2),
    },
    code: {
      label: 'Claude Code',
      hint: 'Run in your terminal. Use --scope user for personal use, or --scope project to share with collaborators (keep the raw token in an env var if so).',
      code: `claude mcp add --transport http my-journey https://myjourneycloud.com/mcp \\
  --header "Authorization: Bearer mj_<your token>" \\
  --scope user`,
    },
    test: {
      label: 'Test',
      hint: 'Quick sanity check after creating a token — should return the available tools.',
      code: `curl -sS https://myjourneycloud.com/mcp \\
  -H "Authorization: Bearer mj_<your token>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    },
  } as const
  const currentSnippet = clientSnippets[activeClient]

  return (
    <div className="prof-page">
      <PageTopBar title="MCP Access" />
      <div className="prof-inner">

        {/* About */}
        <div className="prof-section">
          <p className="prof-section-label">About</p>
          <div className="prof-rows-card" style={{ padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--label-secondary)' }}>
              MCP tokens let external clients like Claude Desktop and Cursor read and write
              your My Journey knowledge base. Tokens carry the same permissions as your
              account - guard them like a password.
            </p>
          </div>
        </div>

        {/* Tokens list */}
        <div className="prof-section">
          <div className="prof-section-header">
            <p className="prof-section-label">Tokens</p>
            <button
              className="prof-btn prof-btn--primary"
              onClick={() => setShowCreate(true)}
            >
              New token
            </button>
          </div>

          <div className="prof-rows-card">
            {loading ? (
              <div className="prof-row">
                <span style={{ color: 'var(--label-tertiary)' }}>Loading...</span>
              </div>
            ) : tokens.length === 0 ? (
              <div className="prof-row">
                <span style={{ color: 'var(--label-tertiary)' }}>
                  No tokens yet. Create one to connect an MCP client.
                </span>
              </div>
            ) : tokens.map(t => (
              <div className="prof-row" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: 'var(--label-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>
                    {t.prefix}... expires {new Date(t.expiredAt).toLocaleDateString()}
                    {t.lastUsedAt
                      ? ` - last used ${new Date(t.lastUsedAt).toLocaleString()}`
                      : ' - never used'}
                  </div>
                </div>
                <button
                  className="prof-btn prof-btn--ghost"
                  onClick={() => setConfirmId(t.id)}
                  aria-label="Revoke token"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Connect your client — Claude Desktop / Claude Code / curl test */}
        <div className="prof-section">
          <p className="prof-section-label">Connect your client</p>
          <div className="prof-rows-card" style={{ padding: '12px 16px' }}>
            <div className="prof-segctl" role="tablist" aria-label="Client type">
              {(['desktop', 'code', 'test'] as const).map(key => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={activeClient === key}
                  className={`prof-segctl-btn${activeClient === key ? ' is-active' : ''}`}
                  onClick={() => setActiveClient(key)}
                >
                  {clientSnippets[key].label}
                </button>
              ))}
            </div>

            <p style={{ margin: '12px 0 8px', fontSize: 13, color: 'var(--label-secondary)' }}>
              {currentSnippet.hint}
            </p>

            <pre style={{
              margin: 0, padding: '10px 12px',
              background: 'var(--surface-secondary)', borderRadius: 8,
              fontSize: 12, overflowX: 'auto',
              color: 'var(--label-primary)',
            }}>{currentSnippet.code}</pre>

            <button
              className="prof-btn prof-btn--ghost"
              style={{ marginTop: 8 }}
              onClick={() => copyToClipboard(currentSnippet.code)}
            >
              <Icon name="copy" size={14} /> Copy snippet
            </button>
          </div>
        </div>

        {/* Recent activity */}
        <div className="prof-section">
          <p className="prof-section-label">Recent activity</p>
          <div className="prof-rows-card">
            {activity.length === 0 ? (
              <div className="prof-row">
                <span style={{ color: 'var(--label-tertiary)' }}>No activity in the last 30 days.</span>
              </div>
            ) : activity.map((a, i) => (
              <div className="prof-row" key={i}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>
                    <span style={{ color: 'var(--label-primary)' }}>{a.toolName}</span>
                    {' - '}
                    <span style={{ color: a.success ? 'var(--system-green)' : 'var(--system-red)' }}>
                      {a.success ? 'ok' : 'error'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>
                    {a.tokenName} ({a.prefix}...) - {new Date(a.calledAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Create token modal */}
      {showCreate && (
        <div className="prof-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="prof-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17 }}>New API token</h3>

            <div className="prof-field">
              <label className="prof-label" htmlFor="mcp-name">Name</label>
              <input
                id="mcp-name"
                className="prof-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Claude Desktop on MacBook"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="prof-field">
              <label className="prof-label" htmlFor="mcp-exp">Expiry</label>
              <select
                id="mcp-exp"
                className="prof-input"
                value={newExpiry}
                onChange={e => setNewExpiry(Number(e.target.value) as 30 | 90 | 365)}
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <div className="prof-pw-actions">
              <button className="prof-btn prof-btn--ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="prof-btn prof-btn--primary"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reveal-once modal */}
      {reveal && (
        <div className="prof-modal-backdrop">
          <div className="prof-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Copy your new token</h3>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)' }}>
              This is the only time you'll see this token. Store it in a password manager
              or your client's config before dismissing this dialog.
            </p>
            <pre style={{
              padding: '10px 12px',
              background: 'var(--surface-secondary)',
              borderRadius: 8, fontSize: 13,
              overflowX: 'auto',
              color: 'var(--label-primary)',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}>{reveal.rawToken}</pre>
            <div className="prof-pw-actions">
              <button
                className="prof-btn prof-btn--ghost"
                onClick={() => copyToClipboard(reveal.rawToken)}
              >
                Copy
              </button>
              <button
                className="prof-btn prof-btn--primary"
                onClick={() => setReveal(null)}
              >
                I've copied it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm revoke */}
      {confirmId !== null && (
        <div className="prof-modal-backdrop" onClick={() => setConfirmId(null)}>
          <div className="prof-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Revoke token?</h3>
            <p style={{ fontSize: 13, color: 'var(--label-secondary)' }}>
              The MCP client using this token will lose access immediately.
            </p>
            <div className="prof-pw-actions">
              <button className="prof-btn prof-btn--ghost" onClick={() => setConfirmId(null)}>
                Cancel
              </button>
              <button
                className="prof-btn prof-btn--primary"
                onClick={() => handleRevoke(confirmId!)}
                disabled={revoking}
              >
                {revoking ? 'Revoking...' : 'Yes, revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
