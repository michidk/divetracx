import '@tanstack/react-start/server-only'

import { getRequest } from '@tanstack/react-start/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { mcpAuditEvents, mcpSettings, oauthClients, oauthTokens } from '@/db/schema'
import {
  MCP_TOOL_CATALOG,
  MCP_TOOL_NAMES,
  type McpToolName,
  scopesForEnabledTools,
} from '@/modules/mcp/catalog'
import { getMcpConfig } from './config.server'

export type McpPolicy = {
  enabled: boolean
  disabledTools: McpToolName[]
}

const DEFAULT_POLICY: McpPolicy = { enabled: true, disabledTools: [] }

function knownDisabledTools(values: readonly string[]) {
  const known = new Set<string>(MCP_TOOL_NAMES)
  return values.filter((value): value is McpToolName => known.has(value))
}

export async function loadMcpPolicy(): Promise<McpPolicy> {
  const [row] = await getDb()
    .select({ enabled: mcpSettings.enabled, disabledTools: mcpSettings.disabledTools })
    .from(mcpSettings)
    .where(eq(mcpSettings.id, 'instance'))
    .limit(1)
  return row
    ? { enabled: row.enabled, disabledTools: knownDisabledTools(row.disabledTools) }
    : DEFAULT_POLICY
}

export async function saveMcpPolicy(policy: McpPolicy) {
  const disabledTools = knownDisabledTools(policy.disabledTools)
  const [row] = await getDb()
    .insert(mcpSettings)
    .values({ id: 'instance', enabled: policy.enabled, disabledTools })
    .onConflictDoUpdate({
      target: mcpSettings.id,
      set: { enabled: policy.enabled, disabledTools, updatedAt: new Date() },
    })
    .returning({ enabled: mcpSettings.enabled, disabledTools: mcpSettings.disabledTools })
  return {
    enabled: row?.enabled ?? policy.enabled,
    disabledTools: knownDisabledTools(row?.disabledTools ?? disabledTools),
  }
}

export async function revokeMcpClient(clientId: string) {
  await getDb().transaction(async (transaction) => {
    const [client] = await transaction
      .update(oauthClients)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(oauthClients.id, clientId))
      .returning({ id: oauthClients.id })
    if (!client) throw new Error('The MCP client was not found')
    await transaction
      .update(oauthTokens)
      .set({ revokedAt: new Date() })
      .where(eq(oauthTokens.clientId, clientId))
    await transaction.insert(mcpAuditEvents).values({
      event: 'client_revoked',
      outcome: 'success',
      clientId,
    })
  })
}

export async function loadMcpAdminState() {
  const db = getDb()
  const [policy, clientRows, tokenRows, auditRows] = await Promise.all([
    loadMcpPolicy(),
    db.select().from(oauthClients).orderBy(desc(oauthClients.createdAt)),
    db
      .select({
        clientId: oauthTokens.clientId,
        scopes: oauthTokens.scopes,
        expiresAt: oauthTokens.accessTokenExpiresAt,
        revokedAt: oauthTokens.revokedAt,
      })
      .from(oauthTokens)
      .orderBy(desc(oauthTokens.createdAt)),
    db.select().from(mcpAuditEvents).orderBy(desc(mcpAuditEvents.createdAt)).limit(100),
  ])

  let endpoint: string | null = null
  let configurationError: string | null = null
  try {
    endpoint = getMcpConfig(getRequest()).serverUrl.toString()
  } catch (error) {
    configurationError =
      error instanceof Error ? error.message : 'The MCP environment is invalid'
  }

  const now = new Date()
  const clients = clientRows.map((client) => {
    const tokens = tokenRows.filter((token) => token.clientId === client.id)
    const activeTokens = tokens.filter(
      (token) => !token.revokedAt && token.expiresAt > now,
    )
    return {
      id: client.id,
      name: client.name,
      redirectUris: client.redirectUris,
      revokedAt: client.revokedAt?.toISOString() ?? null,
      createdAt: client.createdAt.toISOString(),
      activeTokenCount: activeTokens.length,
      scopes: [...new Set(activeTokens.flatMap((token) => token.scopes))],
    }
  })

  return {
    configured: endpoint !== null,
    endpoint,
    configurationError,
    policy,
    supportedScopes: scopesForEnabledTools(policy.disabledTools),
    tools: MCP_TOOL_CATALOG.map((tool) => ({ ...tool })),
    clients,
    auditEvents: auditRows.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  }
}
