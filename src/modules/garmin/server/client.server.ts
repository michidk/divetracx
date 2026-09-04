import '@tanstack/react-start/server-only'

import type { GarminSourceClient } from '../types'
import {
  type GarminConnectBatchSource,
  GarminConnectSource,
} from './connect-source.server'

/**
 * The Garmin Connect transport runs in the main application process. Keeping
 * this small client interface lets the canonical connector remain transport
 * agnostic and easy to test.
 */
export function createGarminSourceClient(
  source: GarminConnectBatchSource = new GarminConnectSource(),
): GarminSourceClient {
  return {
    fetchFull(state, signal) {
      signal?.throwIfAborted()
      return source.fetchBatch('full', state)
    },
    fetchIncremental(state, signal) {
      signal?.throwIfAborted()
      return source.fetchBatch('incremental', state)
    },
  }
}
