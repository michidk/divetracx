import type { IntegrationEntity } from '@/modules/integrations/types'

/**
 * A Garmin activity is one dive; its profile and gases are read out of the
 * same FIT file, so the dive itself cannot be switched off.
 */
export const GARMIN_ENTITIES: readonly IntegrationEntity[] = [
  {
    key: 'dives',
    label: 'Dives',
    description:
      'One dive per activity, matched to a log entry you already have by start time.',
    required: true,
    recordTypes: ['activity'],
  },
  {
    key: 'profile_samples',
    label: 'Dive profiles',
    description: 'Depth, temperature, and ceiling samples from the FIT file.',
    dependsOn: ['dives'],
  },
  {
    key: 'tanks',
    label: 'Tanks and gases',
    description: 'One tank per gas the computer recorded.',
    dependsOn: ['dives'],
  },
]
