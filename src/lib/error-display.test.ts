import { describe, expect, test } from 'bun:test'
import { getErrorDisplayState } from '@/lib/error-display'

describe('error display state', () => {
  test('classifies a missing database configuration', () => {
    expect(
      getErrorDisplayState(new Error('DATABASE_URL environment variable is required')),
    ).toEqual({
      title: 'Database not configured',
      message: 'Divetracx is missing its PostgreSQL connection settings.',
      hint: 'Set DATABASE_URL, restart the server, then try again.',
    })
  })

  test('classifies a refused database connection', () => {
    expect(
      getErrorDisplayState(new Error('connect ECONNREFUSED 127.0.0.1:5432')).title,
    ).toBe('Database unavailable')
  })

  test('uses an error cause to identify a stale schema', () => {
    const error = new Error('Failed query: select * from pictures', {
      cause: new Error('column "storage_path" does not exist'),
    })

    expect(getErrorDisplayState(error)).toEqual({
      title: 'Database update required',
      message: 'The database schema does not match this version of Divetracx.',
      hint: 'Apply the latest database migrations, then try again.',
    })
  })

  test('does not expose raw failed queries', () => {
    const state = getErrorDisplayState(
      new Error('Failed query: select secret from private_table'),
    )

    expect(state.title).toBe('Dive data unavailable')
    expect(state.message).not.toContain('select')
  })

  test('uses a safe fallback for unknown errors', () => {
    expect(getErrorDisplayState(new Error('unexpected internal detail'))).toEqual({
      title: 'Something went wrong',
      message: 'Divetracx could not load this page.',
      hint: 'Try again. If the problem continues, check the server logs.',
    })
  })
})
