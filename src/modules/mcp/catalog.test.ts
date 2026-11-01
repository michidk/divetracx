import { describe, expect, test } from 'bun:test'
import { MCP_TOOL_CATALOG, MCP_TOOL_NAMES } from './catalog'

describe('MCP tool catalog', () => {
  test('has unique names and a scope for every tool', () => {
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length)
    expect(MCP_TOOL_CATALOG.every((tool) => tool.scope.startsWith('divetracx:'))).toBe(
      true,
    )
  })
})
