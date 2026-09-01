import { describe, expect, test } from 'bun:test'
import { AppRouteError } from '@/components/app-error'
import { getRouter } from './router'

describe('router error boundary', () => {
  test('uses the polished app error for route failures during SSR', () => {
    expect(getRouter().options.defaultErrorComponent).toBe(AppRouteError)
  })
})
