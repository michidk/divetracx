import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSubsurfaceConnector } from './connector.server'

const signal = new AbortController().signal

describe('Subsurface connector contract', () => {
  test('declares upload-only incremental import with export', () => {
    const connector = createSubsurfaceConnector()
    expect(connector.descriptor.capabilities).toEqual({
      fullImport: false,
      incrementalImport: true,
      export: true,
    })
    expect(connector.export).toBeDefined()
  })

  test('refuses to prepare an import without an uploaded file', async () => {
    await expect(
      createSubsurfaceConnector().prepareImport({
        mode: 'incremental',
        state: {},
        signal,
      }),
    ).rejects.toThrow(/Choose a Subsurface logbook/)
  })

  test('prepares one external record per site and dive with a file fingerprint', async () => {
    const xml = readFileSync(
      join(import.meta.dir, '..', 'fixtures', 'test47c.xml'),
      'utf8',
    )
    const connector = createSubsurfaceConnector({ fileName: 'test47c.xml', xml })

    const prepared = await connector.prepareImport({
      mode: 'incremental',
      state: { files: ['older.ssrf:abc'] },
      signal,
    })

    expect(
      prepared.records.map((record) => `${record.entityType}:${record.identityKey}`),
    ).toEqual([
      'dive_site:4f6eef08',
      'dive_site:cb2d5719',
      'dive:2015-10-01T08:00:25',
      'dive:2015-10-05T08:00:05',
    ])
    expect(prepared.sourceFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(prepared.validation).toEqual({
      complete: true,
      sourceDescription: 'Subsurface logbook test47c.xml (format 3)',
    })
    expect(prepared.nextState.lastFileName).toBe('test47c.xml')
    expect(prepared.nextState.files).toHaveLength(2)
    expect(prepared.diagnostics).toMatchObject({
      divesInFile: 2,
      sitesInFile: 2,
      divesSkipped: 0,
    })
  })

  test('surfaces parse errors for files that are not Subsurface logbooks', async () => {
    const connector = createSubsurfaceConnector({
      fileName: 'export.uddf',
      xml: '<uddf version="3.2.0"/>',
    })
    await expect(
      connector.prepareImport({ mode: 'incremental', state: {}, signal }),
    ).rejects.toThrow(/UDDF/)
  })
})
