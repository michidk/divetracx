import { Link, useRouter } from '@tanstack/react-router'
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  Clipboard,
  KeyRound,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { SaveButton, useTransientSavedState } from '@/components/save-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { MCP_SCOPE_DETAILS, type McpScope, type McpToolName } from '@/modules/mcp/catalog'
import {
  type getMcpAdminState,
  revokeMcpClientConnection,
  updateMcpPolicy,
} from '@/modules/mcp/server/settings'

type McpAdminState = Awaited<ReturnType<typeof getMcpAdminState>>

function formatTimestamp(value: string) {
  return `${new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))} UTC`
}

function eventLabel(event: string) {
  return event.replaceAll('_', ' ')
}

export function McpSettingsPage({ state }: { state: McpAdminState }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(state.policy.enabled)
  const [disabledTools, setDisabledTools] = useState(
    () => new Set<McpToolName>(state.policy.disabledTools),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { saved, clearSaved, markSaved } = useTransientSavedState()

  const groups = useMemo(
    () =>
      ['Read', 'Create and update', 'Delete'].map((group) => ({
        group,
        tools: state.tools.filter((tool) => tool.group === group),
      })),
    [state.tools],
  )

  function toggleTool(tool: McpToolName, checked: boolean) {
    clearSaved()
    setDisabledTools((current) => {
      const next = new Set(current)
      if (checked) next.delete(tool)
      else next.add(tool)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    clearSaved()
    try {
      await updateMcpPolicy({
        data: { enabled, disabledTools: [...disabledTools] },
      })
      await router.invalidate()
      markSaved()
      setMessage('MCP access settings saved. New requests use them immediately.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Saving MCP settings failed')
    } finally {
      setSaving(false)
    }
  }

  async function revoke(clientId: string, name: string) {
    if (
      !window.confirm(
        `Revoke MCP access for “${name}”? Its tokens will stop working immediately.`,
      )
    ) {
      return
    }
    setMessage(null)
    try {
      await revokeMcpClientConnection({ data: { clientId } })
      await router.invalidate()
      setMessage(`${name} was revoked.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Revoking the client failed')
    }
  }

  async function copyEndpoint() {
    if (!state.endpoint) return
    await navigator.clipboard.writeText(state.endpoint)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to settings
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">AI access</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Control exactly what connected assistants can read or change through the Model
          Context Protocol. OAuth scopes and per-tool switches are enforced on every
          request.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <Bot className="text-primary" size={22} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Server
              </p>
              <CardTitle className="mt-1">
                {state.configured && enabled
                  ? 'Available'
                  : state.configured
                    ? 'Paused'
                    : 'Not configured'}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <KeyRound className="text-primary" size={22} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Clients
              </p>
              <CardTitle className="mt-1 font-mono">
                {state.clients.filter((client) => !client.revokedAt).length}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <ShieldCheck className="text-primary" size={22} aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Enabled tools
              </p>
              <CardTitle className="mt-1 font-mono">
                {state.tools.length - disabledTools.size}/{state.tools.length}
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Divetracx serves MCP at its own public origin. Use this URL in your AI client;
            no separate MCP service or URL setting is required.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.configurationError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {state.configurationError}
            </p>
          ) : state.endpoint ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-muted px-4 py-3 font-mono text-sm">
                {state.endpoint}
              </code>
              <Button type="button" variant="outline" onClick={() => void copyEndpoint()}>
                {copied ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Clipboard size={16} aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy URL'}
              </Button>
            </div>
          ) : (
            <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground">
              {state.configurationError ??
                'The MCP endpoint could not be derived from this Divetracx URL.'}
            </p>
          )}

          <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border p-4">
            <Checkbox
              className="size-11"
              checked={enabled}
              onCheckedChange={(checked) => {
                clearSaved()
                setEnabled(checked === true)
              }}
              aria-label="Enable MCP access"
            />
            <span>
              <span className="block font-semibold">Enable MCP access</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Pausing rejects protocol and OAuth requests without deleting clients or
                audit history.
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="tools-heading">
        <div className="mb-4">
          <h2 id="tools-heading" className="text-xl font-semibold">
            Available tools
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Disabled tools disappear from MCP discovery. OAuth scopes provide a second,
            client-specific permission boundary.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {groups.map(({ group, tools }) => (
            <Card
              key={group}
              className={cn(group === 'Delete' && 'border-destructive/25')}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{group}</CardTitle>
                  <Badge
                    variant={
                      group === 'Delete'
                        ? 'destructive'
                        : group === 'Read'
                          ? 'accent'
                          : 'outline'
                    }
                  >
                    {MCP_SCOPE_DETAILS[tools[0]?.scope as McpScope]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {tools.map((tool) => (
                    <div key={tool.name} className="flex min-h-16 items-start gap-3 py-3">
                      <Checkbox
                        className="size-11"
                        checked={!disabledTools.has(tool.name)}
                        onCheckedChange={(checked) =>
                          toggleTool(tool.name, checked === true)
                        }
                        aria-label={`Enable ${tool.title}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{tool.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {tool.description}
                        </span>
                        <code className="mt-1 block truncate font-mono text-xs text-primary">
                          {tool.name}
                        </code>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <SaveButton
            type="button"
            saving={saving}
            saved={saved}
            onClick={() => void save()}
          >
            Save AI access
          </SaveButton>
          <p
            aria-live="polite"
            className={cn(
              'text-sm',
              message?.includes('failed') ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
        </div>
      </section>

      <section aria-labelledby="clients-heading">
        <div className="mb-4">
          <h2 id="clients-heading" className="text-xl font-semibold">
            Connected clients
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revoke a client to invalidate all of its access and refresh tokens
            immediately.
          </p>
        </div>
        {state.clients.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No MCP clients have connected yet.
          </Card>
        ) : (
          <div className="space-y-3">
            {state.clients.map((client) => (
              <Card key={client.id} className={cn(client.revokedAt && 'bg-muted/35')}>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{client.name}</p>
                      <Badge variant={client.revokedAt ? 'secondary' : 'accent'}>
                        {client.revokedAt
                          ? 'Revoked'
                          : `${client.activeTokenCount} active token${client.activeTokenCount === 1 ? '' : 's'}`}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Connected {formatTimestamp(client.createdAt)}
                    </p>
                    {client.scopes.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {client.scopes.map((scope) => (
                          <Badge key={scope} variant="outline">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {!client.revokedAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void revoke(client.id, client.name)}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Revoke
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="activity-heading">
        <div className="mb-4 flex items-center gap-2.5">
          <Activity className="text-primary" size={20} aria-hidden="true" />
          <h2 id="activity-heading" className="text-xl font-semibold">
            Recent activity
          </h2>
        </div>
        <Card className="overflow-hidden">
          {state.auditEvents.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No MCP activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3">Tool</th>
                    <th className="px-5 py-3">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.auditEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">
                        {formatTimestamp(event.createdAt)}
                      </td>
                      <td className="px-5 py-3 capitalize">{eventLabel(event.event)}</td>
                      <td className="px-5 py-3 font-mono text-xs">
                        {event.toolName ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            event.outcome === 'success'
                              ? 'accent'
                              : event.outcome === 'denied'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {event.outcome}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
