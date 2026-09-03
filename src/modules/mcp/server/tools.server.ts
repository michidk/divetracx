import '@tanstack/react-start/server-only'

import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { loadDive, loadDives } from '@/modules/dives/server/queries.server'
import { loadStatistics } from '@/modules/dives/server/stats.server'
import { loadSitesOverview } from '@/modules/sites/server/queries.server'

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

export type McpLoaders = {
  loadDives: typeof loadDives
  loadDive: typeof loadDive
  loadStatistics: typeof loadStatistics
  loadSitesOverview: typeof loadSitesOverview
}

const defaultLoaders: McpLoaders = {
  loadDives,
  loadDive,
  loadStatistics,
  loadSitesOverview,
}

export function jsonToolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value,
  }
}

export function createDivetracxMcpServer(loaders: McpLoaders = defaultLoaders) {
  const server = new McpServer(
    { name: 'divetracx', version: '1.0.0' },
    {
      instructions:
        'Read-only access to the owner’s Divetracx dive log. Use search_dives before get_dive when an ID is unknown. Results contain private health, location, profile, and contact information; disclose only what the user requests. Never infer missing measurements. Depths are metres, temperatures Celsius, weights kilograms, pressures bar, and durations seconds.',
    },
  )

  server.registerTool(
    'search_dives',
    {
      title: 'Search dives',
      description:
        'Search the dive log by site, country, date, or dive number. Results are newest first and paginated in groups of 50.',
      inputSchema: z.object({
        query: z
          .string()
          .max(200)
          .default('')
          .describe('Search text; empty lists all dives'),
        page: z.int().min(1).default(1),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ query, page }) => jsonToolResult(await loaders.loadDives(query, page)),
  )

  server.registerTool(
    'get_dive',
    {
      title: 'Get dive details',
      description:
        'Get one dive with its site, buddies, equipment, tanks, sources, and an optionally bounded set of profile samples.',
      inputSchema: z.object({
        dive_id: z.uuid(),
        profile_sample_limit: z.int().min(0).max(1_000).default(0),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ dive_id: diveId, profile_sample_limit: profileSampleLimit }) => {
      const dive = await loaders.loadDive(diveId)
      if (!dive) {
        return {
          content: [{ type: 'text', text: `Dive ${diveId} was not found` }],
          isError: true,
        }
      }

      const { profileSamples, ...details } = dive
      return jsonToolResult({
        ...details,
        profile: {
          totalSamples: profileSamples.length,
          returnedSamples: Math.min(profileSampleLimit, profileSamples.length),
          truncated: profileSampleLimit < profileSamples.length,
          samples: profileSamples.slice(0, profileSampleLimit),
        },
      })
    },
  )

  server.registerTool(
    'list_dive_sites',
    {
      title: 'List dive sites',
      description:
        'List dive sites with coordinates, visit counts, and summary measurements.',
      inputSchema: z.object({
        offset: z.int().min(0).default(0),
        limit: z.int().min(1).max(200).default(100),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ offset, limit }) => {
      const sites = await loaders.loadSitesOverview()
      return jsonToolResult({
        sites: sites.slice(offset, offset + limit),
        total: sites.length,
        offset,
        limit,
        hasMore: offset + limit < sites.length,
      })
    },
  )

  server.registerTool(
    'get_diving_statistics',
    {
      title: 'Get diving statistics',
      description:
        'Get aggregate dive statistics and trends without returning every calendar dive.',
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => {
      const { calendarDives: _, ...statistics } = await loaders.loadStatistics()
      return jsonToolResult(statistics)
    },
  )

  return server
}
