import type { IntegrationEntity } from '@/modules/integrations/types'

/**
 * A Garmin activity is one dive; its profile and gases are read out of the
 * same FIT file, so the dive itself cannot be switched off. Gear and
 * certifications come from the Garmin Dive app's own service and are
 * independent of dives.
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
  {
    key: 'equipment',
    label: 'Gear',
    description:
      'Gear from the Garmin Dive app with brand, model, serial, purchase, and service dates. Existing gear is matched by name.',
    recordTypes: ['gear'],
  },
  {
    key: 'certifications',
    label: 'Certifications',
    description:
      'Certifications logged in the Garmin Dive app, name and date only. Existing certifications are matched by name.',
    recordTypes: ['certification'],
  },
]
