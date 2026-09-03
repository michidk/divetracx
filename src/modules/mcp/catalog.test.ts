import { describe, expect, test } from 'bun:test'
import { MCP_TOOL_CATALOG, MCP_TOOL_NAMES, scopesForEnabledTools } from './catalog'

describe('MCP tool catalog', () => {
  test('has unique names and a scope for every tool', () => {
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length)
    expect(MCP_TOOL_CATALOG.every((tool) => tool.scope.startsWith('divetracx:'))).toBe(
      true,
    )
  })

  test('advertises write and delete scopes only while those tools are enabled', () => {
    const writeAndDeleteTools = MCP_TOOL_CATALOG.filter(
      (tool) => tool.scope !== 'divetracx:read',
    ).map((tool) => tool.name)

    expect(scopesForEnabledTools([])).toEqual([
      'divetracx:read',
      'divetracx:write',
      'divetracx:delete',
    ])
    expect(scopesForEnabledTools(writeAndDeleteTools)).toEqual(['divetracx:read'])
  })
})
