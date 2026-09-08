import type { IntegrationEntity } from '@/modules/integrations/types'

/**
 * A Subsurface logbook is a list of dives; people, cylinders, and samples are
 * written inside each dive element, so dives themselves cannot be switched off.
 */
export const SUBSURFACE_ENTITIES: readonly IntegrationEntity[] = [
  {
    key: 'dive_sites',
    label: 'Dive sites',
    description:
      'Sites with GPS, matched to yours by name or coordinates before new ones are created.',
    recordTypes: ['dive_site'],
  },
  {
    key: 'dives',
    label: 'Dives',
    description: 'Log entries keyed by their start time; tags set the dive type.',
    required: true,
    recordTypes: ['dive'],
  },
  {
    key: 'buddies',
    label: 'Buddies and guides',
    description:
      'People named on dives become buddies; existing people are matched by name.',
    dependsOn: ['dives'],
  },
  {
    key: 'profile_samples',
    label: 'Dive profiles',
    description: 'Depth, temperature, pressure, and gas-change samples.',
    dependsOn: ['dives'],
  },
  {
    key: 'tanks',
    label: 'Tanks',
    description: 'Cylinders with volume, gas mix, and pressures.',
    dependsOn: ['dives'],
  },
]
