import '@tanstack/react-start/server-only'

import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  loadBuddiesOverview,
  loadBuddyDetail,
} from '@/modules/buddies/server/queries.server'
import { loadDiveEditor } from '@/modules/dives/server/editor.server'
import { loadDive, loadDives } from '@/modules/dives/server/queries.server'
import { loadStatistics } from '@/modules/dives/server/stats.server'
import { loadGearDetail, loadGearOverview } from '@/modules/gear/server/queries.server'
import {
  MCP_TOOL_CATALOG,
  MCP_TOOL_NAMES,
  type McpScope,
  type McpToolName,
} from '@/modules/mcp/catalog'
import {
  buddyValuesSchema,
  createDiveToolInputSchema,
  gearSetValuesSchema,
  gearValuesSchema,
  profileValuesSchema,
  siteValuesSchema,
  updateDiveToolInputSchema,
} from '@/modules/mcp/tool-inputs'
import { loadProfile } from '@/modules/profile/server/queries.server'
import { loadSiteDetail, loadSitesOverview } from '@/modules/sites/server/queries.server'
import {
  createBuddyFromMcp,
  createDiveFromMcp,
  createGearFromMcp,
  createGearSetFromMcp,
  createSiteFromMcp,
  deleteDiveFromMcp,
  deleteEntityFromMcp,
  deleteGearSetFromMcp,
  updateBuddyFromMcp,
  updateDiveFromMcp,
  updateGearFromMcp,
  updateGearSetFromMcp,
  updateProfileFromMcp,
  updateSiteFromMcp,
} from './write-operations.server'

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const createAnnotations = { ...writeAnnotations, idempotentHint: false } as const
const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const

export type McpLoaders = {
  loadDives: typeof loadDives
  loadDive: typeof loadDive
  loadStatistics: typeof loadStatistics
  loadSitesOverview: typeof loadSitesOverview
  loadSiteDetail: typeof loadSiteDetail
  loadBuddiesOverview: typeof loadBuddiesOverview
  loadBuddyDetail: typeof loadBuddyDetail
  loadGearOverview: typeof loadGearOverview
  loadGearDetail: typeof loadGearDetail
  loadProfile: typeof loadProfile
  loadDiveEditor: typeof loadDiveEditor
  createDive: typeof createDiveFromMcp
  updateDive: typeof updateDiveFromMcp
  createSite: typeof createSiteFromMcp
  updateSite: typeof updateSiteFromMcp
  createBuddy: typeof createBuddyFromMcp
  updateBuddy: typeof updateBuddyFromMcp
  createGear: typeof createGearFromMcp
  updateGear: typeof updateGearFromMcp
  createGearSet: typeof createGearSetFromMcp
  updateGearSet: typeof updateGearSetFromMcp
  updateProfile: typeof updateProfileFromMcp
  deleteDive: typeof deleteDiveFromMcp
  deleteEntity: typeof deleteEntityFromMcp
  deleteGearSet: typeof deleteGearSetFromMcp
}

const defaultLoaders: McpLoaders = {
  loadDives,
  loadDive,
  loadStatistics,
  loadSitesOverview,
  loadSiteDetail,
  loadBuddiesOverview,
  loadBuddyDetail,
  loadGearOverview,
  loadGearDetail,
  loadProfile,
  loadDiveEditor,
  createDive: createDiveFromMcp,
  updateDive: updateDiveFromMcp,
  createSite: createSiteFromMcp,
  updateSite: updateSiteFromMcp,
  createBuddy: createBuddyFromMcp,
  updateBuddy: updateBuddyFromMcp,
  createGear: createGearFromMcp,
  updateGear: updateGearFromMcp,
  createGearSet: createGearSetFromMcp,
  updateGearSet: updateGearSetFromMcp,
  updateProfile: updateProfileFromMcp,
  deleteDive: deleteDiveFromMcp,
  deleteEntity: deleteEntityFromMcp,
  deleteGearSet: deleteGearSetFromMcp,
}

export function jsonToolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value,
  }
}

function errorToolResult(error: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: error instanceof Error ? error.message : 'The MCP operation failed',
      },
    ],
    isError: true,
  }
}

async function writeResult(operation: () => Promise<unknown>) {
  try {
    return jsonToolResult(await operation())
  } catch (error) {
    return errorToolResult(error)
  }
}

export type McpToolAccess = {
  scopes?: readonly McpScope[]
  enabledTools?: readonly McpToolName[]
}

export function createDivetracxMcpServer(
  loaders: McpLoaders = defaultLoaders,
  access: McpToolAccess = {},
) {
  const scopes = new Set<McpScope>(access.scopes ?? ['divetracx:read'])
  const enabledTools = new Set<McpToolName>(access.enabledTools ?? MCP_TOOL_NAMES)
  const allowed = (name: McpToolName) => {
    const tool = MCP_TOOL_CATALOG.find((candidate) => candidate.name === name)
    return Boolean(tool && enabledTools.has(name) && scopes.has(tool.scope))
  }
  const server = new McpServer(
    { name: 'divetracx', version: '1.0.0' },
    {
      instructions:
        'Scoped access to the owner’s Divetracx dive log. Use search and list tools before mutations when an ID is unknown. Update tools are partial and preserve omitted fields; arrays supplied to update_dive replace that relationship list. Results contain private health, location, profile, and contact information; disclose only what the user requests. Never infer missing measurements. Depths are metres, temperatures Celsius, weights kilograms, pressures bar, and durations seconds.',
    },
  )

  if (allowed('search_dives'))
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

  if (allowed('get_dive'))
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

  if (allowed('list_dive_sites'))
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

  if (allowed('get_diving_statistics'))
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

  if (allowed('list_buddies'))
    server.registerTool(
      'list_buddies',
      {
        title: 'List buddies',
        description: 'List buddies with shared-dive counts and last dive dates.',
        inputSchema: z.object({}),
        annotations: readOnlyAnnotations,
      },
      async () => jsonToolResult(await loaders.loadBuddiesOverview()),
    )

  if (allowed('get_buddy'))
    server.registerTool(
      'get_buddy',
      {
        title: 'Get buddy details',
        description: 'Get one buddy with certifications, memberships, and shared dives.',
        inputSchema: z.object({ buddyId: z.string().uuid() }),
        annotations: readOnlyAnnotations,
      },
      async ({ buddyId }) => {
        const buddy = await loaders.loadBuddyDetail(buddyId)
        return buddy
          ? jsonToolResult(buddy)
          : errorToolResult(new Error('Buddy not found'))
      },
    )

  if (allowed('list_gear'))
    server.registerTool(
      'list_gear',
      {
        title: 'List gear',
        description: 'List gear items and reusable gear sets.',
        inputSchema: z.object({}),
        annotations: readOnlyAnnotations,
      },
      async () => jsonToolResult(await loaders.loadGearOverview()),
    )

  if (allowed('get_gear_item'))
    server.registerTool(
      'get_gear_item',
      {
        title: 'Get gear details',
        description: 'Get one gear item with its dive history.',
        inputSchema: z.object({ gearId: z.string().uuid() }),
        annotations: readOnlyAnnotations,
      },
      async ({ gearId }) => {
        const gear = await loaders.loadGearDetail(gearId)
        return gear
          ? jsonToolResult(gear)
          : errorToolResult(new Error('Gear item not found'))
      },
    )

  if (allowed('get_profile'))
    server.registerTool(
      'get_profile',
      {
        title: 'Get diver profile',
        description: 'Get the owner profile, certifications, memberships, and totals.',
        inputSchema: z.object({}),
        annotations: readOnlyAnnotations,
      },
      async () => jsonToolResult(await loaders.loadProfile()),
    )

  if (allowed('get_dive_editor_options'))
    server.registerTool(
      'get_dive_editor_options',
      {
        title: 'Get dive reference data',
        description:
          'Get valid sites, dive operators, boats, dive types, buddies, gear items, and gear sets for creating or updating a dive.',
        inputSchema: z.object({}),
        annotations: readOnlyAnnotations,
      },
      async () => {
        const editor = await loaders.loadDiveEditor(null)
        return jsonToolResult({
          nextNumber: editor?.nextNumber ?? null,
          ...editor?.options,
        })
      },
    )

  if (allowed('create_dive'))
    server.registerTool(
      'create_dive',
      {
        title: 'Create dive',
        description:
          'Create a manual dive. Omitted dive number uses the next number; relationship arrays default to empty.',
        inputSchema: createDiveToolInputSchema,
        annotations: createAnnotations,
      },
      async (input) => writeResult(async () => ({ id: await loaders.createDive(input) })),
    )

  if (allowed('update_dive'))
    server.registerTool(
      'update_dive',
      {
        title: 'Update dive',
        description:
          'Partially update a dive. Omitted fields are preserved; supplied relationship arrays replace their current values.',
        inputSchema: updateDiveToolInputSchema,
        annotations: writeAnnotations,
      },
      async (input) => writeResult(async () => ({ id: await loaders.updateDive(input) })),
    )

  if (allowed('create_dive_site'))
    server.registerTool(
      'create_dive_site',
      {
        title: 'Create dive site',
        description: 'Create a dive site. Name is required.',
        inputSchema: siteValuesSchema.extend({ name: z.string().trim().min(1).max(500) }),
        annotations: createAnnotations,
      },
      async (input) => writeResult(async () => ({ id: await loaders.createSite(input) })),
    )

  if (allowed('update_dive_site'))
    server.registerTool(
      'update_dive_site',
      {
        title: 'Update dive site',
        description: 'Partially update a dive site; omitted fields are preserved.',
        inputSchema: siteValuesSchema.extend({ siteId: z.string().uuid() }),
        annotations: writeAnnotations,
      },
      async ({ siteId, ...input }) =>
        writeResult(async () => ({ id: await loaders.updateSite(siteId, input) })),
    )

  if (allowed('create_buddy'))
    server.registerTool(
      'create_buddy',
      {
        title: 'Create buddy',
        description: 'Create a buddy record.',
        inputSchema: buddyValuesSchema,
        annotations: createAnnotations,
      },
      async (input) =>
        writeResult(async () => ({ id: await loaders.createBuddy(input) })),
    )

  if (allowed('update_buddy'))
    server.registerTool(
      'update_buddy',
      {
        title: 'Update buddy',
        description: 'Partially update a buddy; omitted fields are preserved.',
        inputSchema: buddyValuesSchema.extend({ buddyId: z.string().uuid() }),
        annotations: writeAnnotations,
      },
      async ({ buddyId, ...input }) =>
        writeResult(async () => ({ id: await loaders.updateBuddy(buddyId, input) })),
    )

  if (allowed('create_gear_item'))
    server.registerTool(
      'create_gear_item',
      {
        title: 'Create gear item',
        description: 'Create a gear item. Name is required.',
        inputSchema: gearValuesSchema.extend({ name: z.string().trim().min(1).max(500) }),
        annotations: createAnnotations,
      },
      async (input) => writeResult(async () => ({ id: await loaders.createGear(input) })),
    )

  if (allowed('update_gear_item'))
    server.registerTool(
      'update_gear_item',
      {
        title: 'Update gear item',
        description: 'Partially update a gear item; omitted fields are preserved.',
        inputSchema: gearValuesSchema.extend({ gearId: z.string().uuid() }),
        annotations: writeAnnotations,
      },
      async ({ gearId, ...input }) =>
        writeResult(async () => ({ id: await loaders.updateGear(gearId, input) })),
    )

  if (allowed('create_gear_set'))
    server.registerTool(
      'create_gear_set',
      {
        title: 'Create gear set',
        description: 'Create a reusable gear set with an optional list of gear IDs.',
        inputSchema: gearSetValuesSchema.extend({
          name: z.string().trim().min(1).max(200),
        }),
        annotations: createAnnotations,
      },
      async (input) => writeResult(async () => await loaders.createGearSet(input)),
    )

  if (allowed('update_gear_set'))
    server.registerTool(
      'update_gear_set',
      {
        title: 'Update gear set',
        description: 'Partially update a gear set; omitted fields are preserved.',
        inputSchema: gearSetValuesSchema.extend({ gearSetId: z.string().uuid() }),
        annotations: writeAnnotations,
      },
      async ({ gearSetId, ...input }) =>
        writeResult(async () => await loaders.updateGearSet(gearSetId, input)),
    )

  if (allowed('update_profile'))
    server.registerTool(
      'update_profile',
      {
        title: 'Update diver profile',
        description: 'Partially update the owner profile; omitted fields are preserved.',
        inputSchema: profileValuesSchema,
        annotations: writeAnnotations,
      },
      async (input) =>
        writeResult(async () => ({ id: await loaders.updateProfile(input) })),
    )

  const deleteIdSchema = z.object({ id: z.string().uuid() })

  if (allowed('delete_dive'))
    server.registerTool(
      'delete_dive',
      {
        title: 'Delete dive',
        description: 'Permanently delete one dive and its dependent records.',
        inputSchema: deleteIdSchema,
        annotations: deleteAnnotations,
      },
      async ({ id }) =>
        writeResult(async () => {
          await loaders.deleteDive(id)
          return { id }
        }),
    )

  for (const tool of [
    ['delete_dive_site', 'sites', 'Dive site'],
    ['delete_buddy', 'buddies', 'Buddy'],
    ['delete_gear_item', 'equipment', 'Gear item'],
  ] as const) {
    if (!allowed(tool[0])) continue
    server.registerTool(
      tool[0],
      {
        title: `Delete ${tool[2].toLowerCase()}`,
        description: `Permanently delete one ${tool[2].toLowerCase()}.`,
        inputSchema: deleteIdSchema,
        annotations: deleteAnnotations,
      },
      async ({ id }) =>
        writeResult(async () => {
          await loaders.deleteEntity(tool[1], id)
          return { id }
        }),
    )
  }

  if (allowed('delete_gear_set'))
    server.registerTool(
      'delete_gear_set',
      {
        title: 'Delete gear set',
        description: 'Permanently delete one gear set.',
        inputSchema: deleteIdSchema,
        annotations: deleteAnnotations,
      },
      async ({ id }) =>
        writeResult(async () => {
          await loaders.deleteGearSet(id)
          return { id }
        }),
    )

  return server
}
