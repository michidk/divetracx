import { z } from 'zod'

export const MCP_SCOPE_VALUES = [
  'divetracx:read',
  'divetracx:write',
  'divetracx:delete',
] as const

export const mcpScopeSchema = z.enum(MCP_SCOPE_VALUES)
export type McpScope = z.infer<typeof mcpScopeSchema>

export const MCP_SCOPE_DETAILS: Record<McpScope, { label: string; description: string }> =
  {
    'divetracx:read': {
      label: 'Read logbook',
      description: 'Search and inspect dives, sites, buddies, gear, and profile data.',
    },
    'divetracx:write': {
      label: 'Create and update',
      description: 'Create new records and change existing logbook data.',
    },
    'divetracx:delete': {
      label: 'Delete records',
      description: 'Permanently delete dives, sites, buddies, and gear.',
    },
  }

export const MCP_TOOL_CATALOG = [
  {
    name: 'search_dives',
    title: 'Search dives',
    description: 'Search and page through the dive log.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'get_dive',
    title: 'Get dive details',
    description: 'Read a dive, its relationships, tanks, and bounded profile samples.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'list_dive_sites',
    title: 'List dive sites',
    description: 'Read dive sites, coordinates, and visit summaries.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'get_diving_statistics',
    title: 'Get diving statistics',
    description: 'Read aggregate logbook statistics and trends.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'list_buddies',
    title: 'List buddies',
    description: 'Read buddies with shared-dive summaries.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'get_buddy',
    title: 'Get buddy details',
    description: 'Read a buddy, certifications, memberships, and shared dives.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'list_gear',
    title: 'List gear',
    description: 'Read gear items and reusable gear sets.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'get_gear_item',
    title: 'Get gear details',
    description: 'Read one gear item and its dive history.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'get_profile',
    title: 'Get diver profile',
    description: 'Read the owner profile, certifications, and memberships.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'get_dive_editor_options',
    title: 'Get dive reference data',
    description:
      'Read valid sites, dive operators, boats, dive types, buddies, gear, and gear sets.',
    group: 'Read',
    scope: 'divetracx:read',
  },
  {
    name: 'create_dive',
    title: 'Create dive',
    description: 'Create a manually logged dive with relationships and tanks.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'update_dive',
    title: 'Update dive',
    description: 'Partially update an existing dive.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'create_dive_site',
    title: 'Create dive site',
    description: 'Create a dive site with optional coordinates and metadata.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'update_dive_site',
    title: 'Update dive site',
    description: 'Partially update an existing dive site.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'create_buddy',
    title: 'Create buddy',
    description: 'Create a buddy record.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'update_buddy',
    title: 'Update buddy',
    description: 'Partially update an existing buddy.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'create_gear_item',
    title: 'Create gear item',
    description: 'Create a piece of diving equipment.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'update_gear_item',
    title: 'Update gear item',
    description: 'Partially update an existing gear item.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'create_gear_set',
    title: 'Create gear set',
    description: 'Create a reusable set of gear items.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'update_gear_set',
    title: 'Update gear set',
    description: 'Update a gear set and its item membership.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'update_profile',
    title: 'Update diver profile',
    description: 'Partially update owner profile and emergency details.',
    group: 'Create and update',
    scope: 'divetracx:write',
  },
  {
    name: 'delete_dive',
    title: 'Delete dive',
    description: 'Permanently delete one dive.',
    group: 'Delete',
    scope: 'divetracx:delete',
  },
  {
    name: 'delete_dive_site',
    title: 'Delete dive site',
    description: 'Permanently delete one dive site.',
    group: 'Delete',
    scope: 'divetracx:delete',
  },
  {
    name: 'delete_buddy',
    title: 'Delete buddy',
    description: 'Permanently delete one buddy.',
    group: 'Delete',
    scope: 'divetracx:delete',
  },
  {
    name: 'delete_gear_item',
    title: 'Delete gear item',
    description: 'Permanently delete one gear item.',
    group: 'Delete',
    scope: 'divetracx:delete',
  },
  {
    name: 'delete_gear_set',
    title: 'Delete gear set',
    description: 'Permanently delete one gear set.',
    group: 'Delete',
    scope: 'divetracx:delete',
  },
] as const satisfies ReadonlyArray<{
  name: string
  title: string
  description: string
  group: 'Read' | 'Create and update' | 'Delete'
  scope: McpScope
}>

export type McpToolName = (typeof MCP_TOOL_CATALOG)[number]['name']
export const MCP_TOOL_NAMES = MCP_TOOL_CATALOG.map((tool) => tool.name) as [
  McpToolName,
  ...McpToolName[],
]
export const mcpToolNameSchema = z.enum(MCP_TOOL_NAMES)

export function scopesForEnabledTools(disabledTools: readonly string[]) {
  const disabled = new Set(disabledTools)
  return MCP_SCOPE_VALUES.filter(
    (scope) =>
      scope === 'divetracx:read' ||
      MCP_TOOL_CATALOG.some((tool) => tool.scope === scope && !disabled.has(tool.name)),
  )
}
